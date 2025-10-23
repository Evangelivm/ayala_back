# Ayala Backend API

Backend API para el Sistema Integral de Gestión de Maquinarias y Construcción Ayala, construido con NestJS, Prisma ORM y MySQL.

## 🏗️ Arquitectura

### Stack Tecnológico

- **Framework**: NestJS 10+
- **ORM**: Prisma
- **Base de Datos**: MySQL 8.0+
- **Validación**: Zod DTOs
- **Módulos**: ES6
- **Mensajería**: Kafka (para integración con sistemas externos)
- **Autenticación**: JWT (implementable)

### Características Principales

- ✅ Sistema de personal normalizado con roles contextuales
- ✅ Catálogo de equipos independiente de inventario físico
- ✅ Reportes master-detail con relaciones de foreign keys
- ✅ Gestión completa de proyectos con estructura jerárquica (Proyectos → Etapas → Sectores → Frentes → Partidas)
- ✅ Soporte para subproyectos con estructura independiente
- ✅ Sistema de Guías de Remisión Electrónica (GRE) integrado con SUNAT
- ✅ Programación técnica para gestión de viajes y entregas
- ✅ Gestión de camiones y conductores
- ✅ Control de combustible y vales
- ✅ Dashboard con métricas y análisis
- ✅ Validación robusta con Zod DTOs
- ✅ Arquitectura modular escalable
- ✅ API RESTful con documentación automática

## 📊 Estructura de Base de Datos

### Módulos y Tablas Principales

#### **Estructura de Proyectos (Jerárquica)**

Sistema jerárquico de 5 niveles para proyectos principales:

```
Proyecto
  └── Etapa
      └── Sector
          └── Frente
              └── Partida
```

Adicionalmente, soporte para Subproyectos independientes:

```
Subproyecto
  └── Sub-Etapa
      └── Subsector
          └── Subfrente
              └── Subpartida
```

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

#### **Camiones y Conductores**

```sql
camiones:
- id_camion (PK)
- placa (UNIQUE)
- marca, modelo, año
- dni, nombre_chofer, apellido_chofer
- numero_licencia
- capacidad_tanque, tipo_combustible
```

#### **Guías de Remisión Electrónica (GRE)**

Sistema completo de guías electrónicas integrado con SUNAT:

```sql
guias_remision:
- id_guia (PK)
- serie, numero, tipo_comprobante
- fecha_emision, fecha_inicio_traslado
- datos del cliente/destinatario
- datos del transportista
- datos del conductor
- punto_partida/llegada (ubigeo + dirección)
- items[], observaciones
- estado_gre, enlaces (PDF, XML, CDR)
- relación con proyectos/subproyectos
```

#### **Programación Técnica**

Gestión de entregas y viajes programados:

```sql
prog_tecnica:
- id_prog_tecnica (PK)
- identificador_unico (UNIQUE)
- guia_* (datos pre-carga para GRE)
- relación con proyecto o subproyecto
- m3, estado
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

#### **Órdenes de Compra**

```sql
orden_de_compra:
- id_orden (PK)
- numero (UNIQUE), fecha_emision
- proveedor (RUC, empresa, contacto)
- condiciones, moneda
Detail: detalle_orden_compra[]
```

#### **Empresas y Clientes**

```sql
empresas:
- id_empresa (PK)
- numero_documento, razon_social
- direccion, telefono, email

clientes2025:
- id (PK)
- nombre, ruc, direccion
- datos de facturación
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

### **Estructura de Proyectos**

#### Proyectos Principales
- `GET /proyectos` - Listar proyectos
- `GET /proyectos/:id` - Obtener proyecto por ID
- `POST /proyectos` - Crear proyecto
- `PUT /proyectos/:id` - Actualizar proyecto

#### Etapas
- `GET /etapas` - Listar todas las etapas
- `GET /etapas/proyecto/:idProyecto` - Listar etapas por proyecto
- `GET /etapas/:id` - Obtener etapa por ID
- `POST /etapas` - Crear etapa
- `PUT /etapas/:id` - Actualizar etapa

