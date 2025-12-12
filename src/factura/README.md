# Módulo de Facturas Electrónicas - NUBEFACT Integration

Sistema completo de gestión de facturas electrónicas integrado con NUBEFACT para emisión y validación ante SUNAT.

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │ HTTP/REST
         ↓
┌─────────────────┐
│   Controller    │
│ factura.ctrl.ts │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────────┐
│    Detector     │──→───│    Producer      │
│   (Cron Job)    │      │   (Kafka Pub)    │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ↓ Kafka Topic
                         ┌────────────────────┐
                         │     Consumer       │
                         │  (Kafka Sub)       │
                         └────────┬───────────┘
                                  │
                                  ↓
                         ┌────────────────────┐
                         │   NUBEFACT API     │
                         │  (envío SUNAT)     │
                         └────────┬───────────┘
                                  │
                                  ↓
                         ┌────────────────────┐
                         │  Polling Service   │
                         │ (verificar estado) │
                         └────────────────────┘
```

## Servicios del Módulo

### 1. FacturaDetectorService
**Ubicación:** `services/factura-detector.service.ts`

**Función:** Detecta facturas completas y listas para enviar a NUBEFACT.

**Características:**
- Cron job que se ejecuta cada 30 segundos
- Detecta facturas con `estado_factura = NULL`
- Valida que los datos estén completos
- Envía facturas válidas a Kafka para procesamiento

**Validaciones:**
- Proveedor debe existir y tener RUC
- Debe tener al menos un item
- Totales deben ser mayores a 0
- Fechas deben ser válidas

**Endpoints adicionales:**
```
POST /factura/detector/force/:id  - Forzar detección de una factura específica
GET  /factura/stats                - Estadísticas del detector
```

### 2. FacturaProducerService
**Ubicación:** `services/factura-producer.service.ts`

**Función:** Publica facturas al topic de Kafka para procesamiento asíncrono.

**Topic Kafka:** `ayala.factura.envio`

**Estructura del mensaje:**
```json
{
  "id_factura": 123,
  "tipo": "factura",
  "timestamp": "2025-12-11T10:30:00Z"
}
```

### 3. FacturaConsumerService
**Ubicación:** `services/factura-consumer.service.ts`

**Función:** Consume mensajes de Kafka y envía facturas a NUBEFACT.

**Proceso:**
1. Lee mensaje de Kafka
2. Obtiene datos completos de la factura desde BD
3. Transforma datos al formato NUBEFACT
4. Envía POST a NUBEFACT API
5. Actualiza estado en BD
6. Inicia polling automático si se envió correctamente

**Estados de Factura:**
- `NULL` - Factura recién creada, pendiente de detección
- `ENVIANDO` - En proceso de envío a NUBEFACT
- `ENVIADO` - Enviado exitosamente, esperando respuesta SUNAT
- `ACEPTADO` - Aceptado por SUNAT
- `RECHAZADO` - Rechazado por SUNAT
- `ERROR` - Error en el proceso de envío

### 4. FacturaPollingService
**Ubicación:** `services/factura-polling.service.ts`

**Función:** Verifica el estado de facturas enviadas consultando a NUBEFACT.

**Características:**
- Polling automático cada 10 segundos
- Máximo 30 intentos (5 minutos total)
- Actualiza enlaces de descarga (PDF, XML, CDR)
- Notifica estado final vía WebSocket

**Endpoint de consulta:**
```
GET /factura/polling/:id  - Obtener estado del polling
```

### 5. FacturaTestService
**Ubicación:** `services/factura-test.service.ts`

**Función:** Genera datos de prueba para testing.

**Métodos disponibles:**
- `createTestFactura()` - Crear factura de prueba
- `createTestBoleta()` - Crear boleta de prueba
- `createTestNotaCredito()` - Crear nota de crédito
- `createTestNotaDebito()` - Crear nota de débito
- `testFullFlow()` - Probar flujo completo E2E
- `validateFacturaStructure()` - Validar estructura de datos

**Endpoints de testing:**
```
POST /factura/test/factura        - Crear factura de prueba
POST /factura/test/boleta         - Crear boleta de prueba
POST /factura/test/nota-credito   - Crear nota de crédito
POST /factura/test/nota-debito    - Crear nota de débito
POST /factura/test/full-flow      - Probar flujo completo
```

## API REST Endpoints

### CRUD Básico

```
GET    /factura           - Listar todas las facturas
GET    /factura/:id       - Obtener factura por ID
POST   /factura           - Crear nueva factura
PUT    /factura/:id       - Actualizar factura
DELETE /factura/:id       - Eliminar factura
```

### Operaciones Especiales

```
GET    /factura/stats              - Estadísticas generales
GET    /factura/polling/:id        - Estado de polling
POST   /factura/detector/force/:id - Forzar detección
POST   /factura/reset/:id          - Resetear factura a estado inicial
POST   /factura/retry-failed       - Reintentar facturas fallidas
```

### Testing

```
POST   /factura/test/factura      - Crear factura de prueba
POST   /factura/test/boleta       - Crear boleta de prueba
POST   /factura/test/nota-credito - Crear nota de crédito
POST   /factura/test/nota-debito  - Crear nota de débito
POST   /factura/test/full-flow    - Probar flujo completo
```

## Base de Datos

### Tabla Principal: `factura`

**Campos principales:**
- `id_factura` - ID único autoincrementable
- `estado_factura` - Estado del proceso (NULL, ENVIANDO, ENVIADO, ACEPTADO, RECHAZADO, ERROR)
- `tipo_de_comprobante` - Tipo (1=Factura, 3=Boleta, 7=Nota Crédito, 8=Nota Débito)
- `serie` - Serie del comprobante (4 caracteres)
- `numero` - Número correlativo
- `id_proveedor` - FK a tabla proveedores
- `total` - Total del comprobante
- `aceptada_por_sunat` - Boolean, NULL hasta obtener respuesta
- `enlace_del_pdf` - URL del PDF en NUBEFACT
- `enlace_del_xml` - URL del XML en NUBEFACT
- `enlace_del_cdr` - URL del CDR en NUBEFACT

**Índices optimizados:**
- `idx_estado_factura` - Búsquedas por estado
- `idx_fecha_emision` - Ordenamiento por fecha
- `idx_id_proveedor` - Relación con proveedores
- `idx_aceptada_por_sunat` - Filtrar aceptadas/rechazadas
- `idx_estado_created` - Índice compuesto para detector
- `idx_proveedor_fecha` - Índice compuesto para reportes

### Tablas Relacionadas

**`factura_item`** - Items/líneas de la factura
- Relación 1:N con factura
- Contiene cantidad, precio, IGV, total
- Índice en `id_factura` para JOIN rápido

**`factura_guia`** - Guías de remisión asociadas
- Relación 1:N con factura
- Opcional, para transporte de mercancías

**`factura_venta_credito`** - Cuotas de venta a crédito
- Relación 1:N con factura
- Solo si forma de pago es crédito

## Integración con NUBEFACT

### Variables de Entorno

```bash
# NUBEFACT API
NUBEFACT_TOKEN=tu_token_aqui
NUBEFACT_RUTA=https://api.nubefact.com/api/v1  # Demo
# NUBEFACT_RUTA=https://api.produccion.nubefact.com/api/v1  # Producción

