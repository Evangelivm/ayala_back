import { Injectable, Logger, Controller } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { KafkaService } from '../../kafka/kafka.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GreProducerService } from './gre-producer.service';
import { GrePollingService } from './gre-polling.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import axios from 'axios';

@Controller() // ✅ Necesario para @MessagePattern
@Injectable() // ✅ Necesario para inyección de dependencias
export class GreConsumerService {
  private readonly logger = new Logger(GreConsumerService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly prismaService: PrismaService,
    private readonly greProducer: GreProducerService,
    private readonly grePolling: GrePollingService,
    private readonly websocketGateway: WebsocketGateway,
  ) {
    this.logger.log('GreConsumerService initialized');
  }

  @MessagePattern('gre-requests')
  async handleGreRequest(@Payload() message: any, @Ctx() context: KafkaContext): Promise<void> {
    try {
      this.logger.log(`📥 Mensaje recibido de gre-requests: ${JSON.stringify(message).substring(0, 100)}...`);

      const { id, recordId, data } = message;

      this.logger.log(`Procesando GRE request: ${id} para registro ${recordId}`);

      // ✅ VERIFICAR ESTADO ANTES DE PROCESAR (deduplicación)
      const currentRecord = await this.prismaService.guia_remision.findUnique({
        where: { id_guia: parseInt(recordId) }
      });

      if (!currentRecord) {
        this.logger.error(`Registro ${recordId} no encontrado en BD`);
        return;
      }

      // Si ya está en PROCESANDO, COMPLETADO o FALLADO, ignorar (ya fue procesado)
      if (currentRecord.estado_gre !== 'PENDIENTE') {
        this.logger.warn(`⚠️ Registro ${recordId} ya fue procesado (estado: ${currentRecord.estado_gre}), ignorando mensaje duplicado`);
        return;
      }

      // Actualizar estado en BD a PROCESANDO
      await this.prismaService.guia_remision.update({
        where: { id_guia: parseInt(recordId) },
        data: { estado_gre: 'PROCESANDO' }
      });

      // Llamar API generar_guia de NUBEFACT
      const nubefactResponse = await this.callNubefactGenerarGuia(data);

      if (nubefactResponse.success) {
        this.logger.log(`API generar_guia exitosa para registro ${recordId}`);

        // Mover a topic processing para iniciar polling
        await this.greProducer.sendToProcessing(id, recordId, {
          ...message,
          nubefactResponse: nubefactResponse.data,
          pollStartTime: new Date().toISOString()
        });

        // Iniciar polling persistente
        await this.grePolling.startPolling(recordId, id, nubefactResponse.data);

      } else {
        this.logger.error(`Error en API generar_guia para registro ${recordId}:`, nubefactResponse.error);

        // Actualizar a FALLADO
        await this.prismaService.guia_remision.update({
          where: { id_guia: parseInt(recordId) },
          data: { estado_gre: 'FALLADO' }
        });

        // Enviar a topic failed
        await this.greProducer.sendToFailed(id, recordId, nubefactResponse.error, data);
      }

    } catch (error) {
      this.logger.error('Error procesando GRE request:', error);

      // Extraer recordId del mensaje para actualizar estado
      try {
        if (message?.recordId) {
          await this.prismaService.guia_remision.update({
            where: { id_guia: parseInt(message.recordId) },
            data: { estado_gre: 'FALLADO' }
          });
        }
      } catch (updateError) {
        this.logger.error('Error actualizando estado a FALLADO:', updateError);
      }
    }
  }

  @MessagePattern('gre-processing')
  async handleGreProcessing(@Payload() message: any, @Ctx() context: KafkaContext): Promise<void> {
    try {
      const { id, recordId } = message;

      this.logger.debug(`Procesando mensaje en processing: ${id} para registro ${recordId}`);

      // Este consumer principalmente monitoreará el estado del polling
      // El polling real se maneja en GrePollingService

      // Verificar si el registro ya está COMPLETADO
      const record = await this.prismaService.guia_remision.findUnique({
        where: { id_guia: parseInt(recordId) }
      });

      if (record?.estado_gre === 'COMPLETADO') {
        this.logger.log(`Registro ${recordId} ya completado, deteniendo procesamiento`);
        await this.grePolling.stopPolling(recordId);
      }

    } catch (error) {
      this.logger.error('Error procesando mensaje de processing:', error);
    }
  }

