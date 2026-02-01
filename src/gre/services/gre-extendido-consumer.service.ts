import { Injectable, Logger, Controller } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { KafkaService } from '../../kafka/kafka.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GreExtendidoProducerService } from './gre-extendido-producer.service';
import { GreExtendidoPollingService } from './gre-extendido-polling.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import axios from 'axios';

@Controller()
@Injectable()
export class GreExtendidoConsumerService {
  private readonly logger = new Logger(GreExtendidoConsumerService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly prismaService: PrismaService,
    private readonly greExtendidoProducer: GreExtendidoProducerService,
    private readonly greExtendidoPolling: GreExtendidoPollingService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    this.logger.log('GreExtendidoConsumerService initialized');
  }

  @MessagePattern('gre-extendido-requests')
  async handleGreRequest(@Payload() message: any, @Ctx() context: KafkaContext): Promise<void> {
    try {
      this.logger.log(`📥 Mensaje recibido de gre-extendido-requests: ${JSON.stringify(message).substring(0, 100)}...`);

      const { id, recordId, data } = message;

      this.logger.log(`Procesando GRE Extendido request: ${id} para registro ${recordId}`);

      // 🔍 DEBUG: Ver qué items vienen en el mensaje de Kafka
      console.log(`\n🔍 [CONSUMER-KAFKA] Mensaje data.items:`, data?.items);

      // Verificar estado antes de procesar
      const currentRecord = await this.prismaService.guia_remision_extendida.findUnique({
        where: { id_guia: parseInt(recordId) }
      });

      if (!currentRecord) {
        this.logger.error(`Registro extendido ${recordId} no encontrado en BD`);
        return;
      }

      if (currentRecord.estado_gre !== 'PENDIENTE') {
        this.logger.warn(`⚠️ Registro extendido ${recordId} ya fue procesado (estado: ${currentRecord.estado_gre}), ignorando mensaje duplicado`);
        return;
      }

      // Actualizar estado a PROCESANDO
      await this.prismaService.guia_remision_extendida.update({
        where: { id_guia: parseInt(recordId) },
        data: { estado_gre: 'PROCESANDO' }
      });

      // Llamar API generar_guia de NUBEFACT
      const nubefactResponse = await this.callNubefactGenerarGuia(data);

      if (nubefactResponse.success) {
        this.logger.log(`API generar_guia exitosa para registro extendido ${recordId}`);

        // Mover a topic processing para iniciar polling
        await this.greExtendidoProducer.sendToProcessing(id, recordId, {
          ...message,
          nubefactResponse: nubefactResponse.data,
          pollStartTime: new Date().toISOString()
        });

        // Iniciar polling persistente
        await this.greExtendidoPolling.startPolling(recordId, id, nubefactResponse.data);

      } else {
        this.logger.error(`Error en API generar_guia para registro extendido ${recordId}:`, nubefactResponse.error);

        // Actualizar a FALLADO
        await this.prismaService.guia_remision_extendida.update({
          where: { id_guia: parseInt(recordId) },
          data: { estado_gre: 'FALLADO' }
        });

        // Enviar a topic failed
        await this.greExtendidoProducer.sendToFailed(id, recordId, nubefactResponse.error, data);
      }

    } catch (error) {
      this.logger.error('Error procesando GRE Extendido request:', error);

      try {
        if (message?.recordId) {
          await this.prismaService.guia_remision_extendida.update({
            where: { id_guia: parseInt(message.recordId) },
            data: { estado_gre: 'FALLADO' }
          });
        }
      } catch (updateError) {
        this.logger.error('Error actualizando estado extendido a FALLADO:', updateError);
      }
    }
  }

  @MessagePattern('gre-extendido-processing')
  async handleGreProcessing(@Payload() message: any, @Ctx() context: KafkaContext): Promise<void> {
    try {
      const { id, recordId } = message;

      this.logger.debug(`Procesando mensaje extendido en processing: ${id} para registro ${recordId}`);

      // Verificar si el registro ya está COMPLETADO
      const record = await this.prismaService.guia_remision_extendida.findUnique({
        where: { id_guia: parseInt(recordId) }
      });

      if (record?.estado_gre === 'COMPLETADO') {
        this.logger.log(`Registro extendido ${recordId} ya completado, deteniendo procesamiento`);
        await this.greExtendidoPolling.stopPolling(recordId);
      }

    } catch (error) {
      this.logger.error('Error procesando mensaje extendido de processing:', error);
    }
  }

