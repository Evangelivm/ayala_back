import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSubproyectoDto,
  UpdateSubproyectoDto,
} from '../dto/subproyectos.dto';

@Injectable()
export class SubproyectosService {
  constructor(private prisma: PrismaService) {}

  async create(createSubproyectoDto: CreateSubproyectoDto) {
    return this.prisma.subproyectos.create({
      data: createSubproyectoDto,
      include: {
        proyecto: true,
        sub_etapas: {
          include: {
            subsector: {
              include: {
                subfrente: {
                  include: {
                    subpartida: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Los selects solo ven lo activo; la página de proyectos pide
  // incluirInactivos para poder reactivar.
  private arbol(incluirInactivos: boolean) {
    const soloActivos = incluirInactivos ? undefined : { activo: true };
    return {
      proyecto: true,
      sub_etapas: {
        where: soloActivos,
        include: {
          subsector: {
            where: soloActivos,
            include: {
              subfrente: {
                where: soloActivos,
                include: {
                  subpartida: { where: soloActivos },
                },
              },
            },
          },
        },
      },
    };
  }

  async findAll(incluirInactivos = false) {
    return this.prisma.subproyectos.findMany({
      where: incluirInactivos
        ? undefined
        : { activo: true, proyecto: { activo: true, estado: 'activo' } },
      include: this.arbol(incluirInactivos),
      orderBy: { orden: 'asc' },
    });
  }

  async findByProyecto(idProyecto: number, incluirInactivos = false) {
    return this.prisma.subproyectos.findMany({
      where: {
        id_proyecto: idProyecto,
        ...(incluirInactivos ? {} : { activo: true, proyecto: { activo: true, estado: 'activo' } }),
      },
      include: this.arbol(incluirInactivos),
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: number) {
    const subproyecto = await this.prisma.subproyectos.findUnique({
      where: { id_subproyecto: id },
      include: {
        proyecto: true,
        sub_etapas: {
          where: { activo: true },
          include: {
            subsector: {
              where: { activo: true },
              include: {
                subfrente: {
                  where: { activo: true },
                  include: {
                    subpartida: {
                      where: { activo: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!subproyecto) {
      throw new NotFoundException(`Subproyecto con ID ${id} no encontrado`);
    }

    return subproyecto;
  }

  async update(id: number, updateSubproyectoDto: UpdateSubproyectoDto) {
    const subproyecto = await this.prisma.subproyectos.findUnique({
      where: { id_subproyecto: id },
    });

    if (!subproyecto) {
      throw new NotFoundException(`Subproyecto con ID ${id} no encontrado`);
    }

    return this.prisma.subproyectos.update({
      where: { id_subproyecto: id },
      data: updateSubproyectoDto,
      include: {
        proyecto: true,
        sub_etapas: {
          include: {
            subsector: {
              include: {
                subfrente: {
                  include: {
                    subpartida: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async remove(id: number) {
    const subproyecto = await this.prisma.subproyectos.findUnique({
      where: { id_subproyecto: id },
    });

    if (!subproyecto) {
      throw new NotFoundException(`Subproyecto con ID ${id} no encontrado`);
    }

    // Soft delete
    return this.prisma.subproyectos.update({
      where: { id_subproyecto: id },
      data: { activo: false },
    });
  }
}