  @MessagePattern('gre-responses')
  async handleGreResponse(@Payload() message: any, @Ctx() context: KafkaContext): Promise<void> {
    try {
      const { id, recordId, status, nubefact_response, error } = message;

      this.logger.log(`Procesando respuesta: ${id} para registro ${recordId}, estado: ${status}`);

      if (status === 'success' && nubefact_response) {
        // Verificar si tenemos todos los enlaces
        const { pdf_url, xml_url, cdr_url } = nubefact_response;

        if (pdf_url && xml_url && cdr_url) {
          // ✅ VERIFICAR PRIMERO si el registro ya fue completado por el polling
          const currentRecord = await this.prismaService.guia_remision.findUnique({
            where: { id_guia: parseInt(recordId) }
          });

          if (currentRecord?.estado_gre === 'COMPLETADO') {
            this.logger.log(`✅ Registro ${recordId} ya fue completado por polling, omitiendo actualización duplicada`);
            await this.grePolling.stopPolling(recordId);
            return;
          }

          // Si no está completado, actualizar BD (respaldo por si el polling falló)
          const guiaCompletada = await this.prismaService.guia_remision.update({
            where: { id_guia: parseInt(recordId) },
            data: {
              estado_gre: 'COMPLETADO',
              enlace_del_pdf: pdf_url,
              enlace_del_xml: xml_url,
              enlace_del_cdr: cdr_url
            }
          });

          // Detener polling para este registro
          await this.grePolling.stopPolling(recordId);

          this.logger.log(`Registro ${recordId} completado con todos los enlaces (vía consumer)`);

          // 📡 Emitir evento WebSocket para notificar al frontend (respaldo)
          if (guiaCompletada.identificador_unico) {
            this.websocketGateway.emitProgTecnicaCompletada({
              id: guiaCompletada.id_guia,
              identificador_unico: guiaCompletada.identificador_unico
            });
            this.logger.log(`📡 WebSocket emitido para prog-tecnica desde consumer: ${guiaCompletada.identificador_unico}`);
          }
        } else {
          this.logger.debug(`Registro ${recordId} aún sin todos los enlaces, continuando polling`);
        }

      } else if (status === 'error') {
        this.logger.error(`Error en respuesta para registro ${recordId}:`, error);

        // Actualizar a FALLADO
        await this.prismaService.guia_remision.update({
          where: { id_guia: parseInt(recordId) },
          data: { estado_gre: 'FALLADO' }
        });

        // Detener polling
        await this.grePolling.stopPolling(recordId);
      }

    } catch (error) {
      this.logger.error('Error procesando respuesta GRE:', error);
    }
  }

  private async callNubefactGenerarGuia(greData: any) {
    try {
      const NUBEFACT_API_URL = process.env.NUBEFACT_API_URL || 'https://api.nubefact.com/api/v1/generar_guia';
      const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

      if (!NUBEFACT_TOKEN) {
        throw new Error('NUBEFACT_TOKEN no configurado');
      }

      this.logger.log('Llamando a NUBEFACT API generar_guia');

      const response = await axios.post(NUBEFACT_API_URL, greData, {
        headers: {
          'Authorization': `Token ${NUBEFACT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      this.logger.error('Error en llamada a NUBEFACT:', error);

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

  // Método para obtener estadísticas del consumer
  async getConsumerStats() {
    try {
      const pendientes = await this.prismaService.guia_remision.count({
        where: { estado_gre: 'PENDIENTE' }
      });

      const procesando = await this.prismaService.guia_remision.count({
        where: { estado_gre: 'PROCESANDO' }
      });

      const completados = await this.prismaService.guia_remision.count({
        where: { estado_gre: 'COMPLETADO' }
      });

      const fallados = await this.prismaService.guia_remision.count({
        where: { estado_gre: 'FALLADO' }
      });

      const pollingActivos = await this.grePolling.getActivePollingCount();

      return {
        pendientes,
        procesando,
        completados,
        fallados,
        pollingActivos,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error obteniendo estadísticas del consumer:', error);
      throw error;
    }
  }

  // Método para reanudar procesamiento de registros fallidos
  async retryFailedRecords(): Promise<void> {
    try {
      const failedRecords = await this.prismaService.guia_remision.findMany({
        where: { estado_gre: 'FALLADO' },
        take: 10 // Procesar de a 10
      });

      this.logger.log(`Reintentando ${failedRecords.length} registros fallidos`);

      for (const record of failedRecords) {
        try {
          // Resetear estado a null para que sea detectado nuevamente
          await this.prismaService.guia_remision.update({
            where: { id_guia: record.id_guia },
            data: { estado_gre: null }
          });

          this.logger.log(`Registro ${record.id_guia} reseteado para reintento`);
        } catch (error) {
          this.logger.error(`Error reseteando registro ${record.id_guia}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error en retry de registros fallidos:', error);
      throw error;
    }
  }
}