  @MessagePattern('gre-extendido-responses')
  async handleGreResponse(@Payload() message: any, @Ctx() context: KafkaContext): Promise<void> {
    try {
      const { id, recordId, status, nubefact_response, error } = message;

      this.logger.log(`Procesando respuesta extendida: ${id} para registro ${recordId}, estado: ${status}`);

      if (status === 'success' && nubefact_response) {
        const { pdf_url, xml_url, cdr_url } = nubefact_response;

        if (pdf_url && xml_url && cdr_url) {
          // Verificar primero si ya fue completado
          const currentRecord = await this.prismaService.guia_remision_extendida.findUnique({
            where: { id_guia: parseInt(recordId) }
          });

          if (currentRecord?.estado_gre === 'COMPLETADO') {
            this.logger.log(`✅ Registro extendido ${recordId} ya fue completado por polling, omitiendo actualización duplicada`);
            await this.greExtendidoPolling.stopPolling(recordId);
            return;
          }

          // Si no está completado, actualizar BD
          const guiaCompletada = await this.prismaService.guia_remision_extendida.update({
            where: { id_guia: parseInt(recordId) },
            data: {
              estado_gre: 'COMPLETADO',
              enlace_del_pdf: pdf_url,
              enlace_del_xml: xml_url,
              enlace_del_cdr: cdr_url
            }
          });

          // Detener polling
          await this.greExtendidoPolling.stopPolling(recordId);

          this.logger.log(`Registro extendido ${recordId} completado con todos los enlaces (vía consumer)`);

          // Emitir evento WebSocket
          if (guiaCompletada.identificador_unico) {
            const programacionTecnica = await this.prismaService.programacion_tecnica.findFirst({
              where: { identificador_unico: guiaCompletada.identificador_unico },
              select: { id: true }
            });

            if (programacionTecnica) {
              this.websocketGateway.emitProgTecnicaCompletada({
                id: programacionTecnica.id,
                identificador_unico: guiaCompletada.identificador_unico,
                pdf_link: pdf_url,
                xml_link: xml_url,
                cdr_link: cdr_url
              });
              this.logger.log(`📡 WebSocket emitido para prog-tecnica extendida desde consumer: ${guiaCompletada.identificador_unico}`);
            } else {
              this.logger.warn(`⚠️ No se encontró programacion_tecnica para identificador extendido: ${guiaCompletada.identificador_unico}`);
            }
          }
        } else {
          this.logger.debug(`Registro extendido ${recordId} aún sin todos los enlaces, continuando polling`);
        }

      } else if (status === 'error') {
        this.logger.error(`Error en respuesta extendida para registro ${recordId}:`, error);

        // Actualizar a FALLADO
        await this.prismaService.guia_remision_extendida.update({
          where: { id_guia: parseInt(recordId) },
          data: { estado_gre: 'FALLADO' }
        });

        // Detener polling
        await this.greExtendidoPolling.stopPolling(recordId);
      }

    } catch (error) {
      this.logger.error('Error procesando respuesta extendida GRE:', error);
    }
  }

  private async callNubefactGenerarGuia(greData: any) {
    try {
      const NUBEFACT_API_URL = process.env.NUBEFACT_API_URL || 'https://api.nubefact.com/api/v1/generar_guia';
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      if (!NUBEFACT_TOKEN) {
        throw new Error('NUBEFACT_TOKEN no configurado');
      }

      this.logger.log('Llamando a NUBEFACT API generar_guia (extendido)');

      // 🔍 DEBUG: Ver payload final que se envía a Nubefact
      console.log(`\n🔍 [NUBEFACT-PAYLOAD] greData.items antes de enviar:`, JSON.stringify(greData.items, null, 2));

      const response = await axios.post(NUBEFACT_API_URL, greData, {
        headers: {
          'Authorization': `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      this.logger.error('Error en llamada extendida a NUBEFACT:', error);

      return {
        success: false,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      };
    }
  }

  async getConsumerStats() {
    try {
      const pendientes = await this.prismaService.guia_remision_extendida.count({
        where: { estado_gre: 'PENDIENTE' }
      });

      const procesando = await this.prismaService.guia_remision_extendida.count({
        where: { estado_gre: 'PROCESANDO' }
      });

      const completados = await this.prismaService.guia_remision_extendida.count({
        where: { estado_gre: 'COMPLETADO' }
      });

      const fallados = await this.prismaService.guia_remision_extendida.count({
        where: { estado_gre: 'FALLADO' }
      });

      const pollingActivos = await this.greExtendidoPolling.getActivePollingCount();

      return {
        pendientes,
        procesando,
        completados,
        fallados,
        pollingActivos,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error obteniendo estadísticas extendidas del consumer:', error);
      throw error;
    }
  }

  async retryFailedRecords(): Promise<void> {
    try {
      const failedRecords = await this.prismaService.guia_remision_extendida.findMany({
        where: { estado_gre: 'FALLADO' },
        take: 10
      });

      this.logger.log(`Reintentando ${failedRecords.length} registros extendidos fallidos`);

      for (const record of failedRecords) {
        try {
          await this.prismaService.guia_remision_extendida.update({
            where: { id_guia: record.id_guia },
            data: { estado_gre: null }
          });

          this.logger.log(`Registro extendido ${record.id_guia} reseteado para reintento`);
        } catch (error) {
          this.logger.error(`Error reseteando registro extendido ${record.id_guia}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error en retry de registros extendidos fallidos:', error);
      throw error;
    }
  }
}
