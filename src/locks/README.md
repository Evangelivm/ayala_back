# Sistema de Locks Distribuidos

Sistema de bloqueos (locks) para evitar condiciones de carrera en operaciones críticas como la creación y actualización de facturas.

## Características

- **Locks con timeout automático**: Cada lock se auto-libera después del TTL configurado
- **Validación de tokens**: Solo el cliente que adquirió el lock puede liberarlo
- **Limpieza automática**: Locks expirados se limpian periódicamente
- **Estadísticas**: Endpoints para monitorear el estado del sistema

## Endpoints Disponibles

### 1. Adquirir Lock

```http
POST /api/locks/acquire
Content-Type: application/json

{
  "resource": "factura:create:FFF1",
  "ttl": 30000,
  "clientId": "client-abc123"
}
```

**Respuesta exitosa:**
```json
{
  "acquired": true,
  "token": "lock-1704567890123-abc123def456",
  "expiresIn": 30000
}
```

**Respuesta cuando el lock ya está tomado:**
```json
{
  "acquired": false,
  "error": "Recurso bloqueado por otro proceso. Expira en 25000ms"
}
```

### 2. Liberar Lock

```http
POST /api/locks/release
Content-Type: application/json

{
  "resource": "factura:create:FFF1",
  "token": "lock-1704567890123-abc123def456"
}
```

**Respuesta:**
```json
{
  "released": true
}
```

### 3. Información de Lock

```http
GET /api/locks/info/factura:create:FFF1
```

**Respuesta:**
```json
{
  "exists": true,
  "resource": "factura:create:FFF1",
  "clientId": "client-abc123",
  "acquiredAt": "2024-01-06T12:34:56.789Z",
  "expiresAt": "2024-01-06T12:35:26.789Z",
  "timeRemaining": 25000
}
```

### 4. Listar Todos los Locks

```http
GET /api/locks
```

**Respuesta:**
```json
{
  "count": 2,
  "locks": [
    {
      "resource": "factura:create:FFF1",
      "clientId": "client-abc123",
      "acquiredAt": "2024-01-06T12:34:56.789Z",
      "expiresAt": "2024-01-06T12:35:26.789Z",
      "timeRemaining": 25000
    }
  ]
}
```

### 5. Estadísticas

```http
GET /api/locks/stats
```

**Respuesta:**
```json
{
  "totalLocks": 5,
  "activeLocks": 4,
  "expiredLocks": 1,
  "locksByClient": {
    "client-abc123": 2,
    "client-xyz789": 2
  }
}
```

### 6. Liberar Locks de un Cliente

```http
DELETE /api/locks/client/client-abc123
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Liberados 2 locks del cliente client-abc123",
  "releasedCount": 2
}
```

## Uso desde otros Servicios

Puedes inyectar el `LocksService` en otros módulos:

```typescript
import { Injectable } from '@nestjs/common';
import { LocksService } from '../locks/locks.service';

@Injectable()
export class FacturaService {
  constructor(private readonly locksService: LocksService) {}

  async crearFactura(data: any) {
    // Adquirir lock
    const lockResult = await this.locksService.acquire({
      resource: `factura:create:${data.serie}`,
      ttl: 30000,
      clientId: 'factura-service',
    });

    if (!lockResult.acquired) {
      throw new Error('No se pudo adquirir el lock');
    }

    try {
      // Realizar operación crítica
      const factura = await this.prisma.factura.create({ data });
      return factura;
    } finally {
      // Siempre liberar el lock
      await this.locksService.release({
        resource: `factura:create:${data.serie}`,
        token: lockResult.token!,
      });
    }
  }
}
```

## Recursos Comunes

Convenciones para nombrar recursos:

- **Crear factura**: `factura:create:SERIE` (ej: `factura:create:FFF1`)
- **Actualizar factura**: `factura:ID:update` (ej: `factura:123:update`)
- **Enviar a SUNAT**: `factura:ID:sunat` (ej: `factura:123:sunat`)
- **Lote de facturas**: `factura:batch:BATCH_ID` (ej: `factura:batch:20240106-001`)

## Configuración

- **TTL por defecto**: 30 segundos
- **TTL máximo**: 5 minutos (300 segundos)
- **Limpieza automática**: Cada 10 segundos

## Notas Importantes

⚠️ **Implementación Actual**: Esta versión usa memoria local y funciona para un único servidor.

📌 **Para Producción**: Si necesitas múltiples instancias del backend, debes migrar a una solución con Redis usando bibliotecas como:
- `redlock` - Implementación de RedLock algorithm
- `ioredis` - Cliente Redis para Node.js

## Migración a Redis (Futuro)

Para implementar locks verdaderamente distribuidos con Redis:

1. Instalar dependencias:
```bash
npm install ioredis redlock
```

2. Modificar `LocksService` para usar Redis en lugar de Map
3. Configurar conexión a Redis en variables de entorno

## Testing

Puedes probar los locks usando curl:

```bash
# Adquirir lock
curl -X POST http://localhost:3001/api/locks/acquire \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "factura:create:FFF1",
    "ttl": 30000,
    "clientId": "test-client"
  }'

# Ver estadísticas
curl http://localhost:3001/api/locks/stats

# Liberar lock
curl -X POST http://localhost:3001/api/locks/release \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "factura:create:FFF1",
    "token": "YOUR_TOKEN_HERE"
  }'
```
