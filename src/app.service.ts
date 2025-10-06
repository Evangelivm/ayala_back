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
        etapas: '/api/etapas',
        sectores: '/api/sectores',
        frentes: '/api/frentes',
        partidas: '/api/partidas',
        subproyectos: '/api/subproyectos',
        subEtapas: '/api/sub-etapas',
        subsectores: '/api/subsectores',
        subfrentes: '/api/subfrentes',
        subpartidas: '/api/subpartidas',
        maquinaria: '/api/maquinaria',
        equipos: '/api/equipos',
        programacion: '/api/programacion',
        dashboard: '/api/dashboard',
        gre: '/api/gre',
        reportes: {
          operadores: '/api/reportes-operadores',
          plantilleros: '/api/reportes-plantilleros',
          consumoCombustible: '/api/informe-consumo-combustible'
        },
        viajes: '/api/viajes-eliminacion'
      },
      caracteristicas: [
        'Sistema de personal normalizado con roles contextuales',
        'Catálogo de equipos independiente de inventario físico',
        'Reportes master-detail con relaciones de foreign keys',
        'CRUD completo para jerarquía de proyectos (proyectos, etapas, sectores, frentes, partidas y sus sub-entidades)',
        'Cálculo automático de orden jerárquico',
        'Validación con Zod DTOs',
        'Arquitectura modular ES6',
        'Base de datos MySQL con Prisma ORM',
        'Sistema de eventos GRE con Kafka',
        'Programación y dashboard de control',
        'Polling y detección automática de eventos'
      ],
      tecnologias: {
        framework: 'NestJS',
        orm: 'Prisma',
        database: 'MySQL',
        validation: 'Zod',
        modules: 'ES6',
        messaging: 'Apache Kafka',
        scheduling: '@nestjs/schedule',
        microservices: '@nestjs/microservices'
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
