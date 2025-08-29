import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      nombre: 'Ayala Backend API',
      version: '2.0.0',
      descripcion: 'API para el sistema de reportes de Maquinarias Ayala con arquitectura normalizada',
      rutas: {
        personal: '/api/personal',
        proyectos: '/api/proyectos', 
        maquinaria: '/api/maquinaria',
        equipos: '/api/equipos',
        reportes: {
          operadores: '/api/reportes-operadores',
          plantilleros: '/api/reportes-plantilleros'
        },
        viajes: '/api/viajes-eliminacion'
      },
      caracteristicas: [
        'Sistema de personal normalizado con roles contextuales',
        'Catálogo de equipos independiente de inventario físico',
        'Reportes master-detail con relaciones de foreign keys',
        'Validación con Zod DTOs',
        'Arquitectura modular ES6',
        'Base de datos MySQL con Prisma ORM'
      ],
      tecnologias: {
        framework: 'NestJS',
        orm: 'Prisma',
        database: 'MySQL',
        validation: 'Zod',
        modules: 'ES6'
      },
      estado: 'activo',
      fecha: new Date().toISOString()
    };
  }

  getHealth() {
    return {
      estado: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      memoria: process.memoryUsage()
    };
  }
}
