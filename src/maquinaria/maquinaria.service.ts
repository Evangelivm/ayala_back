import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMaquinariaDto, UpdateMaquinariaDto } from '../dto/maquinaria.dto';

@Injectable()
export class MaquinariaService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const maquinarias = await this.prisma.maquinarias.findMany({
      where: { activo: true },
      select: {
        id_maquinaria: true,
        codigo: true,
        marca: true,
        modelo: true,
        a_o: true,
        activo: true,
      },
    });

    return maquinarias.map(maq => ({
      id: maq.id_maquinaria,
      nombre: `${maq.marca} ${maq.modelo}`,
      tipo: this.getTipoFromMarca(maq.marca || ''),
      modelo: maq.modelo || '',
      codigo: maq.codigo,
      año: maq.a_o,
      activo: maq.activo,
    }));
  }

  private getTipoFromMarca(marca: string): string {
    // Mapear marca a tipo basado en los datos del frontend
    if (marca?.includes('CAT')) {
      if (marca.includes('320')) return 'Excavadora';
      if (marca.includes('D6')) return 'Bulldozer';
      if (marca.includes('950')) return 'Cargador Frontal';
      if (marca.includes('140')) return 'Motoniveladora';
      if (marca.includes('CS')) return 'Compactadora';
      if (marca.includes('966')) return 'Pala Cargadora';
      if (marca.includes('CB')) return 'Rodillo Compactador';
    }
    if (marca?.includes('JCB')) return 'Retroexcavadora';
    if (marca?.includes('Komatsu')) return 'Excavadora';
    if (marca?.includes('Volvo')) return 'Volquete';
    if (marca?.includes('Liebherr')) return 'Grúa Móvil';
    if (marca?.includes('Bobcat')) return 'Minicargadora';
    
    return 'Maquinaria';
  }

  async findOne(id: number) {
    const maquinaria = await this.prisma.maquinarias.findUnique({
      where: { id_maquinaria: id },
      select: {
        id_maquinaria: true,
        codigo: true,
        marca: true,
        modelo: true,
        a_o: true,
        activo: true,
      },
    });

    if (!maquinaria) return null;

    return {
      id: maquinaria.id_maquinaria,
      nombre: `${maquinaria.marca} ${maquinaria.modelo}`,
      tipo: this.getTipoFromMarca(maquinaria.marca || ''),
      modelo: maquinaria.modelo || '',
      codigo: maquinaria.codigo,
      año: maquinaria.a_o,
      activo: maquinaria.activo,
    };
  }

  async findByNombre(nombre: string) {
    const maquinarias = await this.findAll();
    return maquinarias.find(maq => maq.nombre === nombre && maq.activo) || null;
  }

  async create(data: CreateMaquinariaDto) {
    // Extraer marca y modelo del nombre
    const [marca, ...modeloParts] = data.nombre.split(' ');
    const modelo = modeloParts.join(' ');

    const maquinaria = await this.prisma.maquinarias.create({
      data: {
        codigo: `MQ${Date.now()}`,
        marca: marca,
        modelo: modelo,
        a_o: new Date().getFullYear(),
        activo: data.activo,
      },
    });

    return {
      id: maquinaria.id_maquinaria,
      nombre: data.nombre,
      tipo: data.tipo,
      modelo: data.modelo,
      activo: maquinaria.activo,
    };
  }

  async update(id: number, data: UpdateMaquinariaDto) {
    const [marca, ...modeloParts] = (data.nombre || '').split(' ');
    const modelo = modeloParts.join(' ');

    const maquinaria = await this.prisma.maquinarias.update({
      where: { id_maquinaria: id },
      data: {
        marca: data.nombre ? marca : undefined,
        modelo: data.nombre ? modelo : undefined,
        activo: data.activo,
      },
    });

    return {
      id: maquinaria.id_maquinaria,
      nombre: data.nombre || `${maquinaria.marca} ${maquinaria.modelo}`,
      tipo: data.tipo || this.getTipoFromMarca(maquinaria.marca || ''),
      modelo: data.modelo || maquinaria.modelo || '',
      activo: maquinaria.activo,
    };
  }

  async remove(id: number) {
    await this.prisma.maquinarias.update({
      where: { id_maquinaria: id },
      data: { activo: false },
    });

    return { message: 'Maquinaria marcada como inactiva' };
  }
}