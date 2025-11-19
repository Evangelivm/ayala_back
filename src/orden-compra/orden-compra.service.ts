import { Injectable, BadRequestException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import type PDFKit from 'pdfkit';
import { OrdenCompraData, DetalleItem } from './orden-compra.interfaces';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';

@Injectable()
export class OrdenCompraService {
  constructor(
    private readonly prismaThird: PrismaThirdService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Obtiene la fecha actual en formato YYYY-MM-DD
   */
  private obtenerFechaActual(): string {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        },
      });

      return ordenes;
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

    // Obtener el tipo de cambio de SUNAT
    const tipoCambio = await this.obtenerTipoCambioSunat();

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

    const proveedor = ordenCompra.proveedores;
    return {
      header: {
        og: ordenCompra.numero_orden,
        fechaEmision: '08/11/2025',
        ruc: '20602739061',
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
        condicion: 'CONTADO',
        moneda: 'S/. SOLES',
        tipoCambio: tipoCambio, // Usar el tipo de cambio de venta
      },
      observacion: {
        nivel1: nivel1Descripcion,
        nivel2: nivel2Descripcion,
        nivel3: nivel3Descripcion,
        observaciones: ordenCompra.observaciones || '',
        cuentaBancaria: proveedor.numero_cuenta_bancaria || '',
      },
      detalleItems: ordenCompra.detalles_orden_compra.map((detalle, index) => ({
        numero: index + 1,
        descripcion: detalle.descripcion_item,
        codigo: detalle.codigo_item,
        unidadMedida: detalle.listado_items_2025.u_m || 'UND',
        cantidad: detalle.cantidad_solicitada,
        valorUnitario: parseFloat(detalle.precio_unitario.toString()),
        subTotal: parseFloat(detalle.subtotal.toString()),
      })),
      totales: (() => {
        const subtotal = parseFloat(ordenCompra.subtotal?.toString() || '0');
        const igv = parseFloat(ordenCompra.igv?.toString() || '0');
        const total = parseFloat(ordenCompra.total?.toString() || '0');
        const proveedorAgenteRetencion = true; // TODO: Obtener de la tabla proveedores si se agrega este campo
        const retencionPorcentaje = 3;
        const retencionMonto = proveedorAgenteRetencion
          ? (total * retencionPorcentaje) / 100
          : 0;
        const netoAPagar = total - retencionMonto;

        return {
          subtotal,
          igv,
          total,
          proveedorAgenteRetencion,
          retencionPorcentaje,
          retencionMonto,
          netoAPagar,
        };
      })(),
      firmas: {
        generaOrden: 'VLADIMIR',
        jefeAdministrativo: '',
        gerencia: '',
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

        // Logo y título (izquierda)
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('MAQUINARIAS AYALA', 40, yPos);

        doc
          .fontSize(10)
          .font('Helvetica')
          .text('', 40, yPos + 18);

        // Dirección (izquierda)
        doc.fontSize(9).font('Helvetica');
        doc.text(
          'CALLOS ANDES NRO. 155 URB. SAN GREGORIO LIMA - LIMA - ATE',
          40,
          yPos + 22,
          {
            width: 350,
          },
        );

        // ORDEN DE COMPRA (derecha)
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('ORDEN DE COMPRA', 400, yPos, { align: 'center', width: 155 });

        // Tabla de header derecha
        const headerBoxX = 400;
        const headerBoxY = yPos + 20;
        const headerBoxWidth = 155;

        this.drawBox(doc, headerBoxX, headerBoxY, headerBoxWidth, 60);

        doc.fontSize(8).font('Helvetica');
        doc.text('OG:', headerBoxX + 5, headerBoxY + 5);
        doc.text(ordenData.header.og, headerBoxX + 80, headerBoxY + 5);

        doc.text('Fecha de emisión:', headerBoxX + 5, headerBoxY + 20);
        doc.text(
          ordenData.header.fechaEmision,
          headerBoxX + 80,
          headerBoxY + 20,
        );

        doc.text('RUC:', headerBoxX + 5, headerBoxY + 35);
        doc.text(ordenData.header.ruc, headerBoxX + 80, headerBoxY + 35);

        yPos = headerBoxY + 65;

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

        // Mostrar tipo de cambio en amarillo al lado de moneda
        if (ordenData.datosOrdenCompra.tipoCambio) {
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

        yPos += 60;

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
        const nivelColWidths = [125, 70, 30, 145, 145]; // Total: 515

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

        // Retención
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('¿Proveedor agente de retención ?', 40, yPos);

        this.drawHighlightBox(doc, 220, yPos - 5, 30, 20, '#FFFF00');
        doc.text(
          ordenData.totales.proveedorAgenteRetencion ? 'SI' : 'NO',
          225,
          yPos,
          { align: 'center', width: 20 },
        );

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
        this.drawHighlightBox(doc, totalesX + 95, yPos + 10, 40, 15, '#FFFF00');
        doc
          .font('Helvetica-Bold')
          .text(
            ordenData.totales.netoAPagar.toFixed(2),
            totalesX + 95,
            yPos + 15,
            { align: 'center', width: 40 },
          );

        yPos += 60;

        // ==================== FIRMAS ====================
        const firmaWidth = 150;
        const firmaSpacing = 180;

        // Genera orden
        doc.fontSize(8).font('Helvetica');
        doc.text('----------------------------', 40, yPos);
        doc.text('Genera orden', 40, yPos + 15);
        doc
          .font('Helvetica-Bold')
          .text(ordenData.firmas.generaOrden, 40, yPos + 30);

        // Jefe Administrativo
        doc
          .font('Helvetica')
          .text('----------------------------', 40 + firmaSpacing, yPos);
        doc.text('Jefe Administrativo', 40 + firmaSpacing, yPos + 15);

        // Gerencia
        doc.text('----------------------------', 40 + firmaSpacing * 2, yPos);
        doc.text('Gerencia', 40 + firmaSpacing * 2, yPos + 15);

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
    doc.fillColor('#4472C4').rect(x, y, width, 15).fill();
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
    const rowHeight = 18;

    // Definir el color azul/gris del header (#D9E2F3 es un azul claro similar al de la imagen)
    const headerColor = '#D9E2F3';

    // ===== FILA 1 - HEADERS =====
    // Columna A: "Centro de Costos" (combinada verticalmente con fila 2)
    doc.rect(startX, currentY, colWidths[0], rowHeight * 2).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Centro de Costos', startX + 2, currentY + 12, {
      width: colWidths[0] - 4,
      align: 'center',
    });

    // Columnas B+C: "Nivel 1" (combinadas horizontalmente) con fondo azul
    const nivel1Width = colWidths[1] + colWidths[2];
    doc
      .fillColor(headerColor)
      .rect(startX + colWidths[0], currentY, nivel1Width, rowHeight)
      .fill();
    doc
      .strokeColor('#000000')
      .rect(startX + colWidths[0], currentY, nivel1Width, rowHeight)
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
      .rect(xNivel2, currentY, colWidths[3], rowHeight)
      .fill();
    doc
      .strokeColor('#000000')
      .rect(xNivel2, currentY, colWidths[3], rowHeight)
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
      .rect(xNivel3, currentY, colWidths[4], rowHeight)
      .fill();
    doc
      .strokeColor('#000000')
      .rect(xNivel3, currentY, colWidths[4], rowHeight)
      .stroke();
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
    doc.text('Nivel 3', xNivel3 + 2, currentY + 5, {
      width: colWidths[4] - 4,
      align: 'center',
    });

    currentY += rowHeight;

    // ===== FILA 2 - Nivel1 / Nivel2 / Nivel3 =====
    // Columnas B+C: Nivel1 (combinadas horizontalmente)
    doc.rect(startX + colWidths[0], currentY, nivel1Width, rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.nivel1 || '', startX + colWidths[0] + 2, currentY + 5, {
      width: nivel1Width - 4,
      align: 'center',
    });

    // Columna D: Nivel2
    doc.rect(xNivel2, currentY, colWidths[3], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.nivel2 || '', xNivel2 + 2, currentY + 5, {
      width: colWidths[3] - 4,
      align: 'center',
    });

    // Columna E: Nivel3
    doc.rect(xNivel3, currentY, colWidths[4], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.nivel3 || '', xNivel3 + 2, currentY + 5, {
      width: colWidths[4] - 4,
      align: 'center',
    });

    currentY += rowHeight;

    // ===== FILA 3 - PLACA / NA / MAQUINA / RB-001 =====
    // Columna A: "PLACA" (negrita)
    doc.rect(startX, currentY, colWidths[0], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('PLACA', startX + 2, currentY + 5, {
      width: colWidths[0] - 4,
      align: 'center',
    });

    // Columnas B+C: "NA" (combinadas horizontalmente)
    const placaWidth = colWidths[1] + colWidths[2];
    doc.rect(startX + colWidths[0], currentY, placaWidth, rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text('NA', startX + colWidths[0] + 2, currentY + 5, {
      width: placaWidth - 4,
      align: 'center',
    });

    // Columna D: "MAQUINA" (negrita sin fondo de color)
    doc.rect(xNivel2, currentY, colWidths[3], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('MAQUINA', xNivel2 + 2, currentY + 5, {
      width: colWidths[3] - 4,
      align: 'center',
    });

    // Columna E: "RB-001"
    doc.rect(xNivel3, currentY, colWidths[4], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text('RB-001', xNivel3 + 2, currentY + 5, {
      width: colWidths[4] - 4,
      align: 'center',
    });

    currentY += rowHeight;

    // ===== FILA 4 - CTA BCP: =====
    // Columna A: "CTA BCP:"
    doc.rect(startX, currentY, colWidths[0], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('CTA BCP:', startX + 5, currentY + 5, {
      width: colWidths[0] - 10,
      align: 'left',
    });

    // Columnas B+C+D+E: número de cuenta bancaria del proveedor
    const ctaBcpWidth =
      colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    doc.rect(startX + colWidths[0], currentY, ctaBcpWidth, rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.cuentaBancaria || '', startX + colWidths[0] + 2, currentY + 5, {
      width: ctaBcpWidth - 4,
      align: 'center',
    });

    currentY += rowHeight;

    // ===== FILA 5 - OBSERVACION: / Observaciones =====
    // Columna A: "OBSERVACION:"
    doc.rect(startX, currentY, colWidths[0], rowHeight).stroke();
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('OBSERVACION:', startX + 5, currentY + 5, {
      width: colWidths[0] - 10,
      align: 'left',
    });

    // Columnas B+C+D+E: Observaciones de la orden (todas combinadas)
    const obsWidth = colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
    doc.rect(startX + colWidths[0], currentY, obsWidth, rowHeight).stroke();
    doc.fontSize(9).font('Helvetica');
    doc.text(data.observaciones || '', startX + colWidths[0] + 2, currentY + 5, {
      width: obsWidth - 4,
      align: 'center',
    });

    currentY += rowHeight;

    return currentY;
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
}
