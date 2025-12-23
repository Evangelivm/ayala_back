import { Injectable, BadRequestException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import type PDFKit from 'pdfkit';
import * as path from 'path';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { OrdenCompraData, DetalleItem } from './orden-compra.interfaces';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';

// Configurar plugins de dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class OrdenCompraService {
  constructor(
    private readonly prismaThird: PrismaThirdService,
    private readonly prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /**
   * Obtiene la fecha actual en formato YYYY-MM-DD en zona horaria de Lima
   */
  private obtenerFechaActual(): string {
    return dayjs().tz('America/Lima').format('YYYY-MM-DD');
  }

  /**
   * Obtiene el tipo de cambio oficial de SUNAT
   * Primero busca en la base de datos, si no existe o es de otro día, consulta a SUNAT
   * @returns Promise con el tipo de cambio (venta)
   */
  async obtenerTipoCambioSunat(): Promise<number> {
    const fechaActual = this.obtenerFechaActual();

    try {
      // Buscar en la base de datos el tipo de cambio del día actual
      const tipoCambioDB = await this.prismaThird.tipo_cambio.findFirst({
        where: {
          fecha: new Date(fechaActual),
        },
        orderBy: {
          id: 'desc',
        },
      });

      // Si existe y es del día actual, retornarlo
      if (tipoCambioDB && tipoCambioDB.tipo_cambio) {
        console.log(
          'Usando tipo de cambio desde BD:',
          tipoCambioDB.tipo_cambio,
        );
        return parseFloat(tipoCambioDB.tipo_cambio.toString());
      }

      // Si no existe, consultar a SUNAT
      console.log('Consultando tipo de cambio a SUNAT...');
      const response = await fetch(
        'https://www.sunat.gob.pe/a/txt/tipoCambio.txt',
      );
      const texto = await response.text();

      // El formato es: compra|venta
      const [compra, venta] = texto.trim().split('|').map(parseFloat);

      // Guardar en la base de datos
      await this.prismaThird.tipo_cambio.create({
        data: {
          fecha: new Date(fechaActual),
          tipo_cambio: venta,
        },
      });

      console.log('Tipo de cambio obtenido y guardado en BD:', venta);

      return venta;
    } catch (error) {
      console.error('Error al obtener tipo de cambio:', error);

      // En caso de error, intentar obtener el último tipo de cambio registrado
      try {
        const ultimoTipoCambio = await this.prismaThird.tipo_cambio.findFirst({
          orderBy: {
            fecha: 'desc',
          },
        });

        if (ultimoTipoCambio && ultimoTipoCambio.tipo_cambio) {
          console.log(
            'Usando último tipo de cambio registrado:',
            ultimoTipoCambio.tipo_cambio,
          );
          return parseFloat(ultimoTipoCambio.tipo_cambio.toString());
        }
      } catch (dbError) {
        console.error('Error al buscar tipo de cambio en BD:', dbError);
      }

      // Si todo falla, retornar 0
      return 0;
    }
  }

  /**
   * Obtiene todas las órdenes de compra
   * @returns Promise con array de órdenes de compra
   */
  async findAll() {
    try {
      const ordenes = await this.prismaThird.ordenes_compra.findMany({
        orderBy: {
          fecha_registro: 'desc',
        },
        include: {
          proveedores: true,
          detalles_orden_compra: true,
        },
      });

      // Mapear las órdenes para incluir el nombre_proveedor, ruc y los items al mismo nivel
      return ordenes.map((orden) => ({
        ...orden,
        nombre_proveedor: orden.proveedores?.nombre_proveedor || null,
        ruc_proveedor: orden.proveedores?.ruc || null,
        items: orden.detalles_orden_compra || [],
      }));
    } catch (error) {
      console.error('Error obteniendo órdenes de compra:', error);
      throw error;
    }
  }

  /**
   * Obtiene el siguiente número de orden disponible
   * @returns Promise con el siguiente número de orden en formato SERIE-NUMERO (ej: 0001-00009)
   */
  async obtenerSiguienteNumeroOrden(): Promise<{
    serie: string;
    nroDoc: string;
    numero_orden_completo: string;
  }> {
    try {
      // Obtener la última orden de compra registrada
      const ultimaOrden = await this.prismaThird.ordenes_compra.findFirst({
        orderBy: {
          id_orden_compra: 'desc',
        },
        select: {
          numero_orden: true,
        },
      });

      let serie = '0001';
      let siguienteNumero = 1;

      if (ultimaOrden && ultimaOrden.numero_orden) {
        // Separar serie y número del formato "0001-00008"
        const partes = ultimaOrden.numero_orden.split('-');
        if (partes.length === 2) {
          serie = partes[0];
          const ultimoNumero = parseInt(partes[1], 10);
          if (!isNaN(ultimoNumero)) {
            siguienteNumero = ultimoNumero + 1;
          }
        }
      }

      // Formatear el número con ceros a la izquierda (5 dígitos)
      const nroDoc = siguienteNumero.toString().padStart(5, '0');
      const numero_orden_completo = `${serie}-${nroDoc}`;

      return {
        serie,
        nroDoc,
        numero_orden_completo,
      };
    } catch (error) {
      console.error('Error obteniendo siguiente número de orden:', error);
      // En caso de error, retornar valores por defecto
      return {
        serie: '0001',
        nroDoc: '00001',
        numero_orden_completo: '0001-00001',
      };
    }
  }

  /**
   * Crea una nueva orden de compra con sus detalles
   * @param createOrdenCompraDto - Datos de la orden de compra a crear
   * @param usuarioId - ID del usuario que registra la orden
   * @returns Promise con la orden de compra creada
   */
  async create(createOrdenCompraDto: CreateOrdenCompraDto, usuarioId: number) {
    try {
      // Validar que el proveedor existe
      const proveedor = await this.prismaThird.proveedores.findUnique({
        where: { id_proveedor: createOrdenCompraDto.id_proveedor },
      });

      if (!proveedor) {
        throw new BadRequestException(
          `Proveedor con ID ${createOrdenCompraDto.id_proveedor} no encontrado`,
        );
      }

      // Validar que el número de orden no existe
      const ordenExistente = await this.prismaThird.ordenes_compra.findUnique({
        where: { numero_orden: createOrdenCompraDto.numero_orden },
      });

      if (ordenExistente) {
        throw new BadRequestException(
          `Ya existe una orden de compra con el número ${createOrdenCompraDto.numero_orden}`,
        );
      }

      // Validar que los items existen
      for (const item of createOrdenCompraDto.items) {
        const itemDB = await this.prismaThird.listado_items_2025.findUnique({
          where: { codigo: item.codigo_item },
        });

        if (!itemDB) {
          throw new BadRequestException(
            `Item con código ${item.codigo_item} no encontrado`,
          );
        }
      }

      // Obtener el tipo de cambio antes de crear la orden
      const tipoCambio = await this.obtenerTipoCambioSunat();

      // Crear la orden de compra con sus detalles en una transacción
      const ordenCompra = await this.prismaThird.$transaction(async (tx) => {
        // Crear la orden de compra
        const nuevaOrden = await tx.ordenes_compra.create({
          data: {
            numero_orden: createOrdenCompraDto.numero_orden,
            id_proveedor: createOrdenCompraDto.id_proveedor,
            fecha_orden: new Date(createOrdenCompraDto.fecha_orden),
            subtotal: createOrdenCompraDto.subtotal,
            igv: createOrdenCompraDto.igv,
            total: createOrdenCompraDto.total,
            estado: createOrdenCompraDto.estado as any,
            observaciones: createOrdenCompraDto.observaciones,
            fecha_registro: new Date(createOrdenCompraDto.fecha_registro),
            registrado_por: usuarioId,
            centro_costo_nivel1: createOrdenCompraDto.centro_costo_nivel1,
            centro_costo_nivel2: createOrdenCompraDto.centro_costo_nivel2,
            centro_costo_nivel3: createOrdenCompraDto.centro_costo_nivel3,
            moneda: createOrdenCompraDto.moneda,
            id_camion: createOrdenCompraDto.unidad_id,
            retencion: createOrdenCompraDto.retencion,
            porcentaje_valor_retencion:
              createOrdenCompraDto.porcentaje_valor_retencion,
            valor_retencion: createOrdenCompraDto.valor_retencion,
            almacen_central: createOrdenCompraDto.almacen_central,
            has_anticipo: createOrdenCompraDto.has_anticipo === 1,
            tiene_anticipo: createOrdenCompraDto.tiene_anticipo,
            tipo_cambio: tipoCambio,
          },
        });

        // Crear los detalles de la orden de compra
        const detallesCreados = await Promise.all(
          createOrdenCompraDto.items.map((item) =>
            tx.detalles_orden_compra.create({
              data: {
                id_orden_compra: nuevaOrden.id_orden_compra,
                codigo_item: item.codigo_item,
                descripcion_item: item.descripcion_item,
                cantidad_solicitada: item.cantidad_solicitada,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal,
              },
            }),
          ),
        );

        return {
          ...nuevaOrden,
          detalles: detallesCreados,
        };
      });

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();

      // Obtener el siguiente número de orden disponible y emitirlo a todos los clientes
      const siguienteNumero = await this.obtenerSiguienteNumeroOrden();
      this.websocketGateway.emitSiguienteNumeroOrdenCompra(siguienteNumero);

      return {
        success: true,
        message: 'Orden de compra creada exitosamente',
        data: ordenCompra,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error al crear orden de compra:', error);
      throw new BadRequestException(
        `Error al crear orden de compra: ${error.message}`,
      );
    }
  }

  async getMockData(id: string): Promise<OrdenCompraData> {
    // Obtener la orden de compra con los datos del proveedor y detalles
    const ordenCompra = await this.prismaThird.ordenes_compra.findUnique({
      where: { id_orden_compra: parseInt(id) },
      include: {
        proveedores: true,
        detalles_orden_compra: {
          include: {
            listado_items_2025: true,
          },
        },
      },
    });

    if (!ordenCompra) {
      throw new Error(`Orden de compra con ID ${id} no encontrada`);
    }

    // Usar el tipo de cambio guardado en la orden
    const tipoCambio = ordenCompra.tipo_cambio
      ? parseFloat(ordenCompra.tipo_cambio.toString())
      : 0;

    // Obtener las descripciones de los centros de costo
    let nivel1Descripcion = ordenCompra.centro_costo_nivel1 || '';
    let nivel2Descripcion = ordenCompra.centro_costo_nivel2 || '';
    let nivel3Descripcion = ordenCompra.centro_costo_nivel3 || '';

    // Buscar descripción de centroproyecto (Nivel 1)
    if (ordenCompra.centro_costo_nivel1) {
      const centroproyecto = await this.prisma.centroproyecto.findFirst({
        where: { codigo: ordenCompra.centro_costo_nivel1 },
      });
      if (centroproyecto) {
        nivel1Descripcion = centroproyecto.proyecto;
      }
    }

    // Buscar descripción de fasecontrol (Nivel 2)
    if (ordenCompra.centro_costo_nivel2) {
      const fasecontrol = await this.prisma.fasecontrol.findFirst({
        where: { codigo: ordenCompra.centro_costo_nivel2 },
      });
      if (fasecontrol && fasecontrol.descripcion) {
        nivel2Descripcion = fasecontrol.descripcion;
      }
    }

    // Buscar descripción de rubro (Nivel 3)
    if (ordenCompra.centro_costo_nivel3) {
      const rubro = await this.prisma.rubro.findFirst({
        where: { codigo: ordenCompra.centro_costo_nivel3 },
      });
      if (rubro) {
        nivel3Descripcion = rubro.descripcion;
      }
    }

    // Obtener datos del camión si existe id_camion
    let placaCamion = '';
    let placaMaquinaria = '';

    if (ordenCompra.id_camion) {
      const camion = await this.prisma.camiones.findUnique({
        where: { id_camion: ordenCompra.id_camion },
      });

      if (camion) {
        if (camion.tipo === 'CAMION') {
          placaCamion = camion.placa;
          placaMaquinaria = ''; // Dejar vacío
        } else if (camion.tipo === 'MAQUINARIA') {
          placaCamion = ''; // Dejar vacío
          placaMaquinaria = camion.placa;
        }
      }
    }

    const proveedor = ordenCompra.proveedores;

    // Formatear fecha_orden a DD/MM/YYYY en zona horaria de Lima
    const fechaEmisionFormateada = dayjs(ordenCompra.fecha_orden)
      .tz('America/Lima')
      .format('DD/MM/YYYY');

    return {
      header: {
        og: ordenCompra.numero_orden,
        fechaEmision: fechaEmisionFormateada,
        ruc: '20603739061',
      },
      datosProveedor: {
        empresa: proveedor.nombre_proveedor,
        ruc: proveedor.ruc || '',
        atencion: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
      },
      datosOrdenCompra: {
        direccion:
          'CALLE LOS ANDES NRO. 155 URB. SAN GREGORIO LIMA - LIMA - ATE',
        condicion: 'CREDITO',
        moneda: ordenCompra.moneda || '',
        tipoCambio: tipoCambio, // Usar el tipo de cambio de venta
        almacenCentral: ordenCompra.almacen_central?.toUpperCase() === 'SI',
      },
      observacion: {
        nivel1: nivel1Descripcion,
        nivel2: nivel2Descripcion,
        nivel3: nivel3Descripcion,
        observaciones: ordenCompra.observaciones || '',
        cuentaBancaria: proveedor.numero_cuenta_bancaria || '',
        placaCamion,
        placaMaquinaria,
      },
      detalleItems: ordenCompra.detalles_orden_compra.map((detalle, index) => ({
        numero: index + 1,
        descripcion: detalle.descripcion_item,
        codigo: detalle.codigo_item,
        unidadMedida: detalle.listado_items_2025.u_m || 'UND',
        cantidad: parseFloat(detalle.cantidad_solicitada.toString()),
        valorUnitario: parseFloat(detalle.precio_unitario.toString()),
        subTotal: parseFloat(detalle.subtotal.toString()),
      })),
      totales: (() => {
        const subtotal = parseFloat(ordenCompra.subtotal?.toString() || '0');
        const igv = parseFloat(ordenCompra.igv?.toString() || '0');
        const total = parseFloat(ordenCompra.total?.toString() || '0');

        // Verificar si hay retención basándose en el campo retencion de la orden
        const tieneRetencion = ordenCompra.retencion?.toUpperCase() === 'SI';
        const retencionPorcentaje = ordenCompra.porcentaje_valor_retencion
          ? parseFloat(ordenCompra.porcentaje_valor_retencion)
          : 3; // Valor por defecto si no está definido
        const retencionMonto = tieneRetencion
          ? (total * retencionPorcentaje) / 100
          : 0;
        const netoAPagar = total - retencionMonto;

        // Verificar si hay anticipo basándose en el campo has_anticipo de la orden
        const tieneAnticipo = ordenCompra.has_anticipo === true;

        return {
          subtotal,
          igv,
          total,
          proveedorAgenteRetencion: tieneRetencion,
          retencionPorcentaje,
          retencionMonto,
          netoAPagar,
          tieneAnticipo,
        };
      })(),
      firmas: {
        generaOrden: 'VLADIMIR',
        jefeAdministrativo: '',
        gerencia: '',
        jefeProyectos: '',
      },
    };
  }

  async generatePDF(ordenData: OrdenCompraData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
        });

        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ==================== HEADER ====================
        let yPos = 40;

        // Logo (izquierda)
        const logoPath = path.join(
          __dirname,
          '..',
          'assets',
          'ayala_logo.jpeg',
        );
        doc.image(logoPath, 40, yPos, {
          width: 100,
          height: 60,
        });

        // Título (izquierda) - alineado verticalmente con el logo
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('MAQUINARIAS AYALA S.A.C.', 150, yPos + 10);

        // Dirección (izquierda) - debajo del título
        doc.fontSize(8).font('Helvetica');
        doc.text(
          'CALLE LOS ANDES NRO. 155 URB. SAN GREGORIO LIMA - LIMA - ATE',
          150,
          yPos + 30,
          {
            width: 240,
          },
        );

        // ORDEN DE COMPRA (derecha)
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('ORDEN DE COMPRA', 400, yPos + 5, {
            align: 'center',
            width: 155,
          });

        // Tabla de header derecha
        const headerBoxX = 400;
        const headerBoxY = yPos + 25;
        const headerBoxWidth = 155;

        this.drawBox(doc, headerBoxX, headerBoxY, headerBoxWidth, 60);

        doc.fontSize(8).font('Helvetica');
        doc.text('OC:', headerBoxX + 5, headerBoxY + 5);
        doc.text(ordenData.header.og, headerBoxX + 80, headerBoxY + 5);

        doc.text('Fecha de emisión:', headerBoxX + 5, headerBoxY + 20);
        doc.text(
          ordenData.header.fechaEmision,
          headerBoxX + 80,
          headerBoxY + 20,
        );

        doc.text('RUC:', headerBoxX + 5, headerBoxY + 35);
        doc.text(ordenData.header.ruc, headerBoxX + 80, headerBoxY + 35);

        yPos = headerBoxY + 70;

        // ==================== DATOS DEL PROVEEDOR ====================
        this.drawSectionHeader(doc, 40, yPos, 'DATOS DEL PROVEEDOR', 515);
        yPos += 20;

        doc.fontSize(8).font('Helvetica');
        doc.text('EMPRESA:', 40, yPos);
        doc.text(ordenData.datosProveedor.empresa, 100, yPos);

        doc.text('RUC:', 40, yPos + 15);
        doc.text(ordenData.datosProveedor.ruc, 100, yPos + 15);

        doc.text('ATENCIÓN:', 40, yPos + 30);
        doc.text(ordenData.datosProveedor.atencion, 100, yPos + 30);

        doc.text('TELÉFONO:', 40, yPos + 45);
        doc.text(ordenData.datosProveedor.telefono || '', 100, yPos + 45);

        yPos += 70;

        // ==================== DATOS ORDEN DE COMPRA ====================
        this.drawSectionHeader(doc, 40, yPos, 'DATOS ORDEN DE COMPRA', 515);
        yPos += 20;

        doc.fontSize(8).font('Helvetica');
        doc.text('DIRECCIÓN:', 40, yPos);
        doc.text(ordenData.datosOrdenCompra.direccion, 100, yPos, {
          width: 450,
        });

        doc.text('CONDICIÓN:', 40, yPos + 15);
        doc.text(ordenData.datosOrdenCompra.condicion, 100, yPos + 15);

        doc.text('MONEDA:', 40, yPos + 30);
        doc.text(ordenData.datosOrdenCompra.moneda, 100, yPos + 30);

        // Si la moneda es DOLARES, mostrar cuadro rojo debajo
        if (ordenData.datosOrdenCompra.moneda.toUpperCase().includes('DOLAR')) {
          this.drawHighlightBox(doc, 100, yPos + 40, 60, 15, '#FF0000');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('DOLARES', 100, yPos + 43, {
            width: 60,
            align: 'center',
          });
          doc.fillColor('#000000');
        }

        // Mostrar tipo de cambio en amarillo solo si la moneda es DOLARES
        if (
          ordenData.datosOrdenCompra.moneda.toUpperCase().includes('DOLAR') &&
          ordenData.datosOrdenCompra.tipoCambio
        ) {
          this.drawHighlightBox(doc, 200, yPos + 25, 75, 20, '#FFFF00');
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(
              ordenData.datosOrdenCompra.tipoCambio.toFixed(3),
              205,
              yPos + 30,
              {
                width: 65,
                align: 'center',
              },
            );
        }

        yPos += 50;

        // Mostrar cuadro rojo ALMACEN CENTRAL si almacen_central es 'SI'
        if (ordenData.datosOrdenCompra.almacenCentral) {
          this.drawHighlightBox(doc, 40, yPos, 180, 25, '#FF0000');
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('ALMACEN CENTRAL', 40, yPos + 6, {
            width: 180,
            align: 'center',
          });
          doc.fillColor('#000000');
          yPos += 35;
        } else {
          yPos += 10;
        }

        // ==================== OBSERVACIÓN ====================
        this.drawSectionHeader(doc, 40, yPos, 'OBSERVACIÓN', 515);
        yPos += 20;

        // Tabla de niveles (5 columnas: A=Centro de Costos, B+C=Nivel 1, D=Nivel 2, E=Nivel 3)
        const nivelTableHeaders = [
          'Centro de Costos',
          'NIVEL 1',
          '', // Columna C (parte de Nivel 1)
          'NIVEL 2',
          'NIVEL 3',
        ];
        const nivelColWidths = [115, 85, 40, 137.5, 137.5]; // Total: 515 - Nivel 1 aumentado a 125px

        yPos = this.drawNivelesTable(
          doc,
          40,
          yPos,
          nivelTableHeaders,
          nivelColWidths,
          ordenData.observacion,
        );

        yPos += 10;

        // ==================== DETALLE DE LA ORDEN DE COMPRA ====================
        this.drawSectionHeader(
          doc,
          40,
          yPos,
          'DETALLE DE LA ORDEN DE COMPRA',
          515,
        );
        yPos += 20;

        const detalleHeaders = [
          'N°',
          'DESCRIPCIÓN',
          'CÓDIGO',
          'U/M',
          'CANT.',
          'VALOR UNIT',
          'SUB TOTAL',
        ];
        const detalleColWidths = [30, 180, 80, 80, 45, 50, 50];

        yPos = this.drawDetalleTable(
          doc,
          40,
          yPos,
          detalleHeaders,
          detalleColWidths,
          ordenData.detalleItems,
        );

        yPos += 10;

        // ==================== TOTALES ====================
        const totalesX = 425;

        doc.fontSize(8).font('Helvetica');
        doc.text('Subtotal:', totalesX, yPos);
        doc.text(ordenData.totales.subtotal.toFixed(2), totalesX + 80, yPos, {
          align: 'right',
          width: 50,
        });

        doc.text('Igvtotal:', totalesX, yPos + 15);
        doc.text(ordenData.totales.igv.toFixed(2), totalesX + 80, yPos + 15, {
          align: 'right',
          width: 50,
        });

        doc.text('Total:', totalesX, yPos + 30);
        doc.text(ordenData.totales.total.toFixed(2), totalesX + 80, yPos + 30, {
          align: 'right',
          width: 50,
        });

        yPos += 50;

        // Determinar posiciones para los cuadros de RETENCIÓN y ANTICIPO
        const tieneRetencion = ordenData.totales.proveedorAgenteRetencion;
        const tieneAnticipo = ordenData.totales.tieneAnticipo;

        // Si hay retención y anticipo, mostrar ambos cuadros lado a lado
        if (tieneRetencion && tieneAnticipo) {
          // Cuadro de RETENCIÓN (izquierda)
          this.drawHighlightBox(doc, 40, yPos - 5, 150, 25, '#FF0000');
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('RETENCIÓN', 40, yPos + 1, {
            width: 150,
            align: 'center',
          });
          doc.fillColor('#000000');

          // Cuadro de ANTICIPO (al lado de retención)
          this.drawHighlightBox(doc, 200, yPos - 5, 150, 25, '#FF0000');
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('ANTICIPO', 200, yPos + 1, {
            width: 150,
            align: 'center',
          });
          doc.fillColor('#000000');
        } else if (tieneRetencion) {
          // Solo retención
          this.drawHighlightBox(doc, 40, yPos - 5, 150, 25, '#FF0000');
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('RETENCIÓN', 40, yPos + 1, {
            width: 150,
            align: 'center',
          });
          doc.fillColor('#000000');
        } else if (tieneAnticipo) {
          // Solo anticipo (en la posición donde iría retención)
          this.drawHighlightBox(doc, 40, yPos - 5, 150, 25, '#FF0000');
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('ANTICIPO', 40, yPos + 1, {
            width: 150,
            align: 'center',
          });
          doc.fillColor('#000000');
        }

        // Solo mostrar campos de retención si proveedorAgenteRetencion es true
        if (ordenData.totales.proveedorAgenteRetencion) {
          doc.fontSize(8).font('Helvetica');
          doc.text(
            `Retención ${ordenData.totales.retencionPorcentaje}%:`,
            totalesX,
            yPos,
          );
          doc.text(
            ordenData.totales.retencionMonto.toFixed(2),
            totalesX + 80,
            yPos,
            { align: 'right', width: 50 },
          );

          doc.text('Neto a pagar:', totalesX, yPos + 15);
          this.drawHighlightBox(
            doc,
            totalesX + 95,
            yPos + 10,
            40,
            15,
            '#FFFF00',
          );
          doc
            .font('Helvetica-Bold')
            .text(
              ordenData.totales.netoAPagar.toFixed(2),
              totalesX + 95,
              yPos + 15,
              { align: 'center', width: 40 },
            );

          yPos += 60;
        } else {
          // Si no hay retención, solo mostrar el total como neto a pagar
          doc.fontSize(8).font('Helvetica');
          doc.text('Neto a pagar:', totalesX, yPos);
          this.drawHighlightBox(
            doc,
            totalesX + 95,
            yPos - 5,
            40,
            15,
            '#FFFF00',
          );
          doc
            .font('Helvetica-Bold')
            .text(ordenData.totales.total.toFixed(2), totalesX + 95, yPos, {
              align: 'center',
              width: 40,
            });

          yPos += 35;
        }

        yPos += 40; // Espacio adicional antes de las firmas

        // ==================== FIRMAS ====================
        // 4 firmas en una sola fila
        const pageWidth = 515; // Ancho total del contenido
        const firmaWidth = 110; // Ancho de cada firma
        const spacingBetween = 15; // Espacio entre firmas
        const totalFirmasWidth = firmaWidth * 4 + spacingBetween * 3;
        const startX = 40 + (pageWidth - totalFirmasWidth) / 2; // Centrar las 4 firmas

        const firmaLineY = yPos;

        doc.fontSize(8).font('Helvetica');

        // Firma 1: Genera orden
        const firma1X = startX;
        doc
          .moveTo(firma1X, firmaLineY)
          .lineTo(firma1X + firmaWidth, firmaLineY)
          .stroke();
        doc.text('Genera orden', firma1X, firmaLineY + 10, {
          width: firmaWidth,
          align: 'center',
        });
        if (ordenData.firmas.generaOrden) {
          doc
            .font('Helvetica-Bold')
            .text(ordenData.firmas.generaOrden, firma1X, firmaLineY + 25, {
              width: firmaWidth,
              align: 'center',
            });
          doc.font('Helvetica');
        }

        // Firma 2: Jefe Administrativo
        const firma2X = firma1X + firmaWidth + spacingBetween;
        doc
          .moveTo(firma2X, firmaLineY)
          .lineTo(firma2X + firmaWidth, firmaLineY)
          .stroke();
        doc.text('Jefe Administrativo', firma2X, firmaLineY + 10, {
          width: firmaWidth,
          align: 'center',
        });
        if (ordenData.firmas.jefeAdministrativo) {
          doc
            .font('Helvetica-Bold')
            .text(
              ordenData.firmas.jefeAdministrativo,
              firma2X,
              firmaLineY + 25,
              {
                width: firmaWidth,
                align: 'center',
              },
            );
          doc.font('Helvetica');
        }

        // Firma 3: Gerencia
        const firma3X = firma2X + firmaWidth + spacingBetween;
        doc
          .moveTo(firma3X, firmaLineY)
          .lineTo(firma3X + firmaWidth, firmaLineY)
          .stroke();
        doc.text('Gerencia', firma3X, firmaLineY + 10, {
          width: firmaWidth,
          align: 'center',
        });
        if (ordenData.firmas.gerencia) {
          doc
            .font('Helvetica-Bold')
            .text(ordenData.firmas.gerencia, firma3X, firmaLineY + 25, {
              width: firmaWidth,
              align: 'center',
            });
          doc.font('Helvetica');
        }

        // Firma 4: Jefe de Proyectos
        const firma4X = firma3X + firmaWidth + spacingBetween;
        doc
          .moveTo(firma4X, firmaLineY)
          .lineTo(firma4X + firmaWidth, firmaLineY)
          .stroke();
        doc.text('Jefe de Proyectos', firma4X, firmaLineY + 10, {
          width: firmaWidth,
          align: 'center',
        });
        if (ordenData.firmas.jefeProyectos) {
          doc
            .font('Helvetica-Bold')
            .text(ordenData.firmas.jefeProyectos, firma4X, firmaLineY + 25, {
              width: firmaWidth,
              align: 'center',
            });
          doc.font('Helvetica');
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private drawBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    doc.rect(x, y, width, height).stroke();
  }

  private drawHighlightBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) {
    doc.fillColor(color).rect(x, y, width, height).fill();
    doc.strokeColor('#000000').rect(x, y, width, height).stroke();
    doc.fillColor('#000000');
  }

  private drawSectionHeader(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    title: string,
    width: number,
  ) {
    doc.fillColor('#8B4513').rect(x, y, width, 15).fill();
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    doc.text(title, x + 5, y + 3, { width: width - 10 });
    doc.fillColor('#000000');
  }

  private drawNivelesTable(
    doc: PDFKit.PDFDocument,
    startX: number,
    startY: number,
    headers: string[],
    colWidths: number[],
    data: any,
  ): number {
    let currentY = startY;
    const baseRowHeight = 18;

    // Definir el color azul/gris del header (#D9E2F3 es un azul claro similar al de la imagen)
    const headerColor = '#D9E2F3';

    // Pre-calcular altura de fila 2 para ajustar la celda combinada "Centro de Costos"
    const nivel1Width = colWidths[1] + colWidths[2];
    const fontSize = 9;
    doc.fontSize(fontSize).font('Helvetica');

    const nivel1Lines = this.calculateTextLines(
      doc,
      data.nivel1 || '',
      nivel1Width - 4,
      fontSize,
    );
    const nivel2Lines = this.calculateTextLines(
      doc,
      data.nivel2 || '',
      colWidths[3] - 4,
      fontSize,
    );
    const nivel3Lines = this.calculateTextLines(
      doc,
      data.nivel3 || '',
      colWidths[4] - 4,
      fontSize,
    );

    const maxLines = Math.max(nivel1Lines, nivel2Lines, nivel3Lines);
    const row2Height = Math.max(baseRowHeight, maxLines * 12 + 6);

    // ===== FILA 1 - HEADERS =====
    // Columna A: "Centro de Costos" (combinada verticalmente con fila 2)
    const centroCostosHeight = baseRowHeight + row2Height;
    doc.rect(startX, currentY, colWidths[0], centroCostosHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(
      'Centro de Costos',
      startX + 2,
      currentY + centroCostosHeight / 2 - 5,
      {
        width: colWidths[0] - 4,
        align: 'center',
      },
    );

    // Columnas B+C: "Nivel 1" (combinadas horizontalmente) con fondo azul
    doc
      .fillColor(headerColor)
      .rect(startX + colWidths[0], currentY, nivel1Width, baseRowHeight)
      .fill();
    doc
      .strokeColor('#000000')
      .rect(startX + colWidths[0], currentY, nivel1Width, baseRowHeight)
      .stroke();
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
    doc.text('Nivel 1', startX + colWidths[0] + 2, currentY + 5, {
      width: nivel1Width - 4,
      align: 'center',
    });

    // Columna D: "Nivel 2" con fondo azul
    const xNivel2 = startX + colWidths[0] + nivel1Width;
    doc
      .fillColor(headerColor)
      .rect(xNivel2, currentY, colWidths[3], baseRowHeight)
      .fill();
    doc
      .strokeColor('#000000')
      .rect(xNivel2, currentY, colWidths[3], baseRowHeight)
      .stroke();
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
    doc.text('Nivel 2', xNivel2 + 2, currentY + 5, {
      width: colWidths[3] - 4,
      align: 'center',
    });

    // Columna E: "Nivel 3" con fondo azul
    const xNivel3 = xNivel2 + colWidths[3];
    doc
      .fillColor(headerColor)
      .rect(xNivel3, currentY, colWidths[4], baseRowHeight)
      .fill();
    doc
      .strokeColor('#000000')
      .rect(xNivel3, currentY, colWidths[4], baseRowHeight)
      .stroke();
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
    doc.text('Nivel 3', xNivel3 + 2, currentY + 5, {
      width: colWidths[4] - 4,
      align: 'center',
    });

    currentY += baseRowHeight;

    // ===== FILA 2 - Nivel1 / Nivel2 / Nivel3 =====
    // (altura ya calculada arriba como row2Height)
    // (xNivel2 y xNivel3 ya definidas arriba)

    // Columnas B+C: Nivel1 (combinadas horizontalmente)
    doc.rect(startX + colWidths[0], currentY, nivel1Width, row2Height).stroke();
    doc.fontSize(fontSize).font('Helvetica');
    doc.text(data.nivel1 || '', startX + colWidths[0] + 2, currentY + 5, {
      width: nivel1Width - 4,
      align: 'center',
    });

    // Columna D: Nivel2
    doc.rect(xNivel2, currentY, colWidths[3], row2Height).stroke();
    doc.fontSize(fontSize).font('Helvetica');
    doc.text(data.nivel2 || '', xNivel2 + 2, currentY + 5, {
      width: colWidths[3] - 4,
      align: 'center',
    });

    // Columna E: Nivel3
    doc.rect(xNivel3, currentY, colWidths[4], row2Height).stroke();
    doc.fontSize(fontSize).font('Helvetica');
    doc.text(data.nivel3 || '', xNivel3 + 2, currentY + 5, {
      width: colWidths[4] - 4,
      align: 'center',
    });

    currentY += row2Height;

    // ===== FILA 3 - PLACA / NA / MAQUINA / RB-001 =====
    // Columna A: "PLACA" (negrita)
    doc.rect(startX, currentY, colWidths[0], baseRowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('PLACA', startX + 2, currentY + 5, {
      width: colWidths[0] - 4,
      align: 'center',
    });

    // Columnas B+C: Placa del camión (combinadas horizontalmente)
    const placaWidth = colWidths[1] + colWidths[2];
    doc
      .rect(startX + colWidths[0], currentY, placaWidth, baseRowHeight)
      .stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.placaCamion || '', startX + colWidths[0] + 2, currentY + 5, {
      width: placaWidth - 4,
      align: 'center',
    });

    // Columna D: "MAQUINA" (negrita sin fondo de color)
    doc.rect(xNivel2, currentY, colWidths[3], baseRowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('MAQUINA', xNivel2 + 2, currentY + 5, {
      width: colWidths[3] - 4,
      align: 'center',
    });

    // Columna E: Placa de la maquinaria
    doc.rect(xNivel3, currentY, colWidths[4], baseRowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.placaMaquinaria || '', xNivel3 + 2, currentY + 5, {
      width: colWidths[4] - 4,
      align: 'center',
    });

    currentY += baseRowHeight;

    // ===== FILA 4 - CTA BCP: =====
    // Columna A: "CTA BCP:"
    doc.rect(startX, currentY, colWidths[0], baseRowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('CTA BCP:', startX + 5, currentY + 5, {
      width: colWidths[0] - 10,
      align: 'left',
    });

    // Columnas B+C+D+E: número de cuenta bancaria del proveedor
    const ctaBcpWidth =
      colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    doc
      .rect(startX + colWidths[0], currentY, ctaBcpWidth, baseRowHeight)
      .stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(
      data.cuentaBancaria || '',
      startX + colWidths[0] + 2,
      currentY + 5,
      {
        width: ctaBcpWidth - 4,
        align: 'center',
      },
    );

    currentY += baseRowHeight;

    // ===== FILA 5 - OBSERVACION: / Observaciones =====
    // Calcular altura necesaria para las observaciones
    const obsWidth = colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    const obsLines = this.calculateTextLines(
      doc,
      data.observaciones || '',
      obsWidth - 4,
      9,
    );
    const row5Height = Math.max(baseRowHeight, obsLines * 12 + 6);

    // Columna A: "OBSERVACION:"
    doc.rect(startX, currentY, colWidths[0], row5Height).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('OBSERVACION:', startX + 5, currentY + 5, {
      width: colWidths[0] - 10,
      align: 'left',
    });

    // Columnas B+C+D+E: Observaciones de la orden (todas combinadas)
    doc.rect(startX + colWidths[0], currentY, obsWidth, row5Height).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(
      data.observaciones || '',
      startX + colWidths[0] + 2,
      currentY + 5,
      {
        width: obsWidth - 4,
        align: 'center',
      },
    );

    currentY += row5Height;

    return currentY;
  }

  /**
   * Calcula cuántas líneas necesitará un texto dado un ancho específico
   */
  private calculateTextLines(
    doc: PDFKit.PDFDocument,
    text: string,
    maxWidth: number,
    fontSize: number,
  ): number {
    if (!text || text.trim() === '') return 1;

    doc.fontSize(fontSize);
    const words = text.split(' ');
    let lines = 1;
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.widthOfString(testLine);

      if (testWidth > maxWidth && currentLine !== '') {
        lines++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    return lines;
  }

  private drawDetalleTable(
    doc: PDFKit.PDFDocument,
    startX: number,
    startY: number,
    headers: string[],
    colWidths: number[],
    items: DetalleItem[],
  ): number {
    let currentY = startY;

    // Headers
    let currentX = startX;
    headers.forEach((header, index) => {
      doc.rect(currentX, currentY, colWidths[index], 18).stroke();
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text(header, currentX + 2, currentY + 5, {
        width: colWidths[index] - 4,
        align: 'center',
      });
      currentX += colWidths[index];
    });

    currentY += 18;

    // Data rows
    items.forEach((item) => {
      currentX = startX;
      const rowData = [
        item.numero.toString(),
        item.descripcion,
        item.codigo,
        item.unidadMedida,
        item.cantidad.toString(),
        item.valorUnitario.toFixed(4),
        item.subTotal.toFixed(4),
      ];

      rowData.forEach((cell, index) => {
        doc.rect(currentX, currentY, colWidths[index], 18).stroke();
        doc.fontSize(7).font('Helvetica');
        const align = index === 1 ? 'left' : index === 0 ? 'center' : 'right';
        doc.text(cell, currentX + 2, currentY + 5, {
          width: colWidths[index] - 4,
          align: align as any,
        });
        currentX += colWidths[index];
      });

      currentY += 18;
    });

    return currentY;
  }

  /**
   * Actualiza una orden de compra existente
   * @param id - ID de la orden de compra a actualizar
   * @param updateOrdenCompraDto - Datos para actualizar la orden de compra
   * @param usuarioId - ID del usuario que actualiza
   */
  async update(
    id: number,
    updateOrdenCompraDto: CreateOrdenCompraDto,
    usuarioId: number,
  ) {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Validar que el proveedor existe
      const proveedor = await this.prismaThird.proveedores.findUnique({
        where: { id_proveedor: updateOrdenCompraDto.id_proveedor },
      });

      if (!proveedor) {
        throw new BadRequestException(
          `Proveedor con ID ${updateOrdenCompraDto.id_proveedor} no encontrado`,
        );
      }

      // Validar que el número de orden no existe en otra orden
      const ordenConMismoNumero =
        await this.prismaThird.ordenes_compra.findUnique({
          where: { numero_orden: updateOrdenCompraDto.numero_orden },
        });

      if (ordenConMismoNumero) {
        // Convertir ambos IDs a número para comparación segura
        const idOrdenExistente = Number(ordenConMismoNumero.id_orden_compra);
        const idOrdenActual = Number(id);

        console.log(`🔍 Validación de duplicados:`);
        console.log(`   - Orden existente ID: ${idOrdenExistente}`);
        console.log(`   - Orden actual ID: ${idOrdenActual}`);
        console.log(`   - Número orden: ${updateOrdenCompraDto.numero_orden}`);
        console.log(
          `   - Son la misma orden: ${idOrdenExistente === idOrdenActual}`,
        );

        if (idOrdenExistente !== idOrdenActual) {
          throw new BadRequestException(
            `Ya existe otra orden de compra con el número ${updateOrdenCompraDto.numero_orden}`,
          );
        }
      }

      // Validar que los items existen
      for (const item of updateOrdenCompraDto.items) {
        const itemDB = await this.prismaThird.listado_items_2025.findUnique({
          where: { codigo: item.codigo_item },
        });

        if (!itemDB) {
          throw new BadRequestException(
            `Item con código ${item.codigo_item} no encontrado`,
          );
        }
      }

      // Obtener el tipo de cambio
      const tipoCambio = await this.obtenerTipoCambioSunat();

      // Actualizar la orden de compra con sus detalles en una transacción
      const ordenCompraActualizada = await this.prismaThird.$transaction(
        async (tx) => {
          // Actualizar la orden de compra
          const ordenActualizada = await tx.ordenes_compra.update({
            where: { id_orden_compra: id },
            data: {
              numero_orden: updateOrdenCompraDto.numero_orden,
              id_proveedor: updateOrdenCompraDto.id_proveedor,
              fecha_orden: new Date(updateOrdenCompraDto.fecha_orden),
              subtotal: updateOrdenCompraDto.subtotal,
              igv: updateOrdenCompraDto.igv,
              total: updateOrdenCompraDto.total,
              estado: updateOrdenCompraDto.estado as any,
              observaciones: updateOrdenCompraDto.observaciones,
              fecha_registro: new Date(updateOrdenCompraDto.fecha_registro),
              centro_costo_nivel1: updateOrdenCompraDto.centro_costo_nivel1,
              centro_costo_nivel2: updateOrdenCompraDto.centro_costo_nivel2,
              centro_costo_nivel3: updateOrdenCompraDto.centro_costo_nivel3,
              moneda: updateOrdenCompraDto.moneda,
              id_camion: updateOrdenCompraDto.unidad_id,
              retencion: updateOrdenCompraDto.retencion,
              porcentaje_valor_retencion:
                updateOrdenCompraDto.porcentaje_valor_retencion,
              valor_retencion: updateOrdenCompraDto.valor_retencion,
              almacen_central: updateOrdenCompraDto.almacen_central,
              has_anticipo: updateOrdenCompraDto.has_anticipo === 1,
              tiene_anticipo: updateOrdenCompraDto.tiene_anticipo,
              tipo_cambio: tipoCambio,
            },
            include: {
              proveedores: true,
            },
          });

          // Eliminar los detalles anteriores
          await tx.detalles_orden_compra.deleteMany({
            where: { id_orden_compra: id },
          });

          // Crear los nuevos detalles
          const detallesCreados = await Promise.all(
            updateOrdenCompraDto.items.map((item) =>
              tx.detalles_orden_compra.create({
                data: {
                  id_orden_compra: ordenActualizada.id_orden_compra,
                  codigo_item: item.codigo_item,
                  descripcion_item: item.descripcion_item,
                  cantidad_solicitada: item.cantidad_solicitada,
                  precio_unitario: item.precio_unitario,
                  subtotal: item.subtotal,
                },
              }),
            ),
          );

          // Retornar en el mismo formato que findAll
          return {
            ...ordenActualizada,
            nombre_proveedor:
              ordenActualizada.proveedores?.nombre_proveedor || null,
            ruc_proveedor: ordenActualizada.proveedores?.ruc || null,
            items: detallesCreados,
          };
        },
      );

      // Emitir evento WebSocket de actualización
      this.websocketGateway.emitOrdenCompraUpdate();

      console.log(
        `✅ Orden de compra ${ordenCompraActualizada.numero_orden} actualizada exitosamente`,
      );

      return ordenCompraActualizada;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error al actualizar orden de compra:', error);
      throw new BadRequestException(
        `Error al actualizar la orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Elimina una orden de compra y sus detalles
   * @param id - ID de la orden de compra a eliminar
   */
  async remove(id: number): Promise<void> {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Eliminar la orden de compra y sus detalles en una transacción
      await this.prismaThird.$transaction(async (tx) => {
        // Primero eliminar los detalles
        await tx.detalles_orden_compra.deleteMany({
          where: { id_orden_compra: id },
        });

        // Luego eliminar la orden
        await tx.ordenes_compra.delete({
          where: { id_orden_compra: id },
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error al eliminar orden de compra:', error);
      throw new BadRequestException(
        `Error al eliminar orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Aprueba una orden de compra para contabilidad
   * @param id - ID de la orden de compra a aprobar
   */
  async aprobarContabilidad(id: number): Promise<void> {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Actualizar el campo auto_contabilidad a 1
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { auto_contabilidad: true },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(
        'Error al aprobar orden de compra para contabilidad:',
        error,
      );
      throw new BadRequestException(
        `Error al aprobar orden de compra para contabilidad: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si una orden de compra debe cambiar su estado a COMPLETADA
   * Se cambia a COMPLETADA cuando:
   * - Tiene URL de factura (url_factura)
   * - Tiene URL de cotización (url_cotizacion)
   * - Tiene URL de operación (url)
   * - Hay 2 de 3 aprobaciones (auto_administrador, jefe_proyecto, auto_contabilidad)
   * @param id - ID de la orden de compra a verificar
   */
  private async verificarYActualizarEstadoCompletada(
    id: number,
  ): Promise<void> {
    try {
      const orden = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!orden) {
        return;
      }

      // Contar aprobaciones
      const aprobaciones = [
        orden.auto_administrador === true,
        orden.jefe_proyecto === true,
        orden.auto_contabilidad === true,
      ].filter(Boolean).length;

      // Verificar si cumple todas las condiciones para estar COMPLETADA
      if (
        orden.url_factura && // Tiene URL de factura
        orden.url_cotizacion && // Tiene URL de cotización
        orden.url && // Tiene URL de operación
        aprobaciones >= 2 // Al menos 2 de 3 aprobaciones
      ) {
        await this.prismaThird.ordenes_compra.update({
          where: { id_orden_compra: id },
          data: { estado: 'COMPLETADA' },
        });
      }
    } catch (error) {
      console.error(
        'Error al verificar y actualizar estado a COMPLETADA:',
        error,
      );
    }
  }

  /**
   * Migración: Actualiza todas las órdenes PENDIENTES que cumplan las condiciones a COMPLETADA
   * Esta función debe ejecutarse una sola vez después del cambio de lógica (sin anticipo)
   */
  async migrarOrdenesACompletada(): Promise<{ actualizadas: number; detalles: any[] }> {
    try {
      // Obtener todas las órdenes en estado PENDIENTE
      const ordenesPendientes = await this.prismaThird.ordenes_compra.findMany({
        where: { estado: 'PENDIENTE' },
      });

      const detalles: any[] = [];
      let actualizadas = 0;

      for (const orden of ordenesPendientes) {
        // Contar aprobaciones
        const aprobaciones = [
          orden.auto_administrador === true,
          orden.jefe_proyecto === true,
          orden.auto_contabilidad === true,
        ].filter(Boolean).length;

        // Verificar si cumple las condiciones para estar COMPLETADA
        const cumpleCondiciones =
          orden.url_factura &&
          orden.url_cotizacion &&
          orden.url &&
          aprobaciones >= 2;

        if (cumpleCondiciones) {
          await this.prismaThird.ordenes_compra.update({
            where: { id_orden_compra: orden.id_orden_compra },
            data: { estado: 'COMPLETADA' },
          });
          actualizadas++;
          detalles.push({
            id: orden.id_orden_compra,
            numero: orden.numero_orden,
            proveedor: orden.id_proveedor,
            aprobaciones,
          });
        }
      }

      // Emitir evento WebSocket
      if (actualizadas > 0) {
        this.websocketGateway.emitOrdenCompraUpdate();
      }

      return { actualizadas, detalles };
    } catch (error) {
      console.error('Error en migración de órdenes de compra:', error);
      throw new BadRequestException(
        `Error en migración: ${error.message}`,
      );
    }
  }

  /**
   * Aprueba una orden de compra para administración
   * @param id - ID de la orden de compra a aprobar
   */
  async aprobarAdministrador(id: number): Promise<void> {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Actualizar el campo auto_administrador a 1 (true)
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: {
          auto_administrador: true,
        },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(
        'Error al aprobar orden de compra para administración:',
        error,
      );
      throw new BadRequestException(
        `Error al aprobar orden de compra para administración: ${error.message}`,
      );
    }
  }

  /**
   * Marca una orden de compra como aprobada por jefe de proyecto
   * @param id - ID de la orden de compra a aprobar
   */
  async aprobarJefeProyecto(id: number): Promise<void> {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Actualizar el campo jefe_proyecto a 1 (true)
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: {
          jefe_proyecto: true,
        },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(
        'Error al aprobar orden de compra para jefe de proyecto:',
        error,
      );
      throw new BadRequestException(
        `Error al aprobar orden de compra para jefe de proyecto: ${error.message}`,
      );
    }
  }

  /**
   * Marca una orden de compra como transferida (Gerencia)
   * @param id - ID de la orden de compra a transferir
   */
  async transferirOrden(id: number): Promise<void> {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Actualizar el campo procede_pago a 'TRANSFERIR'
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { procede_pago: 'TRANSFERIR' },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error al transferir orden de compra:', error);
      throw new BadRequestException(
        `Error al transferir orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Marca una orden de compra como pagada
   * @param id - ID de la orden de compra a pagar
   */
  async pagarOrden(id: number): Promise<void> {
    try {
      // Verificar que la orden existe
      const ordenExiste = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
      });

      if (!ordenExiste) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      // Actualizar el campo procede_pago a 'PAGAR'
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { procede_pago: 'PAGAR' },
      });

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error al pagar orden de compra:', error);
      throw new BadRequestException(
        `Error al pagar orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene los datos de una orden de compra (numero_orden y fecha_registro)
   * @param id - ID de la orden de compra
   * @returns Datos de la orden (numero_orden, fecha_registro)
   */
  async getOrdenData(id: number): Promise<{
    numero_orden: string;
    fecha_registro: Date;
  }> {
    try {
      const orden = await this.prismaThird.ordenes_compra.findUnique({
        where: { id_orden_compra: id },
        select: {
          numero_orden: true,
          fecha_registro: true,
        },
      });

      if (!orden) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no encontrada`,
        );
      }

      if (!orden.fecha_registro) {
        throw new BadRequestException(
          `Orden de compra con ID ${id} no tiene fecha de registro`,
        );
      }

      return {
        numero_orden: orden.numero_orden,
        fecha_registro: orden.fecha_registro,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Error al obtener datos de la orden de compra:', error);
      throw new BadRequestException(
        `Error al obtener datos de la orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza la URL del archivo de una orden de compra
   * @param id - ID de la orden de compra
   * @param fileUrl - URL del archivo en Dropbox
   */
  async updateFileUrl(id: number, fileUrl: string): Promise<void> {
    try {
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { url: fileUrl },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      console.error('Error al actualizar URL de la orden de compra:', error);
      throw new BadRequestException(
        `Error al actualizar URL de la orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza la URL de cotización de una orden de compra
   * @param id - ID de la orden de compra
   * @param cotizacionUrl - URL de la cotización en Dropbox
   */
  async updateCotizacionUrl(id: number, cotizacionUrl: string): Promise<void> {
    try {
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { url_cotizacion: cotizacionUrl },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      console.error(
        'Error al actualizar URL de cotización de la orden de compra:',
        error,
      );
      throw new BadRequestException(
        `Error al actualizar URL de cotización de la orden de compra: ${error.message}`,
      );
    }
  }

  /**
   * Actualiza la URL de factura de una orden de compra
   * @param id - ID de la orden de compra
   * @param facturaUrl - URL de la factura en Dropbox
   */
  async updateFacturaUrl(id: number, facturaUrl: string): Promise<void> {
    try {
      await this.prismaThird.ordenes_compra.update({
        where: { id_orden_compra: id },
        data: { url_factura: facturaUrl },
      });

      // Verificar si debe cambiar a COMPLETADA
      await this.verificarYActualizarEstadoCompletada(id);

      // Emitir evento WebSocket para actualizar los clientes en tiempo real
      this.websocketGateway.emitOrdenCompraUpdate();
    } catch (error) {
      console.error(
        'Error al actualizar URL de factura de la orden de compra:',
        error,
      );
      throw new BadRequestException(
        `Error al actualizar URL de factura de la orden de compra: ${error.message}`,
      );
    }
  }
}
