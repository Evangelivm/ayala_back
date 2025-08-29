# Ayala Backend API

Backend API para el Sistema de Reportes de Maquinarias Ayala, construido con NestJS, Prisma ORM y MySQL.

## 🏗️ Arquitectura

### Stack Tecnológico

- **Framework**: NestJS
- **ORM**: Prisma
- **Base de Datos**: MySQL
- **Validación**: Zod DTOs
- **Módulos**: ES6
- **Autenticación**: JWT (implementable)

### Características Principales

- ✅ Sistema de personal normalizado con roles contextuales
- ✅ Catálogo de equipos independiente de inventario físico
- ✅ Reportes master-detail con relaciones de foreign keys
- ✅ Validación robusta con Zod DTOs
- ✅ Arquitectura modular escalable
- ✅ API RESTful con documentación automática

## 📊 Estructura de Base de Datos

### Tablas Principales

#### **Personal**

Tabla normalizada sin roles predefinidos. Los roles se deducen contextualmente.

```sql
- id_personal (PK)
- nombres, apellidos, dni (UNIQUE)
- telefono, correo, fecha_ingreso
- activo, observaciones
```

#### **Equipos** (Catálogo de Servicios)

Diferente de `maquinarias` (inventario físico).

```sql
- id_equipo (PK)
- tipo_equipo (ENUM: EXCAVADORA, CARGADOR, etc.)
- marca, modelo, descripcion
- unidad, precio_referencial
```

#### **Reportes Operadores** (Master-Detail)

```sql
Master: codigo_reporte, fecha, id_proyecto
Personal: id_operador, id_vigia, id_mantero, etc.
Detail: detalle_produccion[]
```

#### **Viajes Eliminación** (Master-Detail)

```sql
Master: codigo_reporte, fecha, id_proyecto
Personal: id_responsable, id_operador, id_vigia, etc.
Detail: detalle_viajes[] + detalle_horarios[]
```

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18+
- MySQL 8.0+
- npm o pnpm

### Instalación

```bash
# Clonar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Configurar base de datos en .env (Ejemplo)
DATABASE_URL="mysql://usuario:password@localhost:3306/db"

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones (opcional)
npx prisma db push
```

### Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run start:prod

# Modo watch
npm run start
```

## 📡 API Endpoints

### **Base URL**: `http://localhost:3001/api`

### **Información del API**

- `GET /` - Información general del API
- `GET /health` - Estado de salud del sistema

### **Personal** (Normalizado)

- `GET /personal` - Listar personal activo
- `GET /personal/:id` - Obtener personal por ID
- `POST /personal` - Crear nuevo personal
- `PUT /personal/:id` - Actualizar personal
- `DELETE /personal/:id` - Eliminar personal

### **Proyectos**

- `GET /proyectos` - Listar proyectos
- `GET /proyectos/:id` - Obtener proyecto por ID
- `POST /proyectos` - Crear proyecto
- `PUT /proyectos/:id` - Actualizar proyecto

### **Equipos** (Catálogo)

- `GET /equipos` - Listar equipos
- `GET /equipos?tipo_equipo=EXCAVADORA` - Filtrar por tipo
- `GET /equipos/:id` - Obtener equipo por ID
- `POST /equipos` - Crear equipo
- `PUT /equipos/:id` - Actualizar equipo

### **Maquinarias** (Inventario Físico)

- `GET /maquinaria` - Listar maquinarias
- `GET /maquinaria/:id` - Obtener maquinaria por ID
- `POST /maquinaria` - Crear maquinaria

### **Reportes Operadores**

- `GET /reportes-operadores` - Listar reportes con filtros
- `GET /reportes-operadores/:id` - Obtener reporte por ID
- `POST /reportes-operadores` - Crear reporte (master + detail)
- `PATCH /reportes-operadores/:id` - Actualizar reporte
- `DELETE /reportes-operadores/:id` - Soft delete

### **Reportes Plantilleros**

- `GET /reportes-plantilleros` - Listar reportes
- `GET /reportes-plantilleros/:id` - Obtener reporte por ID
- `POST /reportes-plantilleros` - Crear reporte
- `PATCH /reportes-plantilleros/:id` - Actualizar reporte

### **Viajes Eliminación**

- `GET /viajes-eliminacion` - Listar viajes con filtros
- `GET /viajes-eliminacion/:id` - Obtener viaje por ID
- `POST /viajes-eliminacion` - Crear viaje (master + detail)
- `PATCH /viajes-eliminacion/:id` - Actualizar viaje

## 🔧 Validación y DTOs

