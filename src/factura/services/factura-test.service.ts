import { Injectable, Logger } from '@nestjs/common';
import { PrismaThirdService } from '../../prisma/prisma-third.service';
import { FacturaDetectorService } from './factura-detector.service';
import { FacturaPollingService } from './factura-polling.service';

@Injectable()
export class FacturaTestService {
  private readonly logger = new Logger(FacturaTestService.name);

  constructor(
    private readonly prisma: PrismaThirdService,
    private readonly detectorService: FacturaDetectorService,
    private readonly pollingService: FacturaPollingService,
  ) {}

  /**
   * Crea una factura de prueba con datos de ejemplo
   * @param tipo - Tipo de comprobante (1=Factura, 2=Boleta)
   * @returns ID de la factura creada
   */
  async createTestFactura(tipo: number = 1): Promise<number> {
    try {
      this.logger.log(`Creando factura de prueba tipo ${tipo}...`);

      // 1. Obtener el primer proveedor disponible
      const proveedor = await this.prisma.proveedores.findFirst();
      if (!proveedor) {
        throw new Error('No se encontró ningún proveedor en la base de datos');
      }

      // 2. Obtener el último número de factura para la serie F001
      const serie = tipo === 1 ? 'F001' : 'B001';
      const ultimaFactura = await this.prisma.factura.findFirst({
        where: { serie },
        orderBy: { numero: 'desc' },
      });
      const siguienteNumero = (ultimaFactura?.numero || 0) + 1;

      // 3. Crear factura con estado NULL (será detectada automáticamente)
      const fechaActual = new Date();
      const factura = await this.prisma.factura.create({
        data: {
          estado_factura: null,
          tipo_de_comprobante: tipo,
          serie: serie,
          numero: siguienteNumero,
          id_proveedor: proveedor.id_proveedor,
          cliente_tipo_documento: tipo === 1 ? 6 : 1, // RUC para factura, DNI para boleta
          cliente_numero_documento: tipo === 1 ? '20123456789' : '12345678',
          cliente_denominacion:
            tipo === 1 ? 'EMPRESA DE PRUEBA SAC' : 'CLIENTE DE PRUEBA',
          cliente_direccion: 'AV. PRUEBA 123, LIMA',
          cliente_email: 'prueba@test.com',
          fecha_emision: fechaActual,
          moneda: 1, // PEN
          porcentaje_igv: 18.0,
          total_gravada: 100.0,
          total_igv: 18.0,
          total: 118.0,
          enviar_automaticamente_sunat: true,
          enviar_automaticamente_cliente: false,
        },
      });

      // 4. Crear items de prueba
      await this.prisma.factura_item.create({
        data: {
          id_factura: factura.id_factura,
          descripcion_item: 'PRODUCTO DE PRUEBA',
          unidad_medida: 'NIU', // Unidad
          cantidad: 1.0,
          valor_unitario: 100.0,
          precio_unitario: 118.0,
          subtotal: 100.0,
          tipo_de_igv: 10, // Gravado - Operación Onerosa
          igv: 18.0,
          total: 118.0,
          anticipo_regularizacion: false,
        },
      });

      this.logger.log(
        `Factura de prueba creada: ${serie}-${siguienteNumero} (ID: ${factura.id_factura})`,
      );
      return factura.id_factura;
    } catch (error) {
      this.logger.error('Error creando factura de prueba:', error);
      throw error;
    }
  }

  /**
   * Genera factura completa de ejemplo lista para enviar a NUBEFACT
   * @returns Objeto con factura de ejemplo
   */
  async generateSampleFactura(): Promise<any> {
    return {
      tipo_de_comprobante: 1, // Factura
      serie: 'F001',
      numero: 1,
      id_proveedor: 1,
      cliente_tipo_documento: 6, // RUC
      cliente_numero_documento: '20123456789',
      cliente_denominacion: 'EMPRESA DE PRUEBA SAC',
      cliente_direccion: 'AV. PRUEBA 123, LIMA',
      cliente_email: 'prueba@test.com',
      fecha_emision: '2025-12-11',
      moneda: 1, // PEN
      porcentaje_igv: 18.0,
      total_gravada: 100.0,
      total_igv: 18.0,
      total: 118.0,
      enviar_automaticamente_sunat: true,
      enviar_automaticamente_cliente: false,
      items: [
        {
          descripcion_item: 'PRODUCTO DE PRUEBA',
          unidad_medida: 'NIU', // Unidad
          cantidad: 1.0,
          valor_unitario: 100.0,
          precio_unitario: 118.0,
          subtotal: 100.0,
          tipo_de_igv: 10, // Gravado - Operación Onerosa
          igv: 18.0,
          total: 118.0,
          anticipo_regularizacion: false,
        },
      ],
    };
  }

