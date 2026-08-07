import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import { Prisma } from '@generated/prisma';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export type SearchIndex =
  | 'programacion_tecnica'
  | 'ordenes_compra'
  | 'ordenes_servicio';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;
  private esAvailable = false;
  // Por índice: true solo si tiene datos (reindex corrido o docs creados vía hooks)
  private esIndexReady: Record<SearchIndex, boolean> = {
    programacion_tecnica: false,
    ordenes_compra: false,
    ordenes_servicio: false,
  };
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaThird: PrismaThirdService,
  ) {}

  async onModuleInit() {
    try {
      this.client = new Client({
        node: process.env.ELASTICSEARCH_NODE || 'https://localhost:9200',
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
          password: process.env.ELASTICSEARCH_PASSWORD || '',
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      await this.ensureIndices();
      this.esAvailable = true;

      // Verificar si los índices ya tienen datos (p.ej. tras restart con reindex previo)
      const [ptCount, ocCount, osCount] = await Promise.all([
        this.client.count({ index: 'programacion_tecnica' }),
        this.client.count({ index: 'ordenes_compra' }),
        this.client.count({ index: 'ordenes_servicio' }),
      ]);
      this.esIndexReady.programacion_tecnica = ptCount.count > 0;
      this.esIndexReady.ordenes_compra = ocCount.count > 0;
      this.esIndexReady.ordenes_servicio = osCount.count > 0;

      const hayDatos = Object.values(this.esIndexReady).some(Boolean);
      if (hayDatos) {
        this.logger.log(
          `Elasticsearch conectado con datos (PT:${ptCount.count} OC:${ocCount.count} OS:${osCount.count}) — modo ES activo`,
        );
      } else {
        this.logger.warn(
          'Elasticsearch conectado pero índices vacíos. Búsqueda usa Prisma. Ejecuta POST /api/search/reindex para activar ES.',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Elasticsearch no disponible: ${error.message}. Modo Prisma-only activado.`,
      );
    }
  }

  // ─── Gestión de índices ────────────────────────────────────────────────────

  private async ensureIndices() {
    const indices: Array<{ name: string; mappings: any }> = [
      {
        name: 'programacion_tecnica',
        mappings: {
          properties: {
            id: { type: 'integer' },
            fecha: { type: 'date' },
            fecha_str: { type: 'keyword' },
            proveedor: { type: 'text', analyzer: 'standard' },
            apellidos_nombres: { type: 'text', analyzer: 'standard' },
            proyectos: { type: 'text', analyzer: 'standard' },
            unidad: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            programacion: { type: 'keyword' },
            m3: { type: 'text' },
            identificador_unico: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            estado_programacion: { type: 'keyword' },
            deleted_at: { type: 'date' },
          },
        },
      },
      {
        name: 'ordenes_compra',
        mappings: {
          // Evita que ES infiera tipo `date` para campos de texto nuevos
          // con pinta de fecha antes de que el mapping explícito se aplique.
          date_detection: false,
          properties: {
            id: { type: 'integer' },
            numero_orden: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            nombre_proveedor: { type: 'text', analyzer: 'standard' },
            ruc_proveedor: { type: 'keyword' },
            fecha_orden: { type: 'date' },
            fecha_registro: { type: 'date' },
            estado: { type: 'keyword' },
            placa_unidad: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            tipo_unidad: { type: 'keyword' },
            nombre_chofer: { type: 'text' },
            apellido_chofer: { type: 'text' },
            chofer: { type: 'keyword' },
            auto_administrador: { type: 'boolean' },
            auto_contabilidad: { type: 'boolean' },
            jefe_proyecto: { type: 'boolean' },
            procede_pago: { type: 'keyword' },
            nro_factura: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            nro_serie: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            observaciones: { type: 'text', analyzer: 'standard' },
            centro_costo_nivel1: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            centro_costo_nivel2: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            centro_costo_nivel3: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            moneda: { type: 'keyword' },
            condicion: { type: 'keyword' },
            tipo_detraccion: { type: 'keyword' },
            items_texto: { type: 'text', analyzer: 'standard' },
            total: { type: 'text' },
            deleted_at: { type: 'date' },
          },
        },
      },
      {
        name: 'ordenes_servicio',
        mappings: {
          date_detection: false,
          properties: {
            id: { type: 'integer' },
            numero_orden: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            nombre_proveedor: { type: 'text', analyzer: 'standard' },
            ruc_proveedor: { type: 'keyword' },
            fecha_orden: { type: 'date' },
            fecha_registro: { type: 'date' },
            estado: { type: 'keyword' },
            placa_unidad: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            tipo_unidad: { type: 'keyword' },
            nombre_chofer: { type: 'text' },
            apellido_chofer: { type: 'text' },
            chofer: { type: 'keyword' },
            auto_administrador: { type: 'boolean' },
            auto_contabilidad: { type: 'boolean' },
            jefe_proyecto: { type: 'boolean' },
            procede_pago: { type: 'keyword' },
            nro_factura: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            nro_serie: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            observaciones: { type: 'text', analyzer: 'standard' },
            centro_costo_nivel1: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            centro_costo_nivel2: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            centro_costo_nivel3: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            moneda: { type: 'keyword' },
            condicion: { type: 'keyword' },
            tipo_detraccion: { type: 'keyword' },
            items_texto: { type: 'text', analyzer: 'standard' },
            total: { type: 'text' },
            deleted_at: { type: 'date' },
          },
        },
      },
    ];

    for (const index of indices) {
      const exists = await this.client.indices.exists({ index: index.name });
      if (!exists) {
        await this.client.indices.create({
          index: index.name,
          mappings: index.mappings,
        });
        this.logger.log(`Índice creado: ${index.name}`);
      } else {
        try {
          await this.client.indices.putMapping({
            index: index.name,
            properties: index.mappings.properties,
            ...(index.mappings.date_detection !== undefined
              ? { date_detection: index.mappings.date_detection }
              : {}),
          });
        } catch (e) {
          this.logger.warn(`putMapping ${index.name}: ${(e as Error).message}`);
        }
      }
    }
  }

  // ─── Métodos públicos ──────────────────────────────────────────────────────

  async indexDoc(
    index: SearchIndex,
    id: string,
    body: Record<string, any>,
  ): Promise<void> {
    if (!this.esAvailable) return;
    try {
      await this.client.index({ index, id, document: body });
      this.esIndexReady[index] = true;
    } catch (error) {
      this.logger.warn(`ES indexDoc error (${index}/${id}): ${error.message}`);
    }
  }

  async deleteDoc(index: SearchIndex, id: string): Promise<void> {
    if (!this.esAvailable) return;
    try {
      await this.client.delete({ index, id });
    } catch (error) {
      this.logger.warn(`ES deleteDoc error (${index}/${id}): ${error.message}`);
    }
  }

  /**
   * Reindexa un único documento leyendo su estado actual y completo desde
   * Prisma. A diferencia de llamar a indexDoc() con un payload parcial —
   * client.index() reemplaza el documento entero, no hace merge, así que
   * un payload parcial borraba el resto de campos del doc — este método
   * siempre escribe el documento completo y consistente.
   */
  async reindexOne(index: SearchIndex, id: number): Promise<void> {
    if (!this.esAvailable) return;
    try {
      const doc = await this.buildDocument(index, id);
      if (!doc) {
        await this.deleteDoc(index, id.toString());
        return;
      }
      await this.client.index({ index, id: id.toString(), document: doc });
      this.esIndexReady[index] = true;
    } catch (error) {
      this.logger.warn(
        `ES reindexOne error (${index}/${id}): ${error.message}`,
      );
    }
  }

  private async buildDocument(
    index: SearchIndex,
    id: number,
  ): Promise<Record<string, any> | null> {
    switch (index) {
      case 'programacion_tecnica':
        return this.buildProgramacionTecnicaDoc(id);
      case 'ordenes_compra':
        return this.buildOrdenCompraDoc(id);
      case 'ordenes_servicio':
        return this.buildOrdenServicioDoc(id);
    }
  }

  private async buildProgramacionTecnicaDoc(id: number) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT pt.id, pt.fecha, pt.identificador_unico, pt.estado_programacion, pt.deleted_at,
             pt.programacion, pt.m3,
             c.nombre_chofer, c.apellido_chofer, c.placa AS unidad_placa,
             e.razon_social AS empresa_razon_social,
             p.nombre AS nombre_proyecto,
             sp.nombre AS nombre_subproyecto
      FROM programacion_tecnica pt
      LEFT JOIN camiones c ON pt.unidad = c.id_camion
      LEFT JOIN empresas_2025 e
             ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
      LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
      LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
      WHERE pt.id = ${id}
    `;
    const pt = rows[0];
    if (!pt) return null;

    const nombreCompleto =
      [
        this.capitalizeWords(pt.nombre_chofer),
        this.capitalizeWords(pt.apellido_chofer),
      ]
        .filter(Boolean)
        .join(' ') || null;

    return {
      id: pt.id,
      fecha: pt.fecha ? dayjs(pt.fecha).format('YYYY-MM-DD') : null,
      fecha_str: pt.fecha ? dayjs(pt.fecha).format('YYYY-MM-DD') : null,
      proveedor: pt.empresa_razon_social || null,
      apellidos_nombres: nombreCompleto,
      proyectos: pt.nombre_subproyecto || pt.nombre_proyecto || null,
      unidad: pt.unidad_placa || null,
      programacion: pt.programacion || null,
      m3: pt.m3 != null ? pt.m3.toString() : null,
      identificador_unico: pt.identificador_unico || null,
      estado_programacion: pt.estado_programacion || null,
      deleted_at: pt.deleted_at ? dayjs(pt.deleted_at).toISOString() : null,
    };
  }

  /**
   * Texto libre concatenando código + descripción de cada ítem de la orden,
   * para que la búsqueda por producto (p.ej. "cemento" o "CEM-001") funcione
   * sin tener que abrir la orden.
   */
  private itemsTexto(
    detalles: Array<{ codigo_item?: string | null; descripcion_item?: string | null }> | null | undefined,
  ): string | null {
    if (!detalles || detalles.length === 0) return null;
    return (
      detalles
        .map((d) => [d.codigo_item, d.descripcion_item].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' | ') || null
    );
  }

  private async buildOrdenCompraDoc(id: number) {
    const orden = await this.prismaThird.ordenes_compra.findUnique({
      where: { id_orden_compra: id },
      include: { proveedores: true, detalles_orden_compra: true },
    });
    if (!orden) return null;
    const camion = await this.getCamionResumen(orden.id_camion);

    return {
      id: orden.id_orden_compra,
      numero_orden: orden.numero_orden,
      nombre_proveedor: (orden as any).proveedores?.nombre_proveedor || null,
      ruc_proveedor: (orden as any).proveedores?.ruc || null,
      fecha_orden: orden.fecha_orden
        ? dayjs.utc(orden.fecha_orden).format('YYYY-MM-DD')
        : null,
      fecha_registro: orden.fecha_registro
        ? dayjs.utc(orden.fecha_registro).format('YYYY-MM-DD')
        : null,
      estado: orden.estado || null,
      placa_unidad: camion?.placa || null,
      tipo_unidad: camion?.tipo || null,
      nombre_chofer: camion?.nombre_chofer || null,
      apellido_chofer: camion?.apellido_chofer || null,
      chofer: this.nombreCompletoChofer(camion),
      auto_administrador: orden.auto_administrador === true,
      auto_contabilidad: orden.auto_contabilidad === true,
      jefe_proyecto: orden.jefe_proyecto === true,
      procede_pago: orden.procede_pago || null,
      nro_factura: orden.nro_factura || null,
      nro_serie: orden.nro_serie || null,
      observaciones: orden.observaciones || null,
      centro_costo_nivel1: orden.centro_costo_nivel1 || null,
      centro_costo_nivel2: orden.centro_costo_nivel2 || null,
      centro_costo_nivel3: orden.centro_costo_nivel3 || null,
      moneda: orden.moneda || null,
      condicion: orden.condicion || null,
      tipo_detraccion: orden.tipo_detraccion || null,
      items_texto: this.itemsTexto((orden as any).detalles_orden_compra),
      total: orden.total != null ? orden.total.toString() : null,
      deleted_at: orden.deleted_at
        ? dayjs(orden.deleted_at).toISOString()
        : null,
    };
  }

  private async buildOrdenServicioDoc(id: number) {
    const orden = await this.prismaThird.ordenes_servicio.findUnique({
      where: { id_orden_servicio: id },
      include: { proveedores: true, detalles_orden_servicio: true },
    });
    if (!orden) return null;
    const camion = await this.getCamionResumen((orden as any).id_camion);

    return {
      id: (orden as any).id_orden_servicio,
      numero_orden: (orden as any).numero_orden,
      nombre_proveedor: (orden as any).proveedores?.nombre_proveedor || null,
      ruc_proveedor: (orden as any).proveedores?.ruc || null,
      fecha_orden: (orden as any).fecha_orden
        ? dayjs.utc((orden as any).fecha_orden).format('YYYY-MM-DD')
        : null,
      fecha_registro: (orden as any).fecha_registro
        ? dayjs.utc((orden as any).fecha_registro).format('YYYY-MM-DD')
        : null,
      estado: (orden as any).estado || null,
      placa_unidad: camion?.placa || null,
      tipo_unidad: camion?.tipo || null,
      nombre_chofer: camion?.nombre_chofer || null,
      apellido_chofer: camion?.apellido_chofer || null,
      chofer: this.nombreCompletoChofer(camion),
      auto_administrador: (orden as any).auto_administrador === true,
      auto_contabilidad: (orden as any).auto_contabilidad === true,
      jefe_proyecto: (orden as any).jefe_proyecto === true,
      procede_pago: (orden as any).procede_pago || null,
      nro_factura: (orden as any).nro_factura || null,
      nro_serie: (orden as any).nro_serie || null,
      observaciones: (orden as any).observaciones || null,
      centro_costo_nivel1: (orden as any).centro_costo_nivel1 || null,
      centro_costo_nivel2: (orden as any).centro_costo_nivel2 || null,
      centro_costo_nivel3: (orden as any).centro_costo_nivel3 || null,
      moneda: (orden as any).moneda || null,
      condicion: (orden as any).condicion || null,
      tipo_detraccion: (orden as any).tipo_detraccion || null,
      items_texto: this.itemsTexto((orden as any).detalles_orden_servicio),
      total: (orden as any).total != null ? (orden as any).total.toString() : null,
      deleted_at: (orden as any).deleted_at
        ? dayjs((orden as any).deleted_at).toISOString()
        : null,
    };
  }

  private async getCamionResumen(idCamion: number | null | undefined) {
    if (!idCamion) return null;
    return this.prisma.camiones.findUnique({
      where: { id_camion: idCamion },
      select: {
        placa: true,
        tipo: true,
        nombre_chofer: true,
        apellido_chofer: true,
      },
    });
  }

  private nombreCompletoChofer(
    camion: {
      nombre_chofer?: string | null;
      apellido_chofer?: string | null;
    } | null,
  ): string | null {
    if (!camion) return null;
    return (
      [camion.nombre_chofer, camion.apellido_chofer]
        .filter(Boolean)
        .join(' ') || null
    );
  }

  async search(
    index: SearchIndex,
    q: string,
    page: number,
    limit: number,
    filtros: Record<string, string | boolean> = {},
  ): Promise<{ data: any[]; total: number }> {
    if (this.esAvailable && this.esIndexReady[index]) {
      try {
        return await this.esSearch(index, q, page, limit, filtros);
      } catch (error) {
        this.logger.warn(
          `ES search falló (${index}): ${error.message}. Usando Prisma.`,
        );
      }
    }
    return this.prismaSearch(index, q, page, limit, filtros);
  }

  async reindexAll(): Promise<{
    programacion_tecnica: number;
    ordenes_compra: number;
    ordenes_servicio: number;
  }> {
    if (!this.esAvailable) {
      throw new Error('Elasticsearch no está disponible');
    }

    // ── programacion_tecnica ──────────────────────────────────────────────────
    const ptRows = await this.prisma.$queryRaw<any[]>`
      SELECT pt.id, pt.fecha, pt.identificador_unico, pt.estado_programacion, pt.deleted_at,
             pt.programacion, pt.m3,
             c.nombre_chofer, c.apellido_chofer, c.placa AS unidad_placa,
             e.razon_social AS empresa_razon_social,
             p.nombre AS nombre_proyecto,
             sp.nombre AS nombre_subproyecto
      FROM programacion_tecnica pt
      LEFT JOIN camiones c ON pt.unidad = c.id_camion
      LEFT JOIN empresas_2025 e
             ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
      LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
      LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
    `;

    const ptOps = ptRows.flatMap((pt) => {
      const nombreCompleto =
        [
          this.capitalizeWords(pt.nombre_chofer),
          this.capitalizeWords(pt.apellido_chofer),
        ]
          .filter(Boolean)
          .join(' ') || null;

      return [
        {
          index: {
            _index: 'programacion_tecnica',
            _id: pt.id.toString(),
          },
        },
        {
          id: pt.id,
          fecha: pt.fecha ? dayjs(pt.fecha).format('YYYY-MM-DD') : null,
          fecha_str: pt.fecha ? dayjs(pt.fecha).format('YYYY-MM-DD') : null,
          proveedor: pt.empresa_razon_social || null,
          apellidos_nombres: nombreCompleto,
          proyectos: pt.nombre_subproyecto || pt.nombre_proyecto || null,
          unidad: pt.unidad_placa || null,
          programacion: pt.programacion || null,
          m3: pt.m3 != null ? pt.m3.toString() : null,
          identificador_unico: pt.identificador_unico || null,
          estado_programacion: pt.estado_programacion || null,
          deleted_at: pt.deleted_at ? dayjs(pt.deleted_at).toISOString() : null,
        },
      ];
    });

    if (ptOps.length > 0) {
      await this.client.bulk({ operations: ptOps, refresh: true });
    }

    // ── ordenes_compra ────────────────────────────────────────────────────────
    const ordCompra = await this.prismaThird.ordenes_compra.findMany({
      include: { proveedores: true, detalles_orden_compra: true },
    });
    const camionesMapOC = await this.buildCamionesMap(
      ordCompra.map((o) => o.id_camion),
    );

    const ocOps = ordCompra.flatMap((o) => {
      const camion = o.id_camion ? camionesMapOC.get(o.id_camion) : null;
      return [
        {
          index: {
            _index: 'ordenes_compra',
            _id: o.id_orden_compra.toString(),
          },
        },
        {
          id: o.id_orden_compra,
          numero_orden: o.numero_orden,
          nombre_proveedor: (o as any).proveedores?.nombre_proveedor || null,
          ruc_proveedor: (o as any).proveedores?.ruc || null,
          fecha_orden: o.fecha_orden
            ? dayjs.utc(o.fecha_orden).format('YYYY-MM-DD')
            : null,
          fecha_registro: o.fecha_registro
            ? dayjs.utc(o.fecha_registro).format('YYYY-MM-DD')
            : null,
          estado: o.estado || null,
          placa_unidad: camion?.placa || null,
          tipo_unidad: camion?.tipo || null,
          nombre_chofer: camion?.nombre_chofer || null,
          apellido_chofer: camion?.apellido_chofer || null,
          chofer: this.nombreCompletoChofer(camion),
          auto_administrador: o.auto_administrador === true,
          auto_contabilidad: o.auto_contabilidad === true,
          jefe_proyecto: o.jefe_proyecto === true,
          procede_pago: o.procede_pago || null,
          nro_factura: o.nro_factura || null,
          nro_serie: o.nro_serie || null,
          observaciones: o.observaciones || null,
          centro_costo_nivel1: o.centro_costo_nivel1 || null,
          centro_costo_nivel2: o.centro_costo_nivel2 || null,
          centro_costo_nivel3: o.centro_costo_nivel3 || null,
          moneda: o.moneda || null,
          condicion: o.condicion || null,
          tipo_detraccion: o.tipo_detraccion || null,
          items_texto: this.itemsTexto((o as any).detalles_orden_compra),
          total: o.total != null ? o.total.toString() : null,
          deleted_at: o.deleted_at ? dayjs(o.deleted_at).toISOString() : null,
        },
      ];
    });

    if (ocOps.length > 0) {
      await this.client.bulk({ operations: ocOps, refresh: true });
    }

    // ── ordenes_servicio ──────────────────────────────────────────────────────
    const ordServicio = await this.prismaThird.ordenes_servicio.findMany({
      include: { proveedores: true, detalles_orden_servicio: true },
    });
    const camionesMapOS = await this.buildCamionesMap(
      ordServicio.map((o) => (o as any).id_camion),
    );

    const osOps = ordServicio.flatMap((o) => {
      const idCamion = (o as any).id_camion;
      const camion = idCamion ? camionesMapOS.get(idCamion) : null;
      return [
        {
          index: {
            _index: 'ordenes_servicio',
            _id: (o as any).id_orden_servicio.toString(),
          },
        },
        {
          id: (o as any).id_orden_servicio,
          numero_orden: (o as any).numero_orden,
          nombre_proveedor: (o as any).proveedores?.nombre_proveedor || null,
          ruc_proveedor: (o as any).proveedores?.ruc || null,
          fecha_orden: (o as any).fecha_orden
            ? dayjs.utc((o as any).fecha_orden).format('YYYY-MM-DD')
            : null,
          fecha_registro: (o as any).fecha_registro
            ? dayjs.utc((o as any).fecha_registro).format('YYYY-MM-DD')
            : null,
          estado: (o as any).estado || null,
          placa_unidad: camion?.placa || null,
          tipo_unidad: camion?.tipo || null,
          nombre_chofer: camion?.nombre_chofer || null,
          apellido_chofer: camion?.apellido_chofer || null,
          chofer: this.nombreCompletoChofer(camion),
          auto_administrador: (o as any).auto_administrador === true,
          auto_contabilidad: (o as any).auto_contabilidad === true,
          jefe_proyecto: (o as any).jefe_proyecto === true,
          procede_pago: (o as any).procede_pago || null,
          nro_factura: (o as any).nro_factura || null,
          nro_serie: (o as any).nro_serie || null,
          observaciones: (o as any).observaciones || null,
          centro_costo_nivel1: (o as any).centro_costo_nivel1 || null,
          centro_costo_nivel2: (o as any).centro_costo_nivel2 || null,
          centro_costo_nivel3: (o as any).centro_costo_nivel3 || null,
          moneda: (o as any).moneda || null,
          condicion: (o as any).condicion || null,
          tipo_detraccion: (o as any).tipo_detraccion || null,
          items_texto: this.itemsTexto((o as any).detalles_orden_servicio),
          total: (o as any).total != null ? (o as any).total.toString() : null,
          deleted_at: (o as any).deleted_at
            ? dayjs((o as any).deleted_at).toISOString()
            : null,
        },
      ];
    });

    if (osOps.length > 0) {
      await this.client.bulk({ operations: osOps, refresh: true });
    }

    this.esIndexReady.programacion_tecnica = ptRows.length > 0;
    this.esIndexReady.ordenes_compra = ordCompra.length > 0;
    this.esIndexReady.ordenes_servicio = ordServicio.length > 0;
    this.logger.log('Reindex completado — modo ES activado para búsqueda');

    return {
      programacion_tecnica: ptRows.length,
      ordenes_compra: ordCompra.length,
      ordenes_servicio: ordServicio.length,
    };
  }

  // ─── ES search interno ─────────────────────────────────────────────────────

  private async esSearch(
    index: SearchIndex,
    q: string,
    page: number,
    limit: number,
    filtros: Record<string, string | boolean> = {},
  ): Promise<{ data: any[]; total: number }> {
    const from = (page - 1) * limit;

    const searchFields: Record<SearchIndex, string[]> = {
      programacion_tecnica: [
        'proveedor',
        'apellidos_nombres',
        'proyectos',
        'unidad',
        'programacion',
        'm3',
        'fecha_str',
        'identificador_unico',
        'estado_programacion',
      ],
      ordenes_compra: [
        'numero_orden',
        'nombre_proveedor',
        'ruc_proveedor',
        'estado',
        'placa_unidad',
        'nombre_chofer',
        'apellido_chofer',
        'nro_factura',
        'nro_serie',
        'observaciones',
        'centro_costo_nivel1',
        'centro_costo_nivel2',
        'centro_costo_nivel3',
        'moneda',
        'condicion',
        'tipo_detraccion',
        'items_texto',
        'total',
      ],
      ordenes_servicio: [
        'numero_orden',
        'nombre_proveedor',
        'ruc_proveedor',
        'estado',
        'placa_unidad',
        'nombre_chofer',
        'apellido_chofer',
        'nro_factura',
        'nro_serie',
        'observaciones',
        'centro_costo_nivel1',
        'centro_costo_nivel2',
        'centro_costo_nivel3',
        'moneda',
        'condicion',
        'tipo_detraccion',
        'items_texto',
        'total',
      ],
    };

    const sortField: Record<SearchIndex, string> = {
      programacion_tecnica: 'fecha',
      ordenes_compra: 'fecha_orden',
      ordenes_servicio: 'fecha_orden',
    };

    const trimmedQ = q ? q.trim() : '';
    const isNumericQ = /^\d+$/.test(trimmedQ);

    // Los docs solo tienen deleted_at indexado cuando el registro fue
    // eliminado (soft delete); un valor null explícito no se indexa.
    // "not exists" = no está borrado.
    const notDeletedFilter = {
      bool: { must_not: { exists: { field: 'deleted_at' } } },
    };

    const filterClauses: any[] = [notDeletedFilter];
    for (const [campo, valor] of Object.entries(filtros)) {
      if (valor === undefined || valor === null || valor === '') continue;
      // placa_unidad pasó a mapearse como `text` (para soportar búsqueda
      // libre parcial); el filtro exacto del dropdown debe apuntar a su
      // subcampo `.keyword`, que sí es un término no analizado.
      const campoTerm = campo === 'placa_unidad' ? 'placa_unidad.keyword' : campo;
      filterClauses.push({ term: { [campoTerm]: valor } });
    }

    const esQuery: any = trimmedQ
      ? {
          bool: {
            should: [
              {
                multi_match: {
                  query: trimmedQ,
                  fields: searchFields[index],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                  operator: 'and',
                },
              },
              ...(isNumericQ
                ? [{ term: { id: parseInt(trimmedQ) } }]
                : []),
            ],
            minimum_should_match: 1,
            filter: filterClauses,
          },
        }
      : { bool: { filter: filterClauses } };

    const result = await this.client.search({
      index,
      from,
      size: limit,
      query: esQuery,
      sort: [{ [sortField[index]]: { order: 'desc', missing: '_last' } }],
    });

    const hits = result.hits.hits;
    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : ((result.hits.total as any)?.value ?? 0);

    if (hits.length === 0) {
      return { data: [], total };
    }

    const ids = hits.map((hit) => parseInt(hit._id as string));
    const data = await this.getFullDataByIds(index, ids);
    return { data, total };
  }

  // ─── Fallback Prisma ───────────────────────────────────────────────────────

  private async prismaSearch(
    index: SearchIndex,
    q: string,
    page: number,
    limit: number,
    filtros: Record<string, string | boolean> = {},
  ): Promise<{ data: any[]; total: number }> {
    switch (index) {
      case 'programacion_tecnica':
        return this.searchProgramacionTecnica(q, page, limit, filtros);
      case 'ordenes_compra':
        return this.searchOrdenesCompra(q, page, limit, filtros);
      case 'ordenes_servicio':
        return this.searchOrdenesServicio(q, page, limit, filtros);
    }
  }

  private async getFullDataByIds(
    index: SearchIndex,
    ids: number[],
  ): Promise<any[]> {
    switch (index) {
      case 'programacion_tecnica':
        return this.getProgramacionTecnicaByIds(ids);
      case 'ordenes_compra':
        return this.getOrdenesCompraByIds(ids);
      case 'ordenes_servicio':
        return this.getOrdenesServicioByIds(ids);
    }
  }

  // ─── Programación Técnica ──────────────────────────────────────────────────

  private programacionTecnicaFiltrosSql(
    filtros: Record<string, string | boolean>,
  ): Prisma.Sql {
    const fragments: Prisma.Sql[] = [];
    if (filtros.programacion) {
      fragments.push(Prisma.sql`pt.programacion = ${filtros.programacion}`);
    }
    if (filtros.estado_programacion) {
      fragments.push(
        Prisma.sql`pt.estado_programacion = ${filtros.estado_programacion}`,
      );
    }
    return fragments.length > 0
      ? Prisma.sql`AND ${Prisma.join(fragments, ' AND ')}`
      : Prisma.sql``;
  }

  private async searchProgramacionTecnica(
    q: string,
    page: number,
    limit: number,
    filtros: Record<string, string | boolean> = {},
  ) {
    const offset = (page - 1) * limit;
    const filtrosSql = this.programacionTecnicaFiltrosSql(filtros);

    if (q) {
      const searchParam = `%${q}%`;

      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRaw<[{ total: bigint }]>(
          Prisma.sql`SELECT COUNT(*) AS total
            FROM programacion_tecnica pt
            LEFT JOIN camiones c ON pt.unidad = c.id_camion
            LEFT JOIN empresas_2025 e
                   ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
            LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
            LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
            WHERE (e.razon_social LIKE ${searchParam}
                OR c.nombre_chofer LIKE ${searchParam}
                OR c.apellido_chofer LIKE ${searchParam}
                OR c.placa LIKE ${searchParam}
                OR pt.identificador_unico LIKE ${searchParam}
                OR pt.estado_programacion LIKE ${searchParam}
                OR pt.programacion LIKE ${searchParam}
                OR CAST(pt.m3 AS CHAR) LIKE ${searchParam}
                OR CAST(pt.fecha AS CHAR) LIKE ${searchParam}
                OR p.nombre LIKE ${searchParam}
                OR sp.nombre LIKE ${searchParam}
                OR CAST(pt.id AS CHAR) = ${q})
            ${filtrosSql}`,
        ),
        this.prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT pt.*,
              c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
              e.razon_social AS empresa_razon_social,
              gr.enlace_del_pdf, gr.enlace_del_xml, gr.enlace_del_cdr,
              p.nombre AS nombre_proyecto,
              sp.nombre AS nombre_subproyecto
            FROM programacion_tecnica pt
            LEFT JOIN camiones c ON pt.unidad = c.id_camion
            LEFT JOIN empresas_2025 e
                   ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
            LEFT JOIN guia_remision gr
                   ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
                  AND gr.estado_gre = 'COMPLETADO'
            LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
            LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
            WHERE (e.razon_social LIKE ${searchParam}
                OR c.nombre_chofer LIKE ${searchParam}
                OR c.apellido_chofer LIKE ${searchParam}
                OR c.placa LIKE ${searchParam}
                OR pt.identificador_unico LIKE ${searchParam}
                OR pt.estado_programacion LIKE ${searchParam}
                OR pt.programacion LIKE ${searchParam}
                OR CAST(pt.m3 AS CHAR) LIKE ${searchParam}
                OR CAST(pt.fecha AS CHAR) LIKE ${searchParam}
                OR p.nombre LIKE ${searchParam}
                OR sp.nombre LIKE ${searchParam}
                OR CAST(pt.id AS CHAR) = ${q})
            ${filtrosSql}
            ORDER BY pt.fecha DESC
            LIMIT ${limit} OFFSET ${offset}`,
        ),
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      return {
        data: rows.map((r) => this.mapProgramacionTecnicaRow(r)),
        total,
      };
    } else {
      // Sin búsqueda: count + datos paginados
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRaw<[{ total: bigint }]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM programacion_tecnica pt
            WHERE 1=1 ${filtrosSql}`,
        ),
        this.prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT pt.*,
              c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
              e.razon_social AS empresa_razon_social,
              gr.enlace_del_pdf, gr.enlace_del_xml, gr.enlace_del_cdr,
              p.nombre AS nombre_proyecto,
              sp.nombre AS nombre_subproyecto
            FROM programacion_tecnica pt
            LEFT JOIN camiones c ON pt.unidad = c.id_camion
            LEFT JOIN empresas_2025 e
                   ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
            LEFT JOIN guia_remision gr
                   ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
                  AND gr.estado_gre = 'COMPLETADO'
            LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
            LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
            WHERE 1=1 ${filtrosSql}
            ORDER BY pt.fecha DESC
            LIMIT ${limit} OFFSET ${offset}`,
        ),
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      return {
        data: rows.map((r) => this.mapProgramacionTecnicaRow(r)),
        total,
      };
    }
  }

  private async getProgramacionTecnicaByIds(ids: number[]): Promise<any[]> {
    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT pt.*,
          c.placa AS unidad_placa, c.nombre_chofer, c.apellido_chofer,
          e.razon_social AS empresa_razon_social,
          gr.enlace_del_pdf, gr.enlace_del_xml, gr.enlace_del_cdr,
          p.nombre AS nombre_proyecto,
          sp.nombre AS nombre_subproyecto
        FROM programacion_tecnica pt
        LEFT JOIN camiones c ON pt.unidad = c.id_camion
        LEFT JOIN empresas_2025 e
               ON pt.proveedor COLLATE utf8mb4_unicode_ci = e.codigo COLLATE utf8mb4_unicode_ci
        LEFT JOIN guia_remision gr
               ON pt.identificador_unico COLLATE utf8mb4_unicode_ci = gr.identificador_unico COLLATE utf8mb4_unicode_ci
              AND gr.estado_gre = 'COMPLETADO'
        LEFT JOIN proyecto p ON pt.id_proyecto = p.id_proyecto
        LEFT JOIN subproyectos sp ON pt.id_subproyecto = sp.id_subproyecto
        WHERE pt.id IN (${Prisma.join(ids)})
        ORDER BY pt.fecha DESC`,
    );
    return rows.map((r) => this.mapProgramacionTecnicaRow(r));
  }

  private capitalizeWords(text: string | null): string | null {
    if (!text) return null;
    return text
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private mapProgramacionTecnicaRow(pt: any) {
    const nombreCapitalizado = this.capitalizeWords(pt.nombre_chofer);
    const apellidoCapitalizado = this.capitalizeWords(pt.apellido_chofer);
    const apellidos_nombres =
      nombreCapitalizado && apellidoCapitalizado
        ? `${nombreCapitalizado} ${apellidoCapitalizado}`
        : null;

    let proyectos: string | null = null;
    let tipo_proyecto: 'proyecto' | 'subproyecto' | null = null;
    if (pt.nombre_subproyecto) {
      proyectos = pt.nombre_subproyecto;
      tipo_proyecto = 'subproyecto';
    } else if (pt.nombre_proyecto) {
      proyectos = pt.nombre_proyecto;
      tipo_proyecto = 'proyecto';
    }

    let hora_partida: string | null = null;
    if (pt.fecha && pt.hora_partida) {
      try {
        const fechaStr = dayjs(pt.fecha).format('YYYY-MM-DD');
        const horaStr = dayjs(pt.hora_partida).format('HH:mm:ss');
        hora_partida = dayjs
          .tz(`${fechaStr} ${horaStr}`, 'YYYY-MM-DD HH:mm:ss', 'America/Lima')
          .toISOString();
      } catch {
        hora_partida = pt.hora_partida;
      }
    }

    return {
      id: pt.id,
      fecha: pt.fecha,
      unidad: pt.unidad_placa || null,
      proveedor: pt.empresa_razon_social || null,
      apellidos_nombres,
      proyectos,
      tipo_proyecto,
      programacion: pt.programacion,
      hora_partida,
      estado_programacion: pt.estado_programacion,
      comentarios: pt.comentarios,
      validacion: pt.validacion,
      identificador_unico: pt.identificador_unico,
      km_del_dia: pt.km_del_dia,
      mes: pt.mes,
      num_semana: pt.num_semana,
      m3: pt.m3 ? pt.m3.toString() : null,
      cantidad_viaje: pt.cantidad_viaje,
      enlace_del_pdf: pt.enlace_del_pdf || null,
      enlace_del_xml: pt.enlace_del_xml || null,
      enlace_del_cdr: pt.enlace_del_cdr || null,
      deleted_at: pt.deleted_at || null,
    };
  }

  /**
   * Filtros exactos compartidos por ordenes_compra/ordenes_servicio en el
   * fallback Prisma (cuando ES no está disponible). placa_unidad/tipo_unidad
   * requieren resolver primero los id_camion correspondientes, ya que no hay
   * relación Prisma directa entre las órdenes y camiones.
   */
  private async ordenesFiltrosWhere(
    filtros: Record<string, string | boolean>,
  ): Promise<Record<string, any>> {
    const where: Record<string, any> = {};

    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.fecha_registro) {
      const dia = String(filtros.fecha_registro);
      where.fecha_registro = {
        gte: new Date(`${dia}T00:00:00.000Z`),
        lte: new Date(`${dia}T23:59:59.999Z`),
      };
    }
    if (filtros.auto_administrador !== undefined) {
      where.auto_administrador =
        filtros.auto_administrador === true ||
        filtros.auto_administrador === 'true';
    }
    if (filtros.auto_contabilidad !== undefined) {
      where.auto_contabilidad =
        filtros.auto_contabilidad === true ||
        filtros.auto_contabilidad === 'true';
    }
    if (filtros.jefe_proyecto !== undefined) {
      where.jefe_proyecto =
        filtros.jefe_proyecto === true || filtros.jefe_proyecto === 'true';
    }
    if (filtros.procede_pago) where.procede_pago = filtros.procede_pago;

    if (filtros.placa_unidad || filtros.tipo_unidad || filtros.chofer) {
      const camionWhere: Record<string, any> = {};
      if (filtros.placa_unidad) camionWhere.placa = filtros.placa_unidad;
      if (filtros.tipo_unidad) camionWhere.tipo = filtros.tipo_unidad;
      const camiones = await this.prisma.camiones.findMany({
        where: camionWhere,
        select: { id_camion: true, nombre_chofer: true, apellido_chofer: true },
      });
      // "chofer" llega como "nombre apellido" concatenado (no hay ese campo
      // en la tabla), así que se filtra en memoria tras traer los candidatos.
      const filtrados = filtros.chofer
        ? camiones.filter(
            (c) =>
              [c.nombre_chofer, c.apellido_chofer].filter(Boolean).join(' ') ===
              filtros.chofer,
          )
        : camiones;
      where.id_camion = { in: filtrados.map((c) => c.id_camion) };
    }

    return where;
  }

  // ─── Órdenes de Compra ─────────────────────────────────────────────────────

  /**
   * ordenes_compra/servicio no tienen relación Prisma directa con camiones,
   * así que la búsqueda libre por placa/chofer (fallback sin ES) resuelve
   * primero los id_camion que matchean y los agrega como OR adicional.
   */
  // "estado" es un enum en Prisma (no admite `contains`); se resuelve a los
  // valores del enum cuyo texto matchea parcialmente el término buscado.
  private static readonly ORDEN_ESTADOS = [
    'PENDIENTE',
    'APROBADA',
    'PARCIALMENTE_RECEPCIONADA',
    'COMPLETADA',
    'CANCELADA',
    'FIRMADA',
  ];

  private estadosMatching(q: string): string[] {
    const upper = q.toUpperCase();
    return SearchService.ORDEN_ESTADOS.filter((e) => e.includes(upper));
  }

  private async camionIdsByQuery(q: string): Promise<number[]> {
    const camiones = await this.prisma.camiones.findMany({
      where: {
        OR: [
          { placa: { contains: q } },
          { nombre_chofer: { contains: q } },
          { apellido_chofer: { contains: q } },
        ],
      },
      select: { id_camion: true },
    });
    return camiones.map((c) => c.id_camion);
  }

  private async searchOrdenesCompra(
    q: string,
    page: number,
    limit: number,
    filtros: Record<string, string | boolean> = {},
  ) {
    const camionIds = q ? await this.camionIdsByQuery(q) : [];
    const estadosMatch = q ? this.estadosMatching(q) : [];
    const where: any = {
      deleted_at: null,
      ...(await this.ordenesFiltrosWhere(filtros)),
      ...(q
        ? {
            OR: [
              { numero_orden: { contains: q } },
              { proveedores: { nombre_proveedor: { contains: q } } },
              { proveedores: { ruc: { contains: q } } },
              { nro_factura: { contains: q } },
              { nro_serie: { contains: q } },
              { observaciones: { contains: q } },
              { centro_costo_nivel1: { contains: q } },
              { centro_costo_nivel2: { contains: q } },
              { centro_costo_nivel3: { contains: q } },
              { moneda: { contains: q } },
              { condicion: { contains: q } },
              { tipo_detraccion: { contains: q } },
              {
                detalles_orden_compra: {
                  some: {
                    OR: [
                      { codigo_item: { contains: q } },
                      { descripcion_item: { contains: q } },
                    ],
                  },
                },
              },
              ...(estadosMatch.length > 0
                ? [{ estado: { in: estadosMatch } }]
                : []),
              ...(camionIds.length > 0
                ? [{ id_camion: { in: camionIds } }]
                : []),
              ...(/^\d+$/.test(q.trim())
                ? [{ id_orden_compra: parseInt(q.trim()) }]
                : []),
            ],
          }
        : {}),
    };

    const [total, ordenes] = await Promise.all([
      this.prismaThird.ordenes_compra.count({ where }),
      this.prismaThird.ordenes_compra.findMany({
        where,
        orderBy: { fecha_registro: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          proveedores: true,
          detalles_orden_compra: true,
        },
      }),
    ]);

    const camionesMap = await this.buildCamionesMap(
      ordenes.map((o) => o.id_camion),
    );
    return {
      data: ordenes.map((o) => this.mapOrdenCompra(o, camionesMap)),
      total,
    };
  }

  private async getOrdenesCompraByIds(ids: number[]): Promise<any[]> {
    const ordenes = await this.prismaThird.ordenes_compra.findMany({
      where: { id_orden_compra: { in: ids }, deleted_at: null },
      orderBy: { fecha_registro: 'desc' },
      include: {
        proveedores: true,
        detalles_orden_compra: true,
      },
    });
    const camionesMap = await this.buildCamionesMap(
      ordenes.map((o) => o.id_camion),
    );
    return ordenes.map((o) => this.mapOrdenCompra(o, camionesMap));
  }

  private async buildCamionesMap(
    ids: (number | null)[],
  ): Promise<Map<number, any>> {
    const camionIds = [...new Set(ids.filter(Boolean))] as number[];
    const map = new Map<number, any>();
    if (camionIds.length > 0) {
      const camiones = await this.prisma.camiones.findMany({
        where: { id_camion: { in: camionIds } },
        select: {
          id_camion: true,
          placa: true,
          tipo: true,
          nombre_chofer: true,
          apellido_chofer: true,
        },
      });
      camiones.forEach((c) => map.set(c.id_camion, c));
    }
    return map;
  }

  private mapOrdenCompra(
    orden: any,
    camionesMap: Map<number, any> = new Map(),
  ) {
    const camion = orden.id_camion ? camionesMap.get(orden.id_camion) : null;
    return {
      ...orden,
      fecha_orden: orden.fecha_orden
        ? dayjs.utc(orden.fecha_orden).format('YYYY-MM-DD')
        : null,
      fecha_registro: orden.fecha_registro
        ? dayjs.utc(orden.fecha_registro).format('YYYY-MM-DD')
        : null,
      nombre_proveedor: orden.proveedores?.nombre_proveedor || null,
      ruc_proveedor: orden.proveedores?.ruc || null,
      items: orden.detalles_orden_compra || [],
      unidad_id: orden.id_camion || null,
      placa_unidad: camion?.placa || null,
      tipo_unidad: camion?.tipo || null,
      nombre_chofer: camion?.nombre_chofer || null,
      apellido_chofer: camion?.apellido_chofer || null,
    };
  }

  // ─── Órdenes de Servicio ───────────────────────────────────────────────────

  private async searchOrdenesServicio(
    q: string,
    page: number,
    limit: number,
    filtros: Record<string, string | boolean> = {},
  ) {
    const camionIds = q ? await this.camionIdsByQuery(q) : [];
    const estadosMatch = q ? this.estadosMatching(q) : [];
    const where: any = {
      deleted_at: null,
      ...(await this.ordenesFiltrosWhere(filtros)),
      ...(q
        ? {
            OR: [
              { numero_orden: { contains: q } },
              { proveedores: { nombre_proveedor: { contains: q } } },
              { proveedores: { ruc: { contains: q } } },
              { nro_factura: { contains: q } },
              { nro_serie: { contains: q } },
              { observaciones: { contains: q } },
              { centro_costo_nivel1: { contains: q } },
              { centro_costo_nivel2: { contains: q } },
              { centro_costo_nivel3: { contains: q } },
              { moneda: { contains: q } },
              { condicion: { contains: q } },
              { tipo_detraccion: { contains: q } },
              {
                detalles_orden_servicio: {
                  some: {
                    OR: [
                      { codigo_item: { contains: q } },
                      { descripcion_item: { contains: q } },
                    ],
                  },
                },
              },
              ...(estadosMatch.length > 0
                ? [{ estado: { in: estadosMatch } }]
                : []),
              ...(camionIds.length > 0
                ? [{ id_camion: { in: camionIds } }]
                : []),
              ...(/^\d+$/.test(q.trim())
                ? [{ id_orden_servicio: parseInt(q.trim()) }]
                : []),
            ],
          }
        : {}),
    };

    const [total, ordenes] = await Promise.all([
      this.prismaThird.ordenes_servicio.count({ where }),
      this.prismaThird.ordenes_servicio.findMany({
        where,
        orderBy: { fecha_registro: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          proveedores: true,
          detalles_orden_servicio: true,
        },
      }),
    ]);

    const camionesMap = await this.buildCamionesMap(
      ordenes.map((o) => o.id_camion),
    );
    return {
      data: ordenes.map((o) => this.mapOrdenServicio(o, camionesMap)),
      total,
    };
  }

  private async getOrdenesServicioByIds(ids: number[]): Promise<any[]> {
    const ordenes = await this.prismaThird.ordenes_servicio.findMany({
      where: { id_orden_servicio: { in: ids }, deleted_at: null },
      orderBy: { fecha_registro: 'desc' },
      include: {
        proveedores: true,
        detalles_orden_servicio: true,
      },
    });
    const camionesMap = await this.buildCamionesMap(
      ordenes.map((o) => o.id_camion),
    );
    return ordenes.map((o) => this.mapOrdenServicio(o, camionesMap));
  }

  private mapOrdenServicio(
    orden: any,
    camionesMap: Map<number, any> = new Map(),
  ) {
    const camion = orden.id_camion ? camionesMap.get(orden.id_camion) : null;
    return {
      ...orden,
      fecha_orden: orden.fecha_orden
        ? dayjs.utc(orden.fecha_orden).format('YYYY-MM-DD')
        : null,
      fecha_registro: orden.fecha_registro
        ? dayjs.utc(orden.fecha_registro).format('YYYY-MM-DD')
        : null,
      nombre_proveedor: orden.proveedores?.nombre_proveedor || null,
      ruc_proveedor: orden.proveedores?.ruc || null,
      items: orden.detalles_orden_servicio || [],
      unidad_id: orden.id_camion || null,
      placa_unidad: camion?.placa || null,
      tipo_unidad: camion?.tipo || null,
      nombre_chofer: camion?.nombre_chofer || null,
      apellido_chofer: camion?.apellido_chofer || null,
    };
  }
}
