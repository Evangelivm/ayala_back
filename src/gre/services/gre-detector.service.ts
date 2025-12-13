import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GreProducerService } from './gre-producer.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class GreDetectorService {
  private readonly logger = new Logger(GreDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly greProducer: GreProducerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async detectCompleteRecords() {
    try {
      this.logger.debug('Detectando registros completos para GRE...');

      // Buscar registros con estado_gre NULL y que tengan todos los campos obligatorios
      const completeRecords = await this.prisma.guia_remision.findMany({
        where: {
          estado_gre: null,
        },
        include: {
          items: true,
          documento_relacionado: true,
          vehiculos_secundarios: true,
          conductores_secundarios: true,
        },
      });

      if (completeRecords.length > 0) {
        this.logger.log(`Encontrados ${completeRecords.length} registros para validar`);

        for (const record of completeRecords) {
          try {
            // Validar según tipo de comprobante
            const isValid = await this.validateGreRecord(record);

            if (isValid) {
              await this.processCompleteRecord(record);
            } else {
              this.logger.debug(`Registro ${record.id_guia} no cumple validaciones, omitiendo...`);
            }
          } catch (error) {
            this.logger.error(`Error procesando registro ${record.id_guia}:`, error);
          }
        }
      } else {
        this.logger.debug('No se encontraron registros completos pendientes');
      }
    } catch (error) {
      this.logger.error('Error en detección de registros completos:', error);
    }
  }

  private async validateGreRecord(record: any): Promise<boolean> {
    try {
      // Validaciones comunes para ambos tipos
      if (!record.operacion || record.operacion !== 'generar_guia') {
        this.logger.debug(`Registro ${record.id_guia}: operacion inválida`);
        return false;
      }

      if (!record.serie || record.serie.length !== 4) {
        this.logger.debug(`Registro ${record.id_guia}: serie inválida`);
        return false;
      }

      if (!record.numero || record.numero < 1) {
        this.logger.debug(`Registro ${record.id_guia}: numero inválido`);
        return false;
      }

      // Validar tipo de comprobante
      if (![7, 8].includes(record.tipo_de_comprobante)) {
        this.logger.debug(`Registro ${record.id_guia}: tipo_de_comprobante debe ser 7 u 8`);
        return false;
      }

      // Validar serie según tipo
      const tipoRemitente = record.tipo_de_comprobante === 7;
      const tipoTransportista = record.tipo_de_comprobante === 8;

      if (tipoRemitente && !record.serie.startsWith('T')) {
        this.logger.debug(`Registro ${record.id_guia}: GRE Remitente debe iniciar con T`);
        return false;
      }

      if (tipoTransportista && !record.serie.startsWith('V')) {
        this.logger.debug(`Registro ${record.id_guia}: GRE Transportista debe iniciar con V`);
        return false;
      }

      // Validar campos de cliente
      if (!record.cliente_tipo_de_documento || !record.cliente_numero_de_documento ||
          !record.cliente_denominacion || !record.cliente_direccion) {
        this.logger.debug(`Registro ${record.id_guia}: faltan datos de cliente`);
        return false;
      }

      // Validar fechas
      if (!record.fecha_de_emision || !record.fecha_de_inicio_de_traslado) {
        this.logger.debug(`Registro ${record.id_guia}: faltan fechas`);
        return false;
      }

      // Validar peso
      if (!record.peso_bruto_total || record.peso_bruto_total <= 0) {
        this.logger.debug(`Registro ${record.id_guia}: peso_bruto_total inválido`);
        return false;
      }

      if (!record.peso_bruto_unidad_de_medida || !['KGM', 'TNE'].includes(record.peso_bruto_unidad_de_medida)) {
        this.logger.debug(`Registro ${record.id_guia}: peso_bruto_unidad_de_medida inválida`);
        return false;
      }

      // Validar placa
      if (!record.transportista_placa_numero || record.transportista_placa_numero.length < 6) {
        this.logger.debug(`Registro ${record.id_guia}: placa inválida`);
        return false;
      }

      // Validar ubicaciones
      if (!record.punto_de_partida_ubigeo || record.punto_de_partida_ubigeo.length !== 6 ||
          !record.punto_de_partida_direccion) {
        this.logger.debug(`Registro ${record.id_guia}: datos de partida incompletos`);
        return false;
      }

      if (!record.punto_de_llegada_ubigeo || record.punto_de_llegada_ubigeo.length !== 6 ||
          !record.punto_de_llegada_direccion) {
        this.logger.debug(`Registro ${record.id_guia}: datos de llegada incompletos`);
        return false;
      }

      // Validar items
      if (!record.items || record.items.length === 0) {
        this.logger.debug(`Registro ${record.id_guia}: no tiene items`);
        return false;
      }

      // Validar cada item
      for (const item of record.items) {
        if (!item.unidad_de_medida || !item.descripcion || !item.cantidad || item.cantidad <= 0) {
          this.logger.debug(`Registro ${record.id_guia}: item inválido`);
          return false;
        }
      }

      // VALIDACIONES ESPECÍFICAS POR TIPO
      if (tipoRemitente) {
        return this.validateGreRemitente(record);
      } else if (tipoTransportista) {
        return this.validateGreTransportista(record);
      }

      return false;
    } catch (error) {
      this.logger.error(`Error validando registro ${record.id_guia}:`, error);
      return false;
    }
  }

  private validateGreRemitente(record: any): boolean {
    // GRE Remitente (tipo 7) - Validaciones específicas

    this.logger.log(`🔍 [VALIDACIÓN GRE REMITENTE] ID: ${record.id_guia}`);
    this.logger.log(`   - tipo_de_transporte: ${record.tipo_de_transporte}`);

    // 1. Motivo de traslado obligatorio
    if (!record.motivo_de_traslado) {
      this.logger.warn(`❌ Registro ${record.id_guia}: falta motivo_de_traslado (obligatorio para GRE Remitente)`);
      return false;
    }

    const motivosValidos = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '13', '14', '17', '18'];
    if (!motivosValidos.includes(record.motivo_de_traslado)) {
      this.logger.warn(`❌ Registro ${record.id_guia}: motivo_de_traslado inválido`);
      return false;
    }

    // 2. Número de bultos obligatorio
    if (!record.numero_de_bultos || record.numero_de_bultos < 1) {
      this.logger.warn(`❌ Registro ${record.id_guia}: falta numero_de_bultos (obligatorio para GRE Remitente)`);
      return false;
    }

    // 3. Tipo de transporte obligatorio
    if (!record.tipo_de_transporte || !['01', '02'].includes(record.tipo_de_transporte)) {
      this.logger.warn(`❌ Registro ${record.id_guia}: falta tipo_de_transporte (obligatorio para GRE Remitente)`);
      return false;
    }

    // 4. Si tipo_de_transporte = "01" (Público), validar datos de transportista
    if (record.tipo_de_transporte === '01') {
      this.logger.log(`   🚌 Modo PÚBLICO - Validando datos del transportista...`);

      if (!record.transportista_documento_tipo || record.transportista_documento_tipo !== 6) {
        this.logger.warn(`❌ Registro ${record.id_guia}: transportista_documento_tipo debe ser 6 (RUC)`);
        return false;
      }

      if (!record.transportista_documento_numero || record.transportista_documento_numero.length !== 11) {
        this.logger.warn(`❌ Registro ${record.id_guia}: transportista_documento_numero inválido (debe ser RUC de 11 dígitos)`);
        return false;
      }

      if (!record.transportista_denominacion) {
        this.logger.warn(`❌ Registro ${record.id_guia}: falta transportista_denominacion`);
        return false;
      }

      this.logger.log(`   ✅ Transportista válido: ${record.transportista_denominacion}`);
    }

    // 5. Si tipo_de_transporte = "02" (Privado), validar datos de conductor
    if (record.tipo_de_transporte === '02') {
      this.logger.log(`   🚗 Modo PRIVADO - Validando datos del conductor...`);

      if (!record.conductor_documento_tipo || ![0, 1, 4, 7].includes(record.conductor_documento_tipo)) {
        this.logger.warn(`❌ Registro ${record.id_guia}: conductor_documento_tipo inválido (actual: ${record.conductor_documento_tipo})`);
        return false;
      }

      if (!record.conductor_documento_numero) {
        this.logger.warn(`❌ Registro ${record.id_guia}: falta conductor_documento_numero`);
        return false;
      }

      if (!record.conductor_nombre || !record.conductor_apellidos) {
        this.logger.warn(`❌ Registro ${record.id_guia}: faltan datos del conductor (nombre: ${record.conductor_nombre}, apellidos: ${record.conductor_apellidos})`);
        return false;
      }

      if (!record.conductor_numero_licencia || record.conductor_numero_licencia.length < 9) {
        this.logger.warn(`❌ Registro ${record.id_guia}: conductor_numero_licencia inválida (actual: ${record.conductor_numero_licencia})`);
        return false;
      }

      this.logger.log(`   ✅ Conductor válido: ${record.conductor_nombre} ${record.conductor_apellidos}`);
    }

    this.logger.log(`✅ Registro ${record.id_guia}: validación GRE Remitente exitosa`);
    return true;
  }

  private validateGreTransportista(record: any): boolean {
    // GRE Transportista (tipo 8) - Validaciones específicas

    // 1. Conductor obligatorio (siempre)
    if (!record.conductor_documento_tipo || ![0, 1, 4, 7].includes(record.conductor_documento_tipo)) {
      this.logger.debug(`Registro ${record.id_guia}: conductor_documento_tipo inválido (obligatorio para GRE Transportista)`);
      return false;
    }

    if (!record.conductor_documento_numero) {
      this.logger.debug(`Registro ${record.id_guia}: falta conductor_documento_numero (obligatorio para GRE Transportista)`);
      return false;
    }

    if (!record.conductor_denominacion || !record.conductor_nombre || !record.conductor_apellidos) {
      this.logger.debug(`Registro ${record.id_guia}: faltan datos del conductor (obligatorios para GRE Transportista)`);
      return false;
    }

    if (!record.conductor_numero_licencia || record.conductor_numero_licencia.length < 9) {
      this.logger.debug(`Registro ${record.id_guia}: conductor_numero_licencia inválida (obligatoria para GRE Transportista)`);
      return false;
    }

    // 2. Destinatario obligatorio
    if (!record.destinatario_documento_tipo || ![0, 1, 4, 6, 7].includes(record.destinatario_documento_tipo)) {
      this.logger.debug(`Registro ${record.id_guia}: destinatario_documento_tipo inválido (obligatorio para GRE Transportista)`);
      return false;
    }

    if (!record.destinatario_documento_numero) {
      this.logger.debug(`Registro ${record.id_guia}: falta destinatario_documento_numero (obligatorio para GRE Transportista)`);
      return false;
    }

    if (!record.destinatario_denominacion) {
      this.logger.debug(`Registro ${record.id_guia}: falta destinatario_denominacion (obligatorio para GRE Transportista)`);
      return false;
    }

    // 3. Validaciones opcionales pero recomendadas
    // TUC del vehículo principal (opcional pero recomendado)
    if (record.tuc_vehiculo_principal &&
        (record.tuc_vehiculo_principal.length < 10 || record.tuc_vehiculo_principal.length > 15)) {
      this.logger.debug(`Registro ${record.id_guia}: tuc_vehiculo_principal con formato inválido`);
      return false;
    }

    this.logger.debug(`Registro ${record.id_guia}: validación GRE Transportista exitosa`);
    return true;
  }

  private async processCompleteRecord(record: any) {
    try {
      this.logger.log(`Procesando registro completo ID: ${record.id_guia}`);

      // Transformar datos de guia_remision a formato API NUBEFACT
      const greData = this.transformRecordToNubefactApi(record);

      // Actualizar estado a PENDIENTE antes de enviar a Kafka
      await this.prisma.guia_remision.update({
        where: { id_guia: record.id_guia },
        data: { estado_gre: 'PENDIENTE' },
      });

      // Enviar a Kafka Producer
      await this.greProducer.sendGreRequest(record.id_guia.toString(), greData);

      this.logger.log(`Registro ${record.id_guia} enviado a Kafka con estado PENDIENTE`);
    } catch (error) {
      this.logger.error(`Error procesando registro ${record.id_guia}:`, error);

      // Marcar como FALLADO si hay error
      await this.prisma.guia_remision.update({
        where: { id_guia: record.id_guia },
        data: { estado_gre: 'FALLADO' },
      });
    }
  }

  private transformRecordToNubefactApi(record: any) {
    // Los datos ya están en el formato correcto en guia_remision
    // Solo necesitamos construir el payload para la API NUBEFACT

    console.log('📅 [DETECTOR] Record leído de BD:');
    console.log('   - fecha_de_emision (raw):', record.fecha_de_emision);
    console.log('   - fecha_de_inicio_de_traslado (raw):', record.fecha_de_inicio_de_traslado);
    console.log('   - typeof fecha_de_emision:', typeof record.fecha_de_emision);

    const formatDate = (date: Date | string) => {
      // Forzar interpretación UTC para evitar cambios de día por timezone
      // Si MySQL devuelve con offset de Perú, esto lo normaliza
      let dateUTC: dayjs.Dayjs;

      if (typeof date === 'string') {
        dateUTC = dayjs.utc(date);
      } else {
        // Forzar interpretación como UTC, agregando offset para compensar
        // Si viene 2025-12-12T19:00:00.000Z, sumar 5 horas para volver a 2025-12-13
        dateUTC = dayjs(date).utc().add(5, 'hour');
      }

      const formatted = dateUTC.format('DD-MM-YYYY');

      console.log(`📅 [DETECTOR] formatDate - Input: ${date} → UTC+5: ${dateUTC.format('YYYY-MM-DD')} → Formatted: ${formatted}`);

      return formatted;
    };

    const payload: any = {
      operacion: record.operacion,
      tipo_de_comprobante: record.tipo_de_comprobante,
      serie: record.serie,
      numero: String(record.numero),
      cliente_tipo_de_documento: record.cliente_tipo_de_documento,
      cliente_numero_de_documento: record.cliente_numero_de_documento,
      cliente_denominacion: record.cliente_denominacion,
      cliente_direccion: record.cliente_direccion,
      fecha_de_emision: formatDate(record.fecha_de_emision),
      peso_bruto_total: String(record.peso_bruto_total),
      peso_bruto_unidad_de_medida: record.peso_bruto_unidad_de_medida,
      fecha_de_inicio_de_traslado: formatDate(record.fecha_de_inicio_de_traslado),
      transportista_placa_numero: record.transportista_placa_numero,
      punto_de_partida_ubigeo: record.punto_de_partida_ubigeo,
      punto_de_partida_direccion: record.punto_de_partida_direccion,
      punto_de_llegada_ubigeo: record.punto_de_llegada_ubigeo,
      punto_de_llegada_direccion: record.punto_de_llegada_direccion,
    };

    // Campos opcionales comunes
    if (record.cliente_email) payload.cliente_email = record.cliente_email;

    // NUBEFACT requiere estos campos aunque estén vacíos
    payload.cliente_email_1 = record.cliente_email_1 || "";
    payload.cliente_email_2 = record.cliente_email_2 || "";

    if (record.observaciones) payload.observaciones = record.observaciones;
    if (record.mtc) payload.mtc = record.mtc;
    if (record.enviar_automaticamente_al_cliente !== null) {
      payload.enviar_automaticamente_al_cliente = record.enviar_automaticamente_al_cliente;
    }
    payload.formato_de_pdf = record.formato_de_pdf || "";

    // Campos específicos de GRE Remitente (tipo 7)
    if (record.tipo_de_comprobante === 7) {
      payload.motivo_de_traslado = record.motivo_de_traslado;
      payload.numero_de_bultos = String(record.numero_de_bultos);
      payload.tipo_de_transporte = record.tipo_de_transporte;

      if (record.motivo_de_traslado === '13' && record.motivo_de_traslado_otros_descripcion) {
        payload.motivo_de_traslado_otros_descripcion = record.motivo_de_traslado_otros_descripcion;
      }

      // Transportista (si tipo_de_transporte = "01")
      if (record.tipo_de_transporte === '01') {
        if (record.transportista_documento_tipo) {
          payload.transportista_documento_tipo = String(record.transportista_documento_tipo);
        }
        if (record.transportista_documento_numero) {
          payload.transportista_documento_numero = record.transportista_documento_numero;
        }
        if (record.transportista_denominacion) {
          payload.transportista_denominacion = record.transportista_denominacion;
        }
      }

      // Conductor: SIEMPRE incluir si existen datos (independiente del tipo_de_transporte)
      // NUBEFACT requiere estos campos incluso con tipo_de_transporte "01"
      if (record.conductor_documento_tipo) {
        payload.conductor_documento_tipo = String(record.conductor_documento_tipo);
      }
      if (record.conductor_documento_numero) {
        payload.conductor_documento_numero = record.conductor_documento_numero;
      }
      if (record.conductor_denominacion) {
        payload.conductor_denominacion = record.conductor_denominacion;
      }
      if (record.conductor_nombre) {
        payload.conductor_nombre = record.conductor_nombre;
      }
      if (record.conductor_apellidos) {
        payload.conductor_apellidos = record.conductor_apellidos;
      }
      if (record.conductor_numero_licencia) {
        payload.conductor_numero_licencia = record.conductor_numero_licencia;
      }
    }

    // Campos específicos de GRE Transportista (tipo 8)
    if (record.tipo_de_comprobante === 8) {
      // Conductor obligatorio
      if (record.conductor_documento_tipo) {
        payload.conductor_documento_tipo = String(record.conductor_documento_tipo);
      }
      if (record.conductor_documento_numero) {
        payload.conductor_documento_numero = record.conductor_documento_numero;
      }
      if (record.conductor_denominacion) {
        payload.conductor_denominacion = record.conductor_denominacion;
      }
      if (record.conductor_nombre) {
        payload.conductor_nombre = record.conductor_nombre;
      }
      if (record.conductor_apellidos) {
        payload.conductor_apellidos = record.conductor_apellidos;
      }
      if (record.conductor_numero_licencia) {
        payload.conductor_numero_licencia = record.conductor_numero_licencia;
      }

      // Destinatario obligatorio
      if (record.destinatario_documento_tipo) {
        payload.destinatario_documento_tipo = String(record.destinatario_documento_tipo);
      }
      if (record.destinatario_documento_numero) {
        payload.destinatario_documento_numero = record.destinatario_documento_numero;
      }
      if (record.destinatario_denominacion) {
        payload.destinatario_denominacion = record.destinatario_denominacion;
      }

      // TUC opcional
      if (record.tuc_vehiculo_principal) {
        payload.tuc_vehiculo_principal = record.tuc_vehiculo_principal;
      }
    }

    // Campos condicionales adicionales
    if (record.documento_relacionado_codigo) {
      payload.documento_relacionado_codigo = record.documento_relacionado_codigo;
    }

    if (record.sunat_envio_indicador) {
      payload.sunat_envio_indicador = record.sunat_envio_indicador;

      // Subcontratador (si indicador = 02)
      if (record.sunat_envio_indicador === '02') {
        if (record.subcontratador_documento_tipo) payload.subcontratador_documento_tipo = record.subcontratador_documento_tipo;
        if (record.subcontratador_documento_numero) payload.subcontratador_documento_numero = record.subcontratador_documento_numero;
        if (record.subcontratador_denominacion) payload.subcontratador_denominacion = record.subcontratador_denominacion;
      }

      // Pagador de servicio (si indicador = 03)
      if (record.sunat_envio_indicador === '03') {
        if (record.pagador_servicio_documento_tipo_identidad) payload.pagador_servicio_documento_tipo_identidad = record.pagador_servicio_documento_tipo_identidad;
        if (record.pagador_servicio_documento_numero_identidad) payload.pagador_servicio_documento_numero_identidad = record.pagador_servicio_documento_numero_identidad;
        if (record.pagador_servicio_denominacion) payload.pagador_servicio_denominacion = record.pagador_servicio_denominacion;
      }
    }

    // Códigos de establecimiento (para motivos 04, 18)
    if (['04', '18'].includes(record.motivo_de_traslado)) {
      if (record.punto_de_partida_codigo_establecimiento_sunat) {
        payload.punto_de_partida_codigo_establecimiento_sunat = record.punto_de_partida_codigo_establecimiento_sunat;
      }
      if (record.punto_de_llegada_codigo_establecimiento_sunat) {
        payload.punto_de_llegada_codigo_establecimiento_sunat = record.punto_de_llegada_codigo_establecimiento_sunat;
      }
    }

    // Items
    payload.items = record.items.map((item: any) => ({
      unidad_de_medida: item.unidad_de_medida,
      descripcion: item.descripcion,
      cantidad: String(item.cantidad),
      ...(item.codigo && { codigo: item.codigo }),
      ...(item.codigo_dam && { codigo_dam: item.codigo_dam }),
    }));

    // Documentos relacionados
    if (record.documento_relacionado && record.documento_relacionado.length > 0) {
      payload.documento_relacionado = record.documento_relacionado.map((doc: any) => ({
        tipo: doc.tipo,
        serie: doc.serie,
        numero: String(doc.numero),
      }));
    }

    // Vehículos secundarios (máximo 2)
    if (record.vehiculos_secundarios && record.vehiculos_secundarios.length > 0) {
      payload.vehiculos_secundarios = record.vehiculos_secundarios.slice(0, 2).map((vehiculo: any) => ({
        placa_numero: vehiculo.placa_numero,
        ...(vehiculo.tuc && { tuc: vehiculo.tuc }),
      }));
    }

    // Conductores secundarios (máximo 2)
    if (record.conductores_secundarios && record.conductores_secundarios.length > 0) {
      payload.conductores_secundarios = record.conductores_secundarios.slice(0, 2).map((conductor: any) => ({
        documento_tipo: String(conductor.documento_tipo),
        documento_numero: conductor.documento_numero,
        nombre: conductor.nombre,
        apellidos: conductor.apellidos,
        numero_licencia: conductor.numero_licencia,
      }));
    }

    // Log final del payload antes de enviar a Kafka
    console.log('📤 [DETECTOR] Payload FINAL para Kafka/Nubefact:');
    console.log('   - fecha_de_emision:', payload.fecha_de_emision);
    console.log('   - fecha_de_inicio_de_traslado:', payload.fecha_de_inicio_de_traslado);

    return payload;
  }

  // Método manual para forzar detección (útil para testing)
  async forceDetection() {
    this.logger.log('Forzando detección de registros completos...');
    await this.detectCompleteRecords();
  }

  // Método para obtener estadísticas
  async getDetectionStats() {
    const pendientes = await this.prisma.guia_remision.count({
      where: { estado_gre: 'PENDIENTE' }
    });

    const procesando = await this.prisma.guia_remision.count({
      where: { estado_gre: 'PROCESANDO' }
    });

    const completados = await this.prisma.guia_remision.count({
      where: { estado_gre: 'COMPLETADO' }
    });

    const fallados = await this.prisma.guia_remision.count({
      where: { estado_gre: 'FALLADO' }
    });

    const sinProcesar = await this.prisma.guia_remision.count({
      where: { estado_gre: null }
    });

    return {
      pendientes,
      procesando,
      completados,
      fallados,
      sinProcesar,
      total: pendientes + procesando + completados + fallados + sinProcesar
    };
  }
}