#### Sectores
- `GET /sectores` - Listar todos los sectores
- `GET /sectores/etapa/:idEtapa` - Listar sectores por etapa
- `GET /sectores/:id` - Obtener sector por ID
- `POST /sectores` - Crear sector
- `PUT /sectores/:id` - Actualizar sector

#### Frentes
- `GET /frentes` - Listar todos los frentes
- `GET /frentes/sector/:idSector` - Listar frentes por sector
- `GET /frentes/:id` - Obtener frente por ID
- `POST /frentes` - Crear frente
- `PUT /frentes/:id` - Actualizar frente

#### Partidas
- `GET /partidas` - Listar todas las partidas
- `GET /partidas/frente/:idFrente` - Listar partidas por frente
- `GET /partidas/:id` - Obtener partida por ID
- `POST /partidas` - Crear partida
- `PUT /partidas/:id` - Actualizar partida

### **Estructura de Subproyectos**

Similar a proyectos, con endpoints para:
- `/subproyectos` - Subproyectos
- `/sub-etapas` - Sub-Etapas
- `/subsectores` - Subsectores
- `/subfrentes` - Subfrentes
- `/subpartidas` - Subpartidas

### **Guías de Remisión Electrónica (GRE)**

#### API de Facturación (Nubefact/SUNAT)
- `POST /gre/generar-guia` - Generar GRE y enviar a SUNAT
- `POST /gre/enviar` - Enviar GRE existente a SUNAT
- `GET /gre/consultar/:serie/:numero` - Consultar estado en SUNAT
- `POST /gre/anular` - Anular GRE en SUNAT

#### CRUD de Guías (Base de datos local)
- `GET /gre-crud` - Listar guías con filtros
- `GET /gre-crud/:id` - Obtener guía por ID
- `GET /gre-crud/numero/ultimo` - Obtener último número de guía
- `POST /gre-crud` - Crear guía
- `PUT /gre-crud/:id` - Actualizar guía
- `DELETE /gre-crud/:id` - Eliminar guía

### **Programación Técnica**

- `GET /programacion` - Listar programaciones
- `GET /programacion/:id` - Obtener programación por ID
- `POST /programacion` - Crear programación
- `PUT /programacion/:id` - Actualizar programación completa
- `PATCH /programacion/tecnica/:id` - Actualizar solo datos técnicos
- `DELETE /programacion/:id` - Eliminar programación

### **Camiones**

- `GET /camiones` - Listar camiones
- `GET /camiones/:id` - Obtener camión por ID
- `GET /camiones/placa/:placa` - Buscar por placa
- `POST /camiones` - Crear camión
- `PUT /camiones/:id` - Actualizar camión
- `DELETE /camiones/:id` - Eliminar camión

### **Empresas**

- `GET /empresas` - Listar empresas
- `GET /empresas/:id` - Obtener empresa por ID
- `GET /empresas/documento/:numeroDocumento` - Buscar por documento
- `POST /empresas` - Crear empresa
- `PUT /empresas/:id` - Actualizar empresa
- `DELETE /empresas/:id` - Eliminar empresa

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

### **Dashboard**

- `GET /dashboard/metricas` - Obtener métricas generales
- `GET /dashboard/estadisticas` - Estadísticas del sistema

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

## 📋 Sistema de Guías de Remisión Electrónica (GRE)

### Funcionalidad Principal

Sistema completo integrado con SUNAT/Nubefact para la emisión de Guías de Remisión Electrónica según normativa peruana.

### Características

- ✅ **GRE Remitente**: Cuando el propietario de la mercancía realiza el traslado
- ✅ **GRE Transportista**: Cuando un tercero transporta la mercancía
- ✅ **Integración SUNAT**: Envío directo a sistemas de facturación electrónica
- ✅ **Almacenamiento Local**: Base de datos propia para histórico y consultas
- ✅ **Generación Automática**: Numeración correlativa y validaciones
- ✅ **Relación con Proyectos**: Vinculación con estructura jerárquica de proyectos
- ✅ **Gestión de Ubigeos**: Sistema de ubicaciones geográficas (Lima)
- ✅ **Documentos Adjuntos**: Enlaces a PDF, XML y CDR de SUNAT

