import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaThirdService } from '../prisma/prisma-third.service';
import { CreateProveedorDto } from '../dto/proveedores.dto';

@Injectable()
export class ProveedoresService {
  constructor(private prismaThird: PrismaThirdService) {}

  async findAll() {
    const proveedores = await this.prismaThird.proveedores.findMany({
      where: {
        activo: true,
      },
      orderBy: {
        nombre_proveedor: 'asc',
      },
    });

    return proveedores;
  }

  async findOne(id: number) {
    return this.prismaThird.proveedores.findUnique({
      where: { id_proveedor: id },
    });
  }

  async findByDocumento(ruc: string) {
    return this.prismaThird.proveedores.findFirst({
      where: { ruc },
    });
  }

  /**
   * Genera el siguiente código de proveedor disponible
   * Busca el primer número no usado en la secuencia PROV001-PROV999
   */
  private async generateCodigoProveedor(): Promise<string> {
    // Obtener todos los códigos de proveedores existentes
    const proveedores = await this.prismaThird.proveedores.findMany({
      select: {
        codigo_proveedor: true,
      },
    });

    // Extraer los números de los códigos (PROV001 -> 1, PROV002 -> 2, etc.)
    const numerosUsados = proveedores
      .map((p) => {
        const match = p.codigo_proveedor?.match(/^PROV(\d{3})$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((num) => num !== null) as number[];

    // Ordenar los números
    numerosUsados.sort((a, b) => a - b);

    // Buscar el primer número disponible del 1 al 999
    let numeroDisponible = 1;
    for (const num of numerosUsados) {
      if (num === numeroDisponible) {
        numeroDisponible++;
      } else if (num > numeroDisponible) {
        break;
      }
    }

    // Validar que no se exceda el límite
    if (numeroDisponible > 999) {
      throw new BadRequestException('No hay códigos de proveedor disponibles (límite PROV999 alcanzado)');
    }

    // Formatear el número con 3 dígitos (1 -> 001, 2 -> 002, 100 -> 100)
    const codigoNumero = numeroDisponible.toString().padStart(3, '0');
    return `PROV${codigoNumero}`;
  }

  async create(createProveedorDto: CreateProveedorDto) {
    // Verificar que no exista un proveedor con el mismo RUC
    const existente = await this.prismaThird.proveedores.findFirst({
      where: { ruc: createProveedorDto.ruc },
    });

    if (existente) {
      throw new BadRequestException('Ya existe un proveedor con este RUC');
    }

    // Generar el código de proveedor automáticamente
    const codigoProveedor = await this.generateCodigoProveedor();

    // Crear el proveedor con el código generado
    const proveedor = await this.prismaThird.proveedores.create({
      data: {
        codigo_proveedor: codigoProveedor,
        nombre_proveedor: createProveedorDto.nombre_proveedor,
        ruc: createProveedorDto.ruc,
        contacto: createProveedorDto.contacto || null,
        telefono: createProveedorDto.telefono || null,
        email: createProveedorDto.email || null,
        direccion: createProveedorDto.direccion || null,
        entidad_bancaria: createProveedorDto.entidad_bancaria || null,
        numero_cuenta_bancaria: createProveedorDto.numero_cuenta_bancaria || null,
        retencion: createProveedorDto.retencion || null,
        es_agente_retencion: createProveedorDto.es_agente_retencion || null,
        activo: createProveedorDto.activo ?? true,
      },
    });

    return proveedor;
  }
}
