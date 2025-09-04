import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InformeConsumoCombustibleFilterDto,
  InformeConsumoCombustibleResponse,
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
        a.galones AS cantidad,
        b.descripcion,
        a.odometro AS km,
        a.odometro,
        b.valor_venta_galon AS val_unit,
        b.total
      FROM vale_combustible_camion a
      JOIN factura_general_camion b ON a.id_factura = b.id_factura
      JOIN proveedor c ON b.id_proveedor = c.id_proveedor
      JOIN equipo d ON a.id_equipo = d.id_equipo
      ${whereClause}
      ORDER BY b.fecha_emision DESC
    `;

    const dataResult = await this.prisma.$queryRawUnsafe(dataQuery, ...params);
    const data = dataResult as InformeConsumoCombustibleResponse[];

    return data.map(item => ({
      ...item,
      cantidad: item.cantidad ? Number(item.cantidad) : null,
      val_unit: item.val_unit ? Number(item.val_unit) : null,
      total: item.total ? Number(item.total) : null,
      km: item.km ? Number(item.km) : null,
      odometro: item.odometro ? Number(item.odometro) : null,
    }));
  }
}