  /**
   * Prueba el flujo completo de una factura
   * @param id_factura - ID de la factura a probar
   */
  async testFullFlow(id_factura: number): Promise<any> {
    try {
      this.logger.log(
        `Iniciando prueba de flujo completo para factura ${id_factura}`,
      );

      // 1. Verificar que la factura existe
      const factura = await this.prisma.factura.findUnique({
        where: { id_factura },
        include: { factura_item: true },
      });

      if (!factura) {
        throw new Error(`Factura ${id_factura} no encontrada`);
      }

      const resultado: any = {
        id_factura,
        serie_numero: `${factura.serie}-${factura.numero}`,
        paso1_factura_existe: true,
        estado_inicial: factura.estado_factura,
      };

      // 2. Si está en NULL, forzar detección
      if (factura.estado_factura === null) {
        this.logger.log('Estado NULL detectado, forzando detección...');
        const detectado = await this.detectorService.forceDetection(id_factura);
        resultado.paso2_forzar_deteccion = detectado;

        // Esperar un momento para que se procese
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 3. Obtener estado actualizado
      const facturaActualizada = await this.prisma.factura.findUnique({
        where: { id_factura },
      });

      resultado.estado_final = facturaActualizada?.estado_factura;
      resultado.enlace = facturaActualizada?.enlace;
      const pollingStats = this.pollingService.getPollingStats();
      resultado.polling_activo = pollingStats.tasks.some(
        (task) => task.recordId === id_factura,
      );

      // 4. Verificar transiciones de estado
      const estadosValidos = [
        null,
        'PENDIENTE',
        'PROCESANDO',
        'COMPLETADO',
        'FALLADO',
      ];
      resultado.estado_valido = estadosValidos.includes(
        resultado.estado_final,
      );

      this.logger.log('Prueba de flujo completada');
      this.logger.log(JSON.stringify(resultado, null, 2));

      return resultado;
    } catch (error) {
      this.logger.error('Error en prueba de flujo:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas generales del sistema
   */
  async getSystemStats() {
    try {
      const stats = {
        totalFacturas: await this.prisma.factura.count(),
        porEstado: {
          NULL: await this.prisma.factura.count({
            where: { estado_factura: null },
          }),
          PENDIENTE: await this.prisma.factura.count({
            where: { estado_factura: 'PENDIENTE' },
          }),
          PROCESANDO: await this.prisma.factura.count({
            where: { estado_factura: 'PROCESANDO' },
          }),
          COMPLETADO: await this.prisma.factura.count({
            where: { estado_factura: 'COMPLETADO' },
          }),
          FALLADO: await this.prisma.factura.count({
            where: { estado_factura: 'FALLADO' },
          }),
        },
        polling: this.pollingService.getPollingStats(),
        detector: await this.detectorService.getDetectionStats(),
      };

      return stats;
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Valida la estructura de una factura
   * @param facturaData - Datos de la factura
   */
  async validateFacturaStructure(facturaData: any): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validar campos requeridos
    const camposRequeridos = [
      'tipo_de_comprobante',
      'serie',
      'numero',
      'id_proveedor',
      'cliente_tipo_documento',
      'cliente_numero_documento',
      'cliente_denominacion',
      'fecha_emision',
      'moneda',
      'total',
    ];

    for (const campo of camposRequeridos) {
      if (
        facturaData[campo] === undefined ||
        facturaData[campo] === null ||
        facturaData[campo] === ''
      ) {
        errors.push(`Campo requerido faltante: ${campo}`);
      }
    }

    // Validar tipo de comprobante
    if (![1, 2, 3, 4].includes(facturaData.tipo_de_comprobante)) {
      errors.push(
        'tipo_de_comprobante debe ser 1 (Factura), 2 (Boleta), 3 (NC) o 4 (ND)',
      );
    }

    // Validar serie
    if (facturaData.serie && facturaData.serie.length !== 4) {
      errors.push('serie debe tener exactamente 4 caracteres');
    }

    // Validar cliente_tipo_documento
    if (![0, 1, 4, 6, 7].includes(facturaData.cliente_tipo_documento)) {
      errors.push(
        'cliente_tipo_documento debe ser 0, 1 (DNI), 4 (CE), 6 (RUC) o 7 (Pasaporte)',
      );
    }

    // Validar RUC para facturas
    if (
      facturaData.tipo_de_comprobante === 1 &&
      facturaData.cliente_tipo_documento !== 6
    ) {
      errors.push('Las facturas requieren cliente con RUC (tipo_documento = 6)');
    }

    // Validar moneda
    if (![1, 2].includes(facturaData.moneda)) {
      errors.push('moneda debe ser 1 (PEN) o 2 (USD)');
    }

    // Validar totales
    if (facturaData.total !== undefined && facturaData.total <= 0) {
      errors.push('total debe ser mayor a 0');
    }

    // Validar items (si existen)
    if (!facturaData.items || !Array.isArray(facturaData.items)) {
      errors.push('items debe ser un array');
    } else if (facturaData.items.length === 0) {
      errors.push('items no puede estar vacío');
    } else {
      facturaData.items.forEach((item: any, index: number) => {
        const camposRequeridosItem = [
          'descripcion_item',
          'unidad_medida',
          'cantidad',
          'valor_unitario',
          'precio_unitario',
          'tipo_de_igv',
          'subtotal',
          'igv',
          'total',
        ];

        for (const campo of camposRequeridosItem) {
          if (item[campo] === undefined || item[campo] === null) {
            errors.push(`Item ${index + 1}: falta campo ${campo}`);
          }
        }

        if (item.cantidad !== undefined && item.cantidad <= 0) {
          errors.push(`Item ${index + 1}: cantidad debe ser mayor a 0`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Resetea una factura fallida para reintento
   * @param id_factura - ID de la factura
   */
  async resetFailedFactura(id_factura: number): Promise<void> {
    try {
      await this.prisma.factura.update({
        where: { id_factura },
        data: {
          estado_factura: null,
          enlace: null,
          enlace_del_pdf: null,
          enlace_del_xml: null,
          enlace_del_cdr: null,
          sunat_description: null,
          sunat_note: null,
          sunat_responsecode: null,
          sunat_soap_error: null,
        },
      });

      this.logger.log(`Factura ${id_factura} reseteada para reintento`);
    } catch (error) {
      this.logger.error(`Error reseteando factura ${id_factura}:`, error);
      throw error;
    }
  }

  /**
   * Crea una boleta de prueba con datos de ejemplo
   * @returns ID de la boleta creada
   */
  async createTestBoleta(): Promise<number> {
    this.logger.log('Creando boleta de prueba (tipo 2)...');
    return this.createTestFactura(2);
  }

  /**
   * Crea una nota de crédito de prueba
   * @param id_factura_origen - ID de la factura que se modifica
   * @returns ID de la nota de crédito creada
   */
  async createTestNotaCredito(id_factura_origen?: number): Promise<number> {
    try {
      this.logger.log('Creando nota de crédito de prueba (tipo 3)...');

      // 1. Obtener el primer proveedor disponible
      const proveedor = await this.prisma.proveedores.findFirst();
      if (!proveedor) {
        throw new Error('No se encontró ningún proveedor en la base de datos');
      }

      // 2. Obtener el último número para la serie NC01
      const serie = 'NC01';
      const ultimaNC = await this.prisma.factura.findFirst({
        where: { serie },
        orderBy: { numero: 'desc' },
      });
      const siguienteNumero = (ultimaNC?.numero || 0) + 1;

      // 3. Si no se proporciona factura origen, buscar la última factura
      let facturaOrigen;
      if (id_factura_origen) {
        facturaOrigen = await this.prisma.factura.findUnique({
          where: { id_factura: id_factura_origen },
        });
      } else {
        facturaOrigen = await this.prisma.factura.findFirst({
          where: { tipo_de_comprobante: 1 },
          orderBy: { id_factura: 'desc' },
        });
      }

      // 4. Crear nota de crédito
      const fechaActual = new Date();
      const notaCredito = await this.prisma.factura.create({
        data: {
          estado_factura: null,
          tipo_de_comprobante: 3, // Nota de Crédito
          serie: serie,
          numero: siguienteNumero,
          id_proveedor: proveedor.id_proveedor,
          cliente_tipo_documento: 6, // RUC
          cliente_numero_documento: '20123456789',
          cliente_denominacion: 'EMPRESA DE PRUEBA SAC',
          cliente_direccion: 'AV. PRUEBA 123, LIMA',
          cliente_email: 'prueba@test.com',
          fecha_emision: fechaActual,
          moneda: 1, // PEN
          porcentaje_igv: 18.0,
          total_gravada: 50.0, // Monto parcial
          total_igv: 9.0,
          total: 59.0,
          enviar_automaticamente_sunat: true,
          enviar_automaticamente_cliente: false,
          // Campos específicos de NC (se manejan en el transformer)
          observaciones: facturaOrigen
            ? `Anulación parcial de ${facturaOrigen.serie}-${facturaOrigen.numero}`
            : 'Nota de crédito de prueba',
        },
      });

      // 5. Crear items de prueba
      await this.prisma.factura_item.create({
        data: {
          id_factura: notaCredito.id_factura,
          descripcion_item: 'DEVOLUCIÓN DE PRODUCTO DE PRUEBA',
          unidad_medida: 'NIU',
          cantidad: 1.0,
          valor_unitario: 50.0,
          precio_unitario: 59.0,
          subtotal: 50.0,
          tipo_de_igv: 10,
          igv: 9.0,
          total: 59.0,
          anticipo_regularizacion: false,
        },
      });

      this.logger.log(
        `Nota de crédito creada: ${serie}-${siguienteNumero} (ID: ${notaCredito.id_factura})`,
      );
      return notaCredito.id_factura;
    } catch (error) {
      this.logger.error('Error creando nota de crédito:', error);
      throw error;
    }
  }

  /**
   * Crea una nota de débito de prueba
   * @param id_factura_origen - ID de la factura que se modifica
   * @returns ID de la nota de débito creada
   */
  async createTestNotaDebito(id_factura_origen?: number): Promise<number> {
    try {
      this.logger.log('Creando nota de débito de prueba (tipo 4)...');

      // 1. Obtener el primer proveedor disponible
      const proveedor = await this.prisma.proveedores.findFirst();
      if (!proveedor) {
        throw new Error('No se encontró ningún proveedor en la base de datos');
      }

      // 2. Obtener el último número para la serie ND01
      const serie = 'ND01';
      const ultimaND = await this.prisma.factura.findFirst({
        where: { serie },
        orderBy: { numero: 'desc' },
      });
      const siguienteNumero = (ultimaND?.numero || 0) + 1;

      // 3. Si no se proporciona factura origen, buscar la última factura
      let facturaOrigen;
      if (id_factura_origen) {
        facturaOrigen = await this.prisma.factura.findUnique({
          where: { id_factura: id_factura_origen },
        });
      } else {
        facturaOrigen = await this.prisma.factura.findFirst({
          where: { tipo_de_comprobante: 1 },
          orderBy: { id_factura: 'desc' },
        });
      }

      // 4. Crear nota de débito
      const fechaActual = new Date();
      const notaDebito = await this.prisma.factura.create({
        data: {
          estado_factura: null,
          tipo_de_comprobante: 4, // Nota de Débito
          serie: serie,
          numero: siguienteNumero,
          id_proveedor: proveedor.id_proveedor,
          cliente_tipo_documento: 6, // RUC
          cliente_numero_documento: '20123456789',
          cliente_denominacion: 'EMPRESA DE PRUEBA SAC',
          cliente_direccion: 'AV. PRUEBA 123, LIMA',
          cliente_email: 'prueba@test.com',
          fecha_emision: fechaActual,
          moneda: 1, // PEN
          porcentaje_igv: 18.0,
          total_gravada: 20.0, // Cargo adicional
          total_igv: 3.6,
          total: 23.6,
          enviar_automaticamente_sunat: true,
          enviar_automaticamente_cliente: false,
          // Campos específicos de ND (se manejan en el transformer)
          observaciones: facturaOrigen
            ? `Cargo adicional para ${facturaOrigen.serie}-${facturaOrigen.numero}`
            : 'Nota de débito de prueba',
        },
      });

      // 5. Crear items de prueba
      await this.prisma.factura_item.create({
        data: {
          id_factura: notaDebito.id_factura,
          descripcion_item: 'CARGO ADICIONAL DE PRUEBA',
          unidad_medida: 'NIU',
          cantidad: 1.0,
          valor_unitario: 20.0,
          precio_unitario: 23.6,
          subtotal: 20.0,
          tipo_de_igv: 10,
          igv: 3.6,
          total: 23.6,
          anticipo_regularizacion: false,
        },
      });

      this.logger.log(
        `Nota de débito creada: ${serie}-${siguienteNumero} (ID: ${notaDebito.id_factura})`,
      );
      return notaDebito.id_factura;
    } catch (error) {
      this.logger.error('Error creando nota de débito:', error);
      throw error;
    }
  }
}
