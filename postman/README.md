# Colección Postman - Sistema de Facturación Electrónica E2E

## Descripción

Esta colección de Postman contiene tests end-to-end (E2E) completos para el sistema de facturación electrónica integrado con NUBEFACT.

## Archivos

- `Facturacion-E2E-Tests.postman_collection.json`: Colección principal con todos los endpoints
- `Facturacion-E2E.postman_environment.json`: Variables de entorno para testing local

## Instalación

### 1. Importar en Postman

1. Abrir Postman
2. Click en "Import" (botón superior izquierdo)
3. Seleccionar ambos archivos JSON:
   - `Facturacion-E2E-Tests.postman_collection.json`
   - `Facturacion-E2E.postman_environment.json`
4. Click en "Import"

### 2. Configurar Environment

1. En Postman, seleccionar el environment "Facturacion E2E - Local" en el dropdown superior derecho
2. Verificar que `baseUrl` apunte a tu servidor local (default: `http://localhost:3000`)

## Estructura de la Colección

La colección está organizada en 8 carpetas principales:

### 1. Health & Status
- **Health Check**: Verificar que el servicio está activo
- **Sistema Status (Dashboard)**: Estado completo del sistema (consumer, polling, detector)
- **Sistema Stats**: Estadísticas generales

### 2. Test - Crear Comprobantes
- **Crear Factura de Prueba (Tipo 1)**: Crea una factura de prueba
- **Crear Boleta de Prueba (Tipo 2)**: Crea una boleta de prueba
- **Crear Nota de Crédito (Tipo 3)**: Crea una NC vinculada a una factura
- **Crear Nota de Débito (Tipo 4)**: Crea una ND vinculada a una factura
- **Obtener Factura de Ejemplo**: Obtiene estructura de ejemplo

### 3. Test - Flujo Completo
- **Probar Flujo Completo**: Prueba el flujo completo de una factura
- **Validar Estructura**: Valida que una factura tenga la estructura correcta

### 4. Detector
- **Estadísticas del Detector**: Stats del servicio de detección
- **Forzar Detección**: Fuerza la detección de una factura específica

### 5. Polling
- **Estadísticas de Polling**: Stats del servicio de polling
- **Info de Polling por ID**: Información de polling de una factura
- **Forzar Verificación**: Fuerza la verificación inmediata
- **Detener Polling**: Detiene el polling de una factura
- **Limpiar Tareas Huérfanas**: Limpia tareas de polling antiguas

### 6. Control y Mantenimiento
- **Reintentar Facturas Fallidas**: Reintenta todas las facturas en estado FALLADO
- **Resetear Factura**: Resetea una factura para reintento manual

### 7. Debug
- **Debug Completo**: Información completa de debugging de una factura

### 8. Flujo E2E Completo
Secuencia de 5 pasos que prueba el flujo completo:
1. Crear factura de prueba
2. Verificar estado inicial
3. Esperar procesamiento (5 segundos)
4. Verificar polling activo
5. Debug final

## Uso Básico

### Prueba Rápida Individual

1. Ejecutar `Health Check` para verificar que el servicio está activo
2. Ejecutar `Crear Factura de Prueba (Tipo 1)`
3. Copiar el `id_factura` devuelto
4. Usar ese ID en los endpoints que lo requieran (reemplazar `:id` en la URL)

### Flujo E2E Automatizado

1. Ir a la carpeta "8. Flujo E2E Completo"
2. Ejecutar los 5 pasos en orden:
   - PASO 1: Crear Factura
   - PASO 2: Verificar Estado Inicial
   - PASO 3: Esperar 5 segundos
   - PASO 4: Verificar Estado de Polling
   - PASO 5: Debug Final

Las variables de entorno se actualizan automáticamente entre pasos.

### Ejecutar Toda la Colección

1. Click derecho en la colección "Sistema Facturación Electrónica - E2E Tests"
2. Seleccionar "Run collection"
3. Configurar:
   - Environment: "Facturacion E2E - Local"
   - Delay: 2000ms (entre requests)
4. Click en "Run"

## Variables de Entorno

La colección utiliza las siguientes variables (se actualizan automáticamente):

- `baseUrl`: URL base del API (default: `http://localhost:3000`)
- `test_factura_id`: ID de la última factura de prueba creada
- `test_boleta_id`: ID de la última boleta de prueba creada
- `test_nc_id`: ID de la última nota de crédito creada
- `test_nd_id`: ID de la última nota de débito creada
- `e2e_factura_id`: ID usado en el flujo E2E completo

## Tests Automáticos

Cada endpoint incluye tests automáticos que verifican:

- Status code correcto (200, 201, etc.)
- Estructura de respuesta esperada
- Valores de campos específicos
- Actualización de variables de entorno

Los tests se ejecutan automáticamente y los resultados se muestran en la pestaña "Test Results".

## Automatización con Newman

Para ejecutar la colección desde línea de comandos usando Newman:

```bash
# Instalar Newman (solo la primera vez)
npm install -g newman

# Ejecutar la colección
newman run Facturacion-E2E-Tests.postman_collection.json \
  -e Facturacion-E2E.postman_environment.json \
  --delay-request 2000 \
  --reporters cli,json \
  --reporter-json-export results.json

# Con más opciones
newman run Facturacion-E2E-Tests.postman_collection.json \
  -e Facturacion-E2E.postman_environment.json \
  --delay-request 2000 \
  --timeout-request 30000 \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export report.html
```

## Integración CI/CD

Ejemplo de integración en GitHub Actions:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install dependencies
        run: npm install

      - name: Start server
        run: npm start &

      - name: Wait for server
        run: sleep 10

      - name: Install Newman
        run: npm install -g newman newman-reporter-htmlextra

      - name: Run E2E tests
        run: |
          newman run postman/Facturacion-E2E-Tests.postman_collection.json \
            -e postman/Facturacion-E2E.postman_environment.json \
            --delay-request 2000 \
            --reporters cli,htmlextra \
            --reporter-htmlextra-export e2e-report.html

      - name: Upload test results
        uses: actions/upload-artifact@v2
        with:
          name: e2e-test-results
          path: e2e-report.html
```

## Notas Importantes

1. **Requisitos Previos**:
   - El servidor backend debe estar ejecutándose
   - Kafka debe estar activo
   - La base de datos debe estar accesible
   - NUBEFACT debe estar configurado (DEMO o producción)

2. **Orden de Ejecución**:
   - Algunos endpoints dependen de otros (ej: crear factura antes de probar flujo)
   - El flujo E2E debe ejecutarse en orden secuencial

3. **Tiempos de Espera**:
   - El polling puede tardar hasta 6 horas (720 intentos × 30s)
   - Para tests rápidos, usar "Forzar Verificación" después de crear facturas

4. **Limpieza**:
   - Las facturas de prueba se crean en la base de datos real
   - Usar endpoints de reset/cleanup después de testing
   - Considerar usar una base de datos separada para testing

## Troubleshooting

### Error: Cannot connect to server
- Verificar que el servidor esté ejecutándose en el puerto correcto
- Verificar la variable `baseUrl` en el environment

### Error: Factura not found
- Verificar que se ejecutó primero el endpoint de creación
- Verificar que el ID se guardó correctamente en las variables de entorno

### Tests fallan con timeout
- Aumentar el timeout en Settings → General → Request timeout
- Verificar que los servicios externos (Kafka, NUBEFACT) están respondiendo

### Polling no se completa
- Es normal, el polling puede tardar varios minutos
- Usar el endpoint de debug para verificar el estado actual
- Verificar logs del servidor para errores de NUBEFACT

## Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.
