import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InformeConsumoCombustibleFilterDto,
  InformeConsumoCombustibleResponse,
  InformeConsumoCombustibleDetalle,
} from '../dto/informe-consumo-combustible.dto';

@Injectable()
export class InformeConsumoCombustibleService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: InformeConsumoCombustibleFilterDto) {
    let whereClause = '';
    const params: any[] = [];

    if (filters.fecha_desde && filters.fecha_hasta) {
      whereClause += ` WHERE b.fecha_emision BETWEEN ? AND ?`;
      params.push(filters.fecha_desde, filters.fecha_hasta);
    } else if (filters.fecha_desde) {
      whereClause += ` WHERE b.fecha_emision >= ?`;
      params.push(filters.fecha_desde);
    } else if (filters.fecha_hasta) {
      whereClause += ` WHERE b.fecha_emision <= ?`;
      params.push(filters.fecha_hasta);
    }

    if (filters.id_equipo) {
      if (whereClause) {
        whereClause += ` AND a.id_equipo = ?`;
      } else {
        whereClause += ` WHERE a.id_equipo = ?`;
      }
      params.push(filters.id_equipo);
    }

    const dataQuery = `
      SELECT 
        b.fecha_emision,
        b.almacenes,
        b.numero_factura,
        b.fecha_emision,
        c.nombre,
        b.glosa,
        b.guia_remision,
        a.codigo_vale,
        d.placa,
        a.galones AS 'cantidad',
        b.descripcion,
        a.odometro AS 'km',
        a.odometro,
        b.valor_venta_galon AS 'val_unit',
        CASE 
            WHEN (a.galones * b.valor_venta_galon) IS NULL THEN NULL
            WHEN ABS(a.galones * b.valor_venta_galon - ROUND(a.galones * b.valor_venta_galon)) < 0.000001 
            THEN CAST(a.galones * b.valor_venta_galon AS DECIMAL(10, 0))
            ELSE ROUND(a.galones * b.valor_venta_galon, 2)
        END AS total
      FROM vale_combustible_camion a
      JOIN factura_general_camion b ON a.id_factura = b.id_factura
      JOIN proveedor c ON b.id_proveedor = c.id_proveedor
      JOIN equipo d ON a.id_equipo = d.id_equipo
      ${whereClause}
      ORDER BY b.fecha_emision DESC
    `;

    const dataResult = await this.prisma.$queryRawUnsafe(dataQuery, ...params);
    const rawData = dataResult as any[];

    // Agrupar por numero_factura
    const groupedData = rawData.reduce((acc, item) => {
      const key = item.numero_factura;
      
      if (!acc[key]) {
        acc[key] = {
          fecha_emision: item.fecha_emision,
          almacenes: item.almacenes,
          numero_factura: item.numero_factura,
          nombre: item.nombre,
          glosa: item.glosa,
          guia_remision: item.guia_remision,
          detalles: []
        };
      }

      const detalle: InformeConsumoCombustibleDetalle = {
        codigo_vale: item.codigo_vale,
        placa: item.placa,
        cantidad: item.cantidad ? Number(item.cantidad) : 0,
        descripcion: item.descripcion,
        km: item.km ? Number(item.km) : 0,
        odometro: item.odometro ? Number(item.odometro) : 0,
        val_unit: item.val_unit ? Number(item.val_unit) : 0,
        total: item.total ? Number(item.total) : 0,
      };

      acc[key].detalles.push(detalle);
      return acc;
    }, {});

    // Convertir el objeto agrupado en array
    return Object.values(groupedData) as InformeConsumoCombustibleResponse[];
  }
}