### Flujo de Trabajo

1. **Programación Técnica**: Se crea una entrada con datos preliminares del viaje
2. **Creación de GRE**: Se genera la guía con todos los datos requeridos por SUNAT
3. **Envío a SUNAT**: Transmisión electrónica vía API Nubefact
4. **Confirmación**: Recepción de PDF, XML y CDR (Constancia de Recepción)
5. **Registro**: Almacenamiento en base de datos local para histórico

### Datos Requeridos

- Datos del comprobante (serie, número, fechas)
- Cliente/Destinatario (RUC, razón social, dirección)
- Traslado (motivo, bultos, peso)
- Transporte (tipo, placa, conductor)
- Ubicaciones (punto de partida y llegada con ubigeo)
- Items/Productos a transportar
- Relación con proyecto o subproyecto (opcional)

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

## 🗂️ Estructura Jerárquica de Proyectos

### Arquitectura de 5 Niveles

El sistema soporta dos estructuras jerárquicas paralelas e independientes:

#### Proyectos Principales
```
Proyecto
  └── Etapa (por proyecto)
      └── Sector (por etapa)
          └── Frente (por sector)
              └── Partida (por frente)
```

#### Subproyectos
```
Subproyecto
  └── Sub-Etapa (por subproyecto)
      └── Subsector (por sub-etapa)
          └── Subfrente (por subsector)
              └── Subpartida (por subfrente)
```

### Beneficios

- ✅ **Organización Clara**: Estructura lógica de trabajos y tareas
- ✅ **Trazabilidad**: Cada entrega o reporte se vincula a la estructura completa
- ✅ **Flexibilidad**: Soporte para proyectos grandes y pequeños
- ✅ **Independencia**: Subproyectos con su propia jerarquía
- ✅ **Consultas Eficientes**: Filtrado por cualquier nivel de la jerarquía

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
├── app.module.ts                 # Módulo principal
├── app.service.ts                # Información del API
├── app.controller.ts             # Rutas principales
├── dto/                          # Zod validation schemas
│   ├── personal.dto.ts
│   ├── equipos.dto.ts
│   ├── reportes.dto.ts
│   └── ...
├── controllers/                  # Controladores legacy
│   ├── reportes-operadores.controller.ts
│   ├── reportes-plantilleros.controller.ts
│   ├── viajes-eliminacion.controller.ts
│   └── informe-consumo-combustible.controller.ts
├── personal/                     # Módulo Personal
├── equipos/                      # Módulo Equipos
├── maquinaria/                   # Módulo Maquinarias
├── proyectos/                    # Módulo Proyectos
├── etapas/                       # Módulo Etapas
├── sectores/                     # Módulo Sectores
├── frentes/                      # Módulo Frentes
├── partidas/                     # Módulo Partidas
├── subproyectos/                 # Módulo Subproyectos
├── sub-etapas/                   # Módulo Sub-Etapas
├── subsectores/                  # Módulo Subsectores
├── subfrentes/                   # Módulo Subfrentes
├── subpartidas/                  # Módulo Subpartidas
├── gre/                          # Módulo Guías Remisión Electrónica
│   ├── gre.controller.ts         # API SUNAT/Nubefact
│   ├── gre-crud.controller.ts    # CRUD local
│   └── gre.service.ts
├── programacion/                 # Módulo Programación Técnica
├── camiones/                     # Módulo Camiones
├── empresas/                     # Módulo Empresas
├── dashboard/                    # Módulo Dashboard
├── kafka/                        # Módulo Kafka (mensajería)
├── reportes/                     # Módulo Reportes
├── prisma/                       # Prisma ORM
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   └── schema.prisma             # Schema de base de datos
└── generated/                    # Código generado por Prisma
    └── prisma/                   # Cliente Prisma