### Zod Schemas

Todos los endpoints utilizan validación con Zod:

```typescript
// Ejemplo: Personal DTO
export const PersonalSchema = z.object({
  nombres: z.string().min(1).max(100),
  apellidos: z.string().min(1).max(100),
  dni: z.string().length(8),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  fecha_ingreso: z.string().datetime(),
  activo: z.boolean().optional().default(true),
});
```

### Tipos de Equipos

```typescript
enum TipoEquipoEnum {
  EXCAVADORA,
  CARGADOR,
  MINICARGADOR,
  MOTONIVELADORA,
  PAVIMENTADORA,
  RODILLO,
  VIBROAPRISIONADOR,
  FLETE_TRANSPORTE,
  COMPRESOR,
  GRUA,
  PLATAFORMA_ELEVADORA,
  SERVICIO_PERSONAL,
  SERVICIO_ESPECIALIZADO,
  HERRAMIENTA_MANUAL,
  EQUIPO_TOPOGRAFIA,
}
```

## 🏛️ Arquitectura de Roles Contextuales

### Problema Resuelto

Anteriormente, el sistema tenía roles predefinidos en strings, causando:

- Inconsistencias en datos
- Dificultad para mantener relaciones
- Limitaciones de escalabilidad

### Solución Implementada

**Roles Contextuales**: Los roles se deducen del contexto donde aparece el ID de la persona.

```sql
-- Si id_personal = 5 aparece en:
viajes_eliminacion.id_vigia = 5     → Persona actúa como Vigía
reportes_operadores.id_operador = 5 → Persona actúa como Operador
```

### Beneficios

- ✅ Flexibilidad: Una persona puede tener múltiples roles
- ✅ Consistencia: Relaciones de FK garantizan integridad
- ✅ Escalabilidad: Fácil agregar nuevos roles
- ✅ Trazabilidad: Histórico completo de asignaciones

## 🗄️ Gestión de Base de Datos

### Prisma Commands

```bash
# Ver estado actual
npx prisma status

# Aplicar cambios al schema
npx prisma db push

# Generar cliente después de cambios
npx prisma generate

# Abrir Prisma Studio
npx prisma studio

# Reset completo (⚠️ CUIDADO)
npx prisma db push --force-reset
```

### Backups

```bash
# Crear backup
mysqldump -u usuario -p ayala_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
mysql -u usuario -p ayala_db < backup_20241222.sql
```

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:cov
```

## 📦 Estructura del Proyecto

```
src/
├── app.module.ts          # Módulo principal
├── app.service.ts         # Información del API
├── app.controller.ts      # Rutas principales
├── dto/                   # Zod validation schemas
│   ├── personal.dto.ts
│   ├── equipos.dto.ts
│   └── reportes.dto.ts
├── personal/              # Módulo Personal
├── equipos/               # Módulo Equipos
├── reportes-operadores/   # Módulo Reportes Operadores
├── reportes-plantilleros/ # Módulo Reportes Plantilleros
├── viajes-eliminacion/    # Módulo Viajes Eliminación
└── prisma/
    └── schema.prisma      # Schema de base de datos
```

## 🔄 Versionado del API

### v2.0.0 (Actual)

- ✅ Sistema de personal normalizado
- ✅ Catálogo de equipos independiente
- ✅ Roles contextuales
- ✅ Reportes master-detail

### v1.0.0 (Legacy)

- ❌ Roles como strings
- ❌ Equipos mezclados con maquinarias
- ❌ Datos denormalizados

## 🚀 Deployment

### Desarrollo

```bash
npm run start:dev
# API disponible en http://localhost:3001
```

### Producción

```bash
# Build
npm run build

# Start
npm run start:prod
```

### Variables de Entorno

```env
DATABASE_URL="mysql://user:pass@host:port/db"
PORT=3001
NODE_ENV=production
JWT_SECRET=your-secret-key
```

## 📝 Changelog

### v2.0.0 - Diciembre 2024

- Migración a arquitectura normalizada
- Implementación de roles contextuales
- Separación equipos/maquinarias
- Validación con Zod DTOs

### v1.0.0 - Inicial

- API básica con NestJS
- Estructura legacy con strings

## 🤝 Contribución

1. Fork del proyecto
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📞 Soporte

Para soporte técnico o consultas:

- **Equipo**: Desarrollo Ayala
- **API Base**: `GET /api/` para información general
- **Health Check**: `GET /api/health` para estado del sistema

---

**© 2025 Maquinarias Ayala - Sistema de Reportes Backend**