# RUC de la empresa emisora
NUBEFACT_RUC=20123456789
```

### Endpoints NUBEFACT

**Enviar comprobante:**
```
POST /enviar/comprobante
Headers:
  Authorization: Token {NUBEFACT_TOKEN}
  Content-Type: application/json
```

**Consultar estado:**
```
POST /consultar
Headers:
  Authorization: Token {NUBEFACT_TOKEN}
  Content-Type: application/json
Body:
{
  "tipo_comprobante": 1,
  "serie": "F001",
  "numero": 123
}
```

### Formato de Datos NUBEFACT

El sistema transforma automáticamente el formato de la BD al formato requerido por NUBEFACT:

**Ejemplo de factura:**
```json
{
  "operacion": "generar_comprobante",
  "tipo_de_comprobante": 1,
  "serie": "F001",
  "numero": 123,
  "sunat_transaction": 1,
  "cliente_tipo_de_documento": 6,
  "cliente_numero_de_documento": "20123456789",
  "cliente_denominacion": "EMPRESA DEMO SAC",
  "cliente_direccion": "Av. Principal 123",
  "fecha_de_emision": "2025-12-11",
  "moneda": 1,
  "porcentaje_de_igv": 18.00,
  "total_gravada": 100.00,
  "total_igv": 18.00,
  "total": 118.00,
  "enviar_automaticamente_a_la_sunat": true,
  "enviar_automaticamente_al_cliente": false,
  "items": [
    {
      "unidad_de_medida": "NIU",
      "codigo": "ITEM001",
      "descripcion": "Producto demo",
      "cantidad": 1,
      "valor_unitario": 100.00,
      "precio_unitario": 118.00,
      "subtotal": 100.00,
      "tipo_de_igv": 1,
      "igv": 18.00,
      "total": 118.00
    }
  ]
}
```

## Logging

El módulo utiliza Winston para logging estructurado:

**Niveles de log:**
- `error` - Errores críticos
- `warn` - Advertencias
- `info` - Información general
- `debug` - Debugging detallado

**Archivos de log:**
- `logs/error-YYYY-MM-DD.log` - Solo errores
- `logs/warn-YYYY-MM-DD.log` - Solo warnings
- `logs/combined-YYYY-MM-DD.log` - Todos los niveles
- `logs/exceptions.log` - Excepciones no capturadas
- `logs/rejections.log` - Promise rejections

**Rotación:** 30 días, 20MB por archivo, compresión automática.

## Flujo de Datos Completo

### 1. Creación de Factura (Frontend → Backend)

```
Usuario completa formulario
    ↓