```

## 🔄 Versionado del API

### v3.0.0 (Actual - 2025)

- ✅ Sistema completo de Guías de Remisión Electrónica (GRE) integrado con SUNAT
- ✅ Programación técnica para gestión de entregas
- ✅ Estructura jerárquica completa de proyectos (5 niveles)
- ✅ Soporte para subproyectos independientes
- ✅ Gestión de camiones y conductores
- ✅ Dashboard con métricas y análisis
- ✅ Módulo de empresas y clientes
- ✅ Integración con Kafka para mensajería
- ✅ API modular completamente escalable

### v2.0.0 (2024)

- ✅ Sistema de personal normalizado
- ✅ Catálogo de equipos independiente
- ✅ Roles contextuales
- ✅ Reportes master-detail
- ✅ Validación con Zod DTOs

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

### v3.0.0 - Enero 2025

- Implementación completa de Guías de Remisión Electrónica (GRE)
- Integración con API de facturación SUNAT/Nubefact
- Sistema de programación técnica para gestión de viajes
- Módulo de camiones con datos de conductores integrados
- Módulo de empresas y clientes
- Estructura jerárquica completa: Proyectos/Subproyectos (5 niveles cada uno)
- Dashboard con métricas y estadísticas
- Integración con Kafka para mensajería
- Mejoras en la arquitectura modular

### v2.0.0 - Diciembre 2024

- Migración a arquitectura normalizada
- Implementación de roles contextuales
- Separación equipos/maquinarias
- Validación con Zod DTOs
- Reportes master-detail

### v1.0.0 - Inicial

- API básica con NestJS
- Estructura legacy con strings

## 🤝 Contribución

1. Fork del proyecto
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 🔌 Integraciones

### SUNAT/Nubefact

El sistema se integra con servicios de facturación electrónica para:

- Emisión de Guías de Remisión Electrónica (GRE)
- Consulta de estado de comprobantes
- Anulación de guías
- Descarga de documentos (PDF, XML, CDR)

### Kafka

Módulo de mensajería para integración con sistemas externos:

- Eventos de creación de guías
- Sincronización de datos entre sistemas
- Procesamiento asíncrono de tareas

## 🛡️ Seguridad

### Recomendaciones

- ✅ Usar HTTPS en producción
- ✅ Configurar CORS apropiadamente
- ✅ Implementar rate limiting
- ✅ Validar todos los inputs con Zod
- ✅ Mantener actualizadas las dependencias
- ✅ Usar variables de entorno para credenciales
- ✅ Implementar JWT para autenticación (próximamente)

### Variables Sensibles

```env
DATABASE_URL=           # Conexión a MySQL
JWT_SECRET=             # Secret para tokens (futuro)
NUBEFACT_TOKEN=         # Token API Nubefact
NUBEFACT_RUC=           # RUC de la empresa
KAFKA_BROKERS=          # Brokers de Kafka
```

## 📊 Métricas y Monitoreo

### Health Check

```bash
curl http://localhost:3001/api/health
```

Respuesta:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-01-22T10:30:00.000Z"
}
```

### Dashboard

El módulo Dashboard proporciona:

- Métricas generales del sistema
- Estadísticas de guías emitidas
- Reportes de proyectos activos
- Análisis de personal y equipos

## 📞 Soporte

Para soporte técnico o consultas:

- **Equipo**: Desarrollo Ayala
- **API Base**: `GET /api/` para información general
- **Health Check**: `GET /api/health` para estado del sistema
- **Documentación**: Este README y comentarios en código

## 🔮 Próximas Características

- [ ] Sistema de autenticación JWT completo
- [ ] Módulo de facturación electrónica (facturas y boletas)
- [ ] Reportes avanzados con gráficos
- [ ] Notificaciones en tiempo real
- [ ] Aplicación móvil para operadores
- [ ] Integración con sistemas de GPS para seguimiento de vehículos
- [ ] Dashboard interactivo con más métricas

---

**© 2025 Maquinarias Ayala - Sistema Integral de Gestión Backend**

*Desarrollado con NestJS • Prisma • MySQL*
