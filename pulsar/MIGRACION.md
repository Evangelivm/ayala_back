# Migración de Kafka a Apache Pulsar

## Resumen
Este documento describe los pasos necesarios para migrar el backend de Kafka a Apache Pulsar.

## Configuración Actual

### Kafka
- **Broker**: `161.132.54.103:9092`
- **UI**: Puerto `8081`
- **Particiones**: 6
- **Replicación**: Factor 1
- **Auto-create topics**: Habilitado

### Pulsar
- **Broker**: Puerto `6650`
- **HTTP**: Puerto `8080`
- **Manager UI**: Puertos `9527`, `7750`
- **Modo**: Standalone

## Pasos de Migración

### 1. Dependencias
Reemplazar las dependencias de Kafka por Pulsar en `package.json`:

```bash
# Remover
npm uninstall kafkajs

# Instalar
npm install pulsar-client
```

### 2. Configuración del Cliente

#### Antes (Kafka)
```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['161.132.54.103:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'my-group' });
```

#### Después (Pulsar)
```typescript
import Pulsar from 'pulsar-client';

const client = new Pulsar.Client({
  serviceUrl: 'pulsar://161.132.54.103:6650'
});

const producer = await client.createProducer({
  topic: 'persistent://public/default/my-topic'
});

const consumer = await client.subscribe({
  topic: 'persistent://public/default/my-topic',
  subscription: 'my-subscription',
  subscriptionType: 'Shared'
});
```

### 3. Producción de Mensajes

#### Antes (Kafka)
```typescript
await producer.send({
  topic: 'my-topic',
  messages: [
    { key: 'key1', value: 'hello world' }
  ]
});
```

#### Después (Pulsar)
```typescript
await producer.send({
  data: Buffer.from('hello world'),
  properties: { key: 'key1' }
});
```

### 4. Consumo de Mensajes

#### Antes (Kafka)
```typescript
await consumer.subscribe({ topic: 'my-topic', fromBeginning: true });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    console.log({
      value: message.value.toString(),
    });
  },
});
```

#### Después (Pulsar)
```typescript
for await (const message of consumer) {
  console.log(message.getData().toString());
  await consumer.acknowledge(message);
}
```

### 5. Actualizar Variables de Entorno

Modificar `.env` o configuración:

```env
# Antes
KAFKA_BROKER=161.132.54.103:9092

# Después
PULSAR_SERVICE_URL=pulsar://161.132.54.103:6650
PULSAR_HTTP_URL=http://161.132.54.103:8080
```

### 6. Mapeo de Conceptos

| Kafka | Pulsar | Notas |
|-------|--------|-------|
| Topic | Topic | Pulsar usa formato `persistent://tenant/namespace/topic` |
| Partition | Partition | Similar concepto |
| Consumer Group | Subscription | Pulsar tiene 4 tipos: Exclusive, Shared, Failover, Key_Shared |
| Offset | Message ID | Pulsar usa Message ID en lugar de offset |
| Broker | Broker | Mismo concepto |

### 7. Archivos a Modificar

Buscar y actualizar todos los archivos que usen Kafka:

```bash
# Buscar importaciones de Kafka
grep -r "from 'kafkajs'" src/
grep -r "require('kafkajs')" src/

# Buscar configuraciones
grep -r "KAFKA_" src/
grep -r "kafka" src/
```

### 8. Levantar Pulsar

```bash
cd pulsar
docker-compose up -d
```

Acceder a Pulsar Manager: `http://localhost:9527`

### 9. Testing

1. Crear topics de prueba en Pulsar
2. Migrar un servicio pequeño primero
3. Verificar producción y consumo de mensajes
4. Monitorear logs y métricas
5. Migrar progresivamente otros servicios

### 10. Rollback

Si es necesario volver a Kafka:

```bash
cd ../kafka
docker-compose up -d
```

Revertir cambios de código usando Git.

## Ventajas de Pulsar sobre Kafka

- **Multi-tenancy nativo**: Tenants y namespaces
- **Geo-replicación**: Replicación entre clusters más simple
- **Múltiples modos de suscripción**: Exclusive, Shared, Failover, Key_Shared
- **Almacenamiento en capas**: BookKeeper + almacenamiento a largo plazo
- **Schema Registry incluido**: No necesita componentes externos
- **Funciones nativas**: Pulsar Functions para procesamiento

## Desventajas/Consideraciones

- Ecosistema más pequeño que Kafka
- Menos herramientas de terceros
- Curva de aprendizaje diferente
- Cliente Node.js menos maduro que kafkajs

## Referencias

- [Documentación Pulsar](https://pulsar.apache.org/docs/next/)
- [Cliente Node.js](https://pulsar.apache.org/docs/next/client-libraries-node/)
- [Comparación Kafka vs Pulsar](https://pulsar.apache.org/docs/next/concepts-compared-to-kafka/)