POST /factura
    ↓
Se crea registro con estado_factura = NULL
    ↓
Se retorna al usuario con ID generado
```

### 2. Detección Automática (Cron Job)

```
Cada 30 segundos:
    ↓
Buscar facturas con estado = NULL
    ↓
Validar datos completos
    ↓
Si válido → enviar a Kafka
    ↓
Actualizar estado = 'ENVIANDO'
```

### 3. Procesamiento Asíncrono (Kafka)

```
Consumer recibe mensaje
    ↓
Obtiene datos completos de BD
    ↓
Transforma a formato NUBEFACT
    ↓
POST a NUBEFACT API
    ↓
Si éxito → estado = 'ENVIADO', inicia polling
Si error → estado = 'ERROR', guarda mensaje
```

### 4. Verificación de Estado (Polling)

```
Cada 10 segundos (max 30 intentos):
    ↓
Consultar estado en NUBEFACT
    ↓
Si aceptada_por_sunat = true:
    - estado = 'ACEPTADO'
    - Guardar enlaces PDF/XML/CDR
    - Notificar vía WebSocket
    - Detener polling
    ↓
Si rechazada:
    - estado = 'RECHAZADO'
    - Guardar mensaje de error
    - Detener polling
    ↓
Si pendiente:
    - Continuar polling
```

## Testing

### Colección Postman

El módulo incluye una colección Postman completa en:
```
ayala_back/src/factura/postman/
├── Ayala_Facturas_E2E.postman_collection.json
└── README.md
```

**Contenido:**
- 40+ requests organizados
- Tests automáticos
- Variables de entorno auto-gestionadas
- Flujo E2E automatizado

### Endpoints de Testing

Usa los endpoints `/factura/test/*` para crear datos de prueba:

```bash
# Crear factura de prueba
POST http://localhost:3000/factura/test/factura

# Probar flujo completo
POST http://localhost:3000/factura/test/full-flow
```

## Troubleshooting

### Factura no se envía automáticamente

**Verificar:**
1. Estado de la factura: `GET /factura/:id`
2. Si estado = NULL, verificar validaciones
3. Logs del detector: buscar mensajes de validación
4. Kafka está corriendo: verificar consumer activo

**Solución rápida:**
```bash
# Forzar detección manual
POST /factura/detector/force/:id
```

### Factura enviada pero no recibe respuesta

**Verificar:**
1. Estado del polling: `GET /factura/polling/:id`
2. Logs del polling service
3. Conexión con NUBEFACT

**Reintentar:**
```bash
# Resetear y reenviar
POST /factura/reset/:id
```

### Error de NUBEFACT

**Verificar campos en BD:**
- `sunat_description` - Descripción del error
- `sunat_note` - Notas adicionales
- `sunat_responsecode` - Código de respuesta
- `sunat_soap_error` - Error SOAP si existe

### Reintentar facturas fallidas

```bash
# Reintentar todas las facturas con estado ERROR
POST /factura/retry-failed
```

## Variables de Configuración

```bash
# .env
NODE_ENV=development              # development | production
LOG_LEVEL=debug                   # error | warn | info | debug
ENABLE_FILE_LOGGING=true          # Habilitar logs en archivos

# NUBEFACT
NUBEFACT_TOKEN=your_token_here
NUBEFACT_RUTA=https://api.nubefact.com/api/v1
NUBEFACT_RUC=20123456789

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=ayala-factura-consumer
KAFKA_CLIENT_ID=ayala-factura-client

# Polling
POLLING_INTERVAL=10000            # 10 segundos
POLLING_MAX_ATTEMPTS=30           # 30 intentos = 5 minutos
```

## Próximas Mejoras

- [ ] Implementar rate limiting para NUBEFACT API
- [ ] Dashboard de métricas en tiempo real
- [ ] Notificaciones por email cuando factura es aceptada
- [ ] Descarga automática de archivos desde NUBEFACT
- [ ] Sincronización con sistema contable
- [ ] Reportes de facturación mensual
- [ ] Integración con otros PSE (Proveedores de Servicios Electrónicos)

## Soporte

Para reportar bugs o solicitar features:
- Crear issue en el repositorio
- Contactar al equipo de desarrollo

## Licencia

Uso interno - Maquinarias Ayala
