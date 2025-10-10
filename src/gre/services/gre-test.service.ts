import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GreRemitenteTestData,
  GreTransportistaTestData,
} from '../dto/create-gre-test.dto';

@Injectable()
export class GreTestService {
  private readonly logger = new Logger(GreTestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Formatea una fecha al formato DD-MM-YYYY requerido por Nubefact
   */
  private formatDateForNubefact(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Retorna un objeto Date para Prisma (solo con la fecha, sin hora)
   */
  private formatDateForPrisma(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return new Date(year, month, day);
  }

  /**
   * Genera datos de prueba para GRE Remitente (tipo 7)
   * Caso: Transporte PRIVADO (tipo_de_transporte = "02")
   *
   * ✅ IMPORTANTE: Para transporte PRIVADO, el conductor es OBLIGATORIO
   * ✅ NO se requieren datos del transportista (RUC)
   */
  generateGreRemitentePrivadoTestData(): GreRemitenteTestData {
    const now = new Date();
    const randomNum = Math.floor(Math.random() * 200) + 1;
    const fechaFormateada = this.formatDateForNubefact(now);

    return {
      operacion: 'generar_guia',
      tipo_de_comprobante: 7,
      serie: 'TTT1',
      numero: 31,

      // Cliente (Destinatario)
      cliente_tipo_de_documento: 6, // RUC
      cliente_numero_de_documento: '20600695771',
      cliente_denominacion: 'NUBEFACT SA',
      cliente_direccion: 'MIRAFLORES LIMA',
      cliente_email: '',

      // Fechas (formato DD-MM-YYYY)
      fecha_de_emision: fechaFormateada,
      fecha_de_inicio_de_traslado: fechaFormateada,

      // Traslado (Obligatorio GRE Remitente)
      motivo_de_traslado: '13', // Traslado entre establecimientos
      numero_de_bultos: 1,
      tipo_de_transporte: '02', // ✅ PRIVADO

      // Peso
      peso_bruto_total: 1.5,
      peso_bruto_unidad_de_medida: 'TNE',

      // Transporte
      transportista_placa_numero: 'ABC444',
      // ✅ NO incluir transportista_documento_tipo, transportista_documento_numero, transportista_denominacion
      // porque es transporte PRIVADO

      // Conductor (Obligatorio para tipo_de_transporte = "02")
      conductor_documento_tipo: 1, // DNI
      conductor_documento_numero: '12345678',
      conductor_nombre: 'JUAN',
      conductor_apellidos: 'PEREZ LOPEZ',
      conductor_numero_licencia: 'Q12345678',

      // Ubicaciones
      punto_de_partida_ubigeo: '151021', // Lima - Lima - Lima
      punto_de_partida_direccion: 'AV. LARCO 123, MIRAFLORES',
      punto_de_partida_codigo_establecimiento_sunat: '0000',
      punto_de_llegada_ubigeo: '150101', // Lima - Lima - Lima Cercado
      punto_de_llegada_direccion: 'JR. DE LA UNION 456, CERCADO',
      punto_de_llegada_codigo_establecimiento_sunat: '0000',

      // Observaciones
      observaciones: 'GRE REMITENTE PRIVADO - PRUEBA KAFKA',

      // Items
      items: [
        {
          unidad_de_medida: 'NIU',
          codigo: 'PROD001',
          descripcion: 'MERCADERÍA PARA ENTREGA PRIVADA',
          cantidad: 2,
        },
        {
          unidad_de_medida: 'NIU',
          codigo: 'PROD002',
          descripcion: 'PRODUCTO COMPLEMENTARIO',
          cantidad: 1,
        },
      ],

      // Documento relacionado (Opcional)
      documento_relacionado: [
        {
          tipo: '01', // Factura
          serie: 'F001',
          numero: 123,
        },
      ],
    };
  }

  /**
   * Genera datos de prueba para GRE Remitente (tipo 7)
   * Caso: Transporte PÚBLICO (tipo_de_transporte = "01")
   */
  generateGreRemitentePublicoTestData(): GreRemitenteTestData {
    const now = new Date();
    const randomNum = Math.floor(Math.random() * 200) + 1;
    const fechaFormateada = this.formatDateForNubefact(now);

    return {
      operacion: 'generar_guia',
      tipo_de_comprobante: 7,
      serie: 'TTT1',
      numero: randomNum,

      // Cliente (Destinatario)
      cliente_tipo_de_documento: 6, // RUC
      cliente_numero_de_documento: '20600695771',
      cliente_denominacion: 'NUBEFACT SA',
      cliente_direccion: 'MIRAFLORES LIMA',
      cliente_email: 'demo@gmail.com',

      // Fechas (formato DD-MM-YYYY)
      fecha_de_emision: fechaFormateada,
      fecha_de_inicio_de_traslado: fechaFormateada,

      // Traslado
      motivo_de_traslado: '01', // Venta
      numero_de_bultos: 1,
      tipo_de_transporte: '01', // Público

      // Peso
      peso_bruto_total: 1.0,
      peso_bruto_unidad_de_medida: 'KGM',

      // Transporte
      transportista_placa_numero: 'ABC444',

      // Transportista (Obligatorio porque tipo_de_transporte = "01")
      transportista_documento_tipo: 6, // RUC
      transportista_documento_numero: '20600695771',
      transportista_denominacion: 'NUBEFACT SA',

      // Conductor (para transporte público)
      conductor_documento_tipo: 1, // DNI
      conductor_documento_numero: '12345678',
      conductor_denominacion: 'JORGE LOPEZ',
      conductor_nombre: 'JORGE',
      conductor_apellidos: 'LOPEZ',
      conductor_numero_licencia: 'Q12345678',

      // Ubicaciones
      punto_de_partida_ubigeo: '151021',
      punto_de_partida_direccion: 'DIRECCION PARTIDA',
      punto_de_partida_codigo_establecimiento_sunat: '0000',
      punto_de_llegada_ubigeo: '211101',
      punto_de_llegada_direccion: 'DIRECCION LLEGADA',
      punto_de_llegada_codigo_establecimiento_sunat: '0000',

      // Observaciones
      observaciones: 'observaciones',

      // Items
      items: [
        {
          unidad_de_medida: 'NIU',
          codigo: '001',
          descripcion: 'DETALLE DEL PRODUCTO 1',
          cantidad: 1,
        },
        {
          unidad_de_medida: 'NIU',
          codigo: '002',
          descripcion: 'DETALLE DEL PRODUCTO 2',
          cantidad: 1,
        },
      ],

      // Documento relacionado
      documento_relacionado: [
        {
          tipo: '01', // Factura
          serie: 'F001',
          numero: 1,
        },
        {
          tipo: '01',
          serie: 'F001',
          numero: 2,
        },
      ],
    };
  }

  /**
   * Genera datos de prueba para GRE Transportista (tipo 8)
   */
  generateGreTransportistaTestData(): GreTransportistaTestData {
    const now = new Date();
    const randomNum = Math.floor(Math.random() * 200) + 1;
    const fechaFormateada = this.formatDateForNubefact(now);

    return {
      operacion: 'generar_guia',
      tipo_de_comprobante: 8,
      serie: 'V001',
      numero: randomNum,

      // Cliente (Remitente)
      cliente_tipo_de_documento: 6, // RUC
      cliente_numero_de_documento: '20111111116',
      cliente_denominacion: 'EMPRESA REMITENTE TEST SAC',
      cliente_direccion: 'AV. REMITENTE 999, LIMA',
      cliente_email: 'remitente@test.com',

      // Fechas (formato DD-MM-YYYY)
      fecha_de_emision: fechaFormateada,
      fecha_de_inicio_de_traslado: fechaFormateada,

      // Peso
      peso_bruto_total: 1.25,
      peso_bruto_unidad_de_medida: 'KGM',

      // Transporte
      transportista_placa_numero: 'DEF456',
      tuc_vehiculo_principal: 'TUC1234567890',

      // Conductor (Obligatorio para GRE Transportista)
      conductor_documento_tipo: 1, // DNI
      conductor_documento_numero: '87654321',
      conductor_denominacion: 'CARLOS MARTINEZ ROJAS',
      conductor_nombre: 'CARLOS',
      conductor_apellidos: 'MARTINEZ ROJAS',
      conductor_numero_licencia: 'Q87654321',

      // Destinatario (Obligatorio para GRE Transportista)
      destinatario_documento_tipo: 6, // RUC
      destinatario_documento_numero: '20222222226',
      destinatario_denominacion: 'EMPRESA DESTINATARIO TRANS SAC',

      // Ubicaciones
      punto_de_partida_ubigeo: '150105', // Lima - Lima - Breña
      punto_de_partida_direccion: 'AV. BRASIL 123, BREÑA',
      punto_de_partida_codigo_establecimiento_sunat: '0000',
      punto_de_llegada_ubigeo: '150106', // Lima - Lima - Cercado de Lima
      punto_de_llegada_direccion: 'JR. LAMPA 456, CERCADO',
      punto_de_llegada_codigo_establecimiento_sunat: '0000',

      // Observaciones
      observaciones: 'GRE TRANSPORTISTA - PRUEBA KAFKA',

      // Items
      items: [
        {
          unidad_de_medida: 'NIU',
          codigo: 'CARGA001',
          descripcion: 'CARGA GENERAL - MERCADERÍA',
          cantidad: 1,
        },
      ],

      // Documento relacionado
      documento_relacionado: [
        {
          tipo: '09', // Guía de Remisión Remitente
          serie: 'T001',
          numero: 999,
        },
      ],
    };
  }

  /**
   * Inserta GRE de prueba en la base de datos
   * @param tipo - 'privado' para transporte privado (tipo_de_transporte="02"), 'publico' para transporte público (tipo_de_transporte="01")
   */
  async createTestGreRemitente(
    tipo: 'privado' | 'publico' = 'publico', // ✅ Default PUBLICO para no romper nada existente
  ): Promise<any> {
    try {
      const testData =
        tipo === 'privado'
          ? this.generateGreRemitentePrivadoTestData() // ✅ NUEVO - Transporte PRIVADO
          : this.generateGreRemitentePublicoTestData(); // ✅ Ya existente - Transporte PÚBLICO

      this.logger.log(
        `Creando GRE Remitente de prueba (transporte ${tipo.toUpperCase()}): ${testData.serie}-${testData.numero}`,
      );

      console.log(
        `📦 [GRE-TEST] Datos generados para GRE Remitente ${tipo.toUpperCase()}:`,
        JSON.stringify(testData, null, 2),
      );

      // Insertar en guia_remision con sus relaciones
      const greRecord = await this.prisma.guia_remision.create({
        data: {
          // Datos principales
          operacion: testData.operacion,
          tipo_de_comprobante: testData.tipo_de_comprobante,
          serie: testData.serie,
          numero: testData.numero,

          // Cliente
          cliente_tipo_de_documento: testData.cliente_tipo_de_documento,
          cliente_numero_de_documento: testData.cliente_numero_de_documento,
          cliente_denominacion: testData.cliente_denominacion,
          cliente_direccion: testData.cliente_direccion,
          cliente_email: testData.cliente_email,

          // Fechas (convertir a ISO-8601 para Prisma)
          fecha_de_emision: this.formatDateForPrisma(new Date()),
          fecha_de_inicio_de_traslado: this.formatDateForPrisma(new Date()),

          // Traslado
          motivo_de_traslado: testData.motivo_de_traslado,
          numero_de_bultos: testData.numero_de_bultos,
          tipo_de_transporte: testData.tipo_de_transporte,

          // Peso
          peso_bruto_total: testData.peso_bruto_total,
          peso_bruto_unidad_de_medida: testData.peso_bruto_unidad_de_medida,

          // Transporte
          transportista_placa_numero: testData.transportista_placa_numero,
          transportista_documento_tipo: testData.transportista_documento_tipo,
          transportista_documento_numero:
            testData.transportista_documento_numero,
          transportista_denominacion: testData.transportista_denominacion,

          // Conductor
          conductor_documento_tipo: testData.conductor_documento_tipo,
          conductor_documento_numero: testData.conductor_documento_numero,
          conductor_denominacion: testData.conductor_denominacion,
          conductor_nombre: testData.conductor_nombre,
          conductor_apellidos: testData.conductor_apellidos,
          conductor_numero_licencia: testData.conductor_numero_licencia,

          // Ubicaciones
          punto_de_partida_ubigeo: testData.punto_de_partida_ubigeo,
          punto_de_partida_direccion: testData.punto_de_partida_direccion,
          punto_de_llegada_ubigeo: testData.punto_de_llegada_ubigeo,
          punto_de_llegada_direccion: testData.punto_de_llegada_direccion,

          // Observaciones
          observaciones: testData.observaciones,

          // Estado inicial: NULL para que sea detectado
          estado_gre: null,

          // Items (relación)
          items: {
            create: testData.items.map((item, index) => ({
              unidad_de_medida: item.unidad_de_medida,
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              orden: index + 1,
            })),
          },

          // Documentos relacionados (si existen)
          documento_relacionado: testData.documento_relacionado
            ? {
                create: testData.documento_relacionado.map((doc) => ({
                  tipo: doc.tipo,
                  serie: doc.serie,
                  numero: doc.numero,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
          documento_relacionado: true,
        },
      });

      this.logger.log(
        `✅ GRE Remitente creado exitosamente con ID: ${greRecord.id_guia}`,
      );

      return greRecord;
    } catch (error) {
      this.logger.error('Error creando GRE Remitente de prueba:', error);
      throw error;
    }
  }

  async createTestGreTransportista(): Promise<any> {
    try {
      const testData = this.generateGreTransportistaTestData();

      this.logger.log(
        `Creando GRE Transportista de prueba: ${testData.serie}-${testData.numero}`,
      );

      console.log(
        '📦 [GRE-TEST] Datos generados para GRE Transportista:',
        JSON.stringify(testData, null, 2),
      );

      const greRecord = await this.prisma.guia_remision.create({
        data: {
          // Datos principales
          operacion: testData.operacion,
          tipo_de_comprobante: testData.tipo_de_comprobante,
          serie: testData.serie,
          numero: testData.numero,

          // Cliente (Remitente)
          cliente_tipo_de_documento: testData.cliente_tipo_de_documento,
          cliente_numero_de_documento: testData.cliente_numero_de_documento,
          cliente_denominacion: testData.cliente_denominacion,
          cliente_direccion: testData.cliente_direccion,
          cliente_email: testData.cliente_email,

          // Fechas (convertir a ISO-8601 para Prisma)
          fecha_de_emision: this.formatDateForPrisma(new Date()),
          fecha_de_inicio_de_traslado: this.formatDateForPrisma(new Date()),

          // Peso
          peso_bruto_total: testData.peso_bruto_total,
          peso_bruto_unidad_de_medida: testData.peso_bruto_unidad_de_medida,

          // Transporte
          transportista_placa_numero: testData.transportista_placa_numero,
          tuc_vehiculo_principal: testData.tuc_vehiculo_principal,

          // Conductor (Obligatorio)
          conductor_documento_tipo: testData.conductor_documento_tipo,
          conductor_documento_numero: testData.conductor_documento_numero,
          conductor_denominacion: testData.conductor_denominacion,
          conductor_nombre: testData.conductor_nombre,
          conductor_apellidos: testData.conductor_apellidos,
          conductor_numero_licencia: testData.conductor_numero_licencia,

          // Destinatario (Obligatorio)
          destinatario_documento_tipo: testData.destinatario_documento_tipo,
          destinatario_documento_numero: testData.destinatario_documento_numero,
          destinatario_denominacion: testData.destinatario_denominacion,

          // Ubicaciones
          punto_de_partida_ubigeo: testData.punto_de_partida_ubigeo,
          punto_de_partida_direccion: testData.punto_de_partida_direccion,
          punto_de_llegada_ubigeo: testData.punto_de_llegada_ubigeo,
          punto_de_llegada_direccion: testData.punto_de_llegada_direccion,

          // Observaciones
          observaciones: testData.observaciones,

          // Estado inicial: NULL
          estado_gre: null,

          // Items
          items: {
            create: testData.items.map((item, index) => ({
              unidad_de_medida: item.unidad_de_medida,
              codigo: item.codigo,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              orden: index + 1,
            })),
          },

          // Documentos relacionados
          documento_relacionado: testData.documento_relacionado
            ? {
                create: testData.documento_relacionado.map((doc) => ({
                  tipo: doc.tipo,
                  serie: doc.serie,
                  numero: doc.numero,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
          documento_relacionado: true,
        },
      });

      this.logger.log(
        `✅ GRE Transportista creado exitosamente con ID: ${greRecord.id_guia}`,
      );

      return greRecord;
    } catch (error) {
      this.logger.error('Error creando GRE Transportista de prueba:', error);
      throw error;
    }
  }
}
