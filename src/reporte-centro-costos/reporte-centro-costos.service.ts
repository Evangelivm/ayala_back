import { Injectable } from '@nestjs/common';
import { SearchService } from '../search/search.service';

export interface CentroCostoRow {
  tipo_orden: 'compra' | 'servicio';
  id_orden: number;
  numero_orden: string;
  fecha_orden: string | null;
  nro_factura: string | null;
  url: string | null;
  centro_costo_nivel1: string | null;
  centro_costo_nivel2: string | null;
  centro_costo_nivel3: string | null;
  id_detalle: number;
  codigo_item: string;
  descripcion_item: string;
  centro_costo_item: string | null;
}

export interface CentroCostoFiltros {
  q?: string;
  tipoOrden?: 'compra' | 'servicio';
  page: number;
  limit: number;
}

type SearchIndexOrden = 'ordenes_compra' | 'ordenes_servicio';

// Tope de órdenes a traer por índice antes de aplanar/ordenar/paginar en
// memoria. Hoy hay ~1500 órdenes en total; muy por debajo de este tope.
const FETCH_LIMIT = 5000;

@Injectable()
export class ReporteCentroCostosService {
  constructor(private readonly searchService: SearchService) {}

  async findAll(filtros: CentroCostoFiltros): Promise<{
    data: CentroCostoRow[];
    total: number;
  }> {
    const { q = '', tipoOrden, page, limit } = filtros;

    const indices: SearchIndexOrden[] =
      tipoOrden === 'compra'
        ? ['ordenes_compra']
        : tipoOrden === 'servicio'
          ? ['ordenes_servicio']
          : ['ordenes_compra', 'ordenes_servicio'];

    // Reutiliza el buscador (Elasticsearch, con fallback a Prisma si ES no
    // está disponible) para obtener las órdenes que matchean el texto libre.
    const resultados = await Promise.all(
      indices.map((index) =>
        this.searchService.search(index, q, 1, FETCH_LIMIT, {}),
      ),
    );

    const rows: CentroCostoRow[] = [];
    resultados.forEach((resultado, i) => {
      const tipo: 'compra' | 'servicio' =
        indices[i] === 'ordenes_compra' ? 'compra' : 'servicio';

      for (const orden of resultado.data) {
        const idOrden =
          tipo === 'compra' ? orden.id_orden_compra : orden.id_orden_servicio;
        const items = orden.items || [];

        for (const item of items) {
          rows.push({
            tipo_orden: tipo,
            id_orden: idOrden,
            numero_orden: orden.numero_orden,
            fecha_orden: orden.fecha_orden || null,
            nro_factura: orden.nro_factura || null,
            url: orden.url || null,
            centro_costo_nivel1: orden.centro_costo_nivel1 || null,
            centro_costo_nivel2: orden.centro_costo_nivel2 || null,
            centro_costo_nivel3: orden.centro_costo_nivel3 || null,
            id_detalle: item.id_detalle,
            codigo_item: item.codigo_item,
            descripcion_item: item.descripcion_item,
            centro_costo_item: item.centro_costo || null,
          });
        }
      }
    });

    // Orden por fecha de la orden (desc); a igual fecha, la orden más
    // reciente (id mayor) primero.
    rows.sort((a, b) => {
      const fa = a.fecha_orden || '';
      const fb = b.fecha_orden || '';
      if (fa !== fb) return fa < fb ? 1 : -1;
      return b.id_orden - a.id_orden;
    });

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);

    return { data, total };
  }
}
