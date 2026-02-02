# Cómo Usar Prisma con Flink

## 🎯 El Desafío

- **Prisma**: ORM de TypeScript/Node.js
- **Flink**: Framework de Java/Scala

**No puedes usar Prisma directamente en Flink**, pero hay varias formas de integrarlos:

---

## ✅ Opción 1: Flink SQL (Recomendado)

**Ventaja:** Flink SQL se conecta directo a MySQL sin necesidad de Prisma.

### Configuración:

```yaml
# En flink/.env
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=ayala_db
MYSQL_USER=root
MYSQL_PASSWORD=tu_password
```

### Ejemplo: Procesar facturas

```sql
-- Ver: examples/flink-sql-example.sql

-- 1. Conectar a tabla Prisma
CREATE TABLE facturas_mysql (
  id BIGINT,
  serie STRING,
  numero STRING,
  -- ... campos de tu modelo Prisma
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://mysql:3306/ayala_db',
  'table-name' = 'factura',  -- Nombre real en BD
  'username' = 'root',
  'password' = 'tu_password'
);

-- 2. Consultar en tiempo real
SELECT * FROM facturas_mysql WHERE estado = 'PROCESANDO';

-- 3. Crear agregaciones
SELECT proveedor_id, COUNT(*), SUM(monto_total)
FROM facturas_mysql
GROUP BY proveedor_id;
```

**Cómo ejecutar:**
```bash
# 1. Entrar al SQL Client de Flink
docker exec -it ayala-flink-jobmanager ./bin/sql-client.sh

# 2. Copiar y pegar tus queries SQL
# 3. Listo! Flink procesa en tiempo real
```

---

## ✅ Opción 2: Usar el Schema de Prisma como Referencia

**Idea:** Generar código Java de Flink basándote en tu `schema.prisma`.

### Paso 1: Ver tu schema Prisma

```prisma
// prisma/schema.prisma
model Factura {
  id                    BigInt    @id @default(autoincrement())
  serie                 String    @db.VarChar(10)
  numero                String    @db.VarChar(20)
  fecha_emision         DateTime  @db.DateTime(0)
  proveedor_id          BigInt?
  cliente_razon_social  String?   @db.VarChar(255)
  monto_total           Decimal   @db.Decimal(10, 2)
  estado                String?   @db.VarChar(50)
  // ...
}
```

### Paso 2: Crear clase Java equivalente

```java
// src/main/java/com/ayala/models/Factura.java
package com.ayala.models;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class Factura {
    private Long id;
    private String serie;
    private String numero;
    private LocalDateTime fechaEmision;
    private Long proveedorId;
    private String clienteRazonSocial;
    private BigDecimal montoTotal;
    private String estado;

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    // ... resto de getters/setters
}
```

### Paso 3: Usar JDBC en Flink

```java
// Flink Job que usa JDBC (misma BD que Prisma)
import org.apache.flink.connector.jdbc.*;

public class FacturaProcessor {
    public static void main(String[] args) {
        StreamExecutionEnvironment env =
            StreamExecutionEnvironment.getExecutionEnvironment();

        // Configuración JDBC (misma BD que usa Prisma)
        JdbcConnectionOptions jdbcOptions =
            new JdbcConnectionOptions.JdbcConnectionOptionsBuilder()
                .withUrl("jdbc:mysql://mysql:3306/ayala_db")
                .withDriverName("com.mysql.cj.jdbc.Driver")
                .withUsername("root")
                .withPassword("tu_password")
                .build();

        // Leer facturas desde MySQL
        DataStream<Factura> facturas = env
            .createInput(
                JdbcInputFormat.buildJdbcInputFormat()
                    .setQuery("SELECT * FROM factura WHERE estado = 'PROCESANDO'")
                    .setRowTypeInfo(...)
                    .setJdbcConnectionOptions(jdbcOptions)
                    .finish()
            );

        // Procesar
        facturas
            .filter(f -> f.getMontoTotal().compareTo(new BigDecimal("1000")) > 0)
            .map(f -> {
                // Tu lógica aquí
                return f;
            })
            // Guardar de vuelta en MySQL
            .addSink(
                JdbcSink.sink(
                    "UPDATE factura SET estado = ? WHERE id = ?",
                    (ps, factura) -> {
                        ps.setString(1, "COMPLETADO");
                        ps.setLong(2, factura.getId());
                    },
                    jdbcOptions
                )
            );

        env.execute("Procesador de Facturas");
    }
}
```

---

## ✅ Opción 3: Híbrido (NestJS + Flink)

**Idea:** NestJS maneja la lógica con Prisma, Flink solo procesa streams.

### Arquitectura:

```
Frontend
    ↓
NestJS Backend (con Prisma)
    ↓
Kafka ← Publica eventos
    ↓
Flink ← Solo procesa streams (no accede a BD con Prisma)
    ↓
Kafka ← Publica resultados
    ↓
NestJS Backend ← Consume resultados y guarda con Prisma
```

### Ejemplo:

**NestJS (produce eventos):**
```typescript
// facturas.service.ts
async crearFactura(data: CreateFacturaDto) {
  // 1. Guardar en BD con Prisma
  const factura = await this.prisma.factura.create({ data });

  // 2. Publicar evento a Kafka para Flink
  await this.kafkaProducer.send({
    topic: 'facturas.nuevas',
    messages: [{ value: JSON.stringify(factura) }]
  });

  return factura;
}
```

**Flink (procesa streams):**
```java
// Solo procesa el stream, no toca BD directamente
DataStream<String> facturas = env
  .addSource(new FlinkKafkaConsumer<>("facturas.nuevas", ...));

// Procesar, enriquecer, validar
DataStream<String> procesadas = facturas
  .map(f -> transformarNubefact(f))
  .filter(f -> validar(f));

// Publicar resultado de vuelta a Kafka
procesadas.addSink(
  new FlinkKafkaProducer<>("facturas.procesadas", ...)
);
```

**NestJS (consume resultados):**
```typescript
// kafka.consumer.ts
@OnKafkaMessage('facturas.procesadas')
async handleFacturaProcesada(@Payload() message: any) {
  // Actualizar en BD con Prisma
  await this.prisma.factura.update({
    where: { id: message.id },
    data: { estado: 'COMPLETADO', enlace_pdf: message.pdf_url }
  });

  // Notificar frontend via WebSocket
  this.websocketGateway.emit('factura.completada', message);
}
```

**✅ Ventajas:**
- Sigues usando Prisma en NestJS
- Flink solo procesa streams
- Separación de responsabilidades

---

## ✅ Opción 4: Script Helper para Generar SQL de Flink

Crear un script que lee tu `schema.prisma` y genera las DDL de Flink SQL:

```bash
# Futuro: Script que genera esto automáticamente
npm run prisma:to:flink
```

**Generaría:**
```sql
-- Auto-generado desde schema.prisma

CREATE TABLE factura (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  -- ... todos los campos de tu modelo Prisma
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://mysql:3306/ayala_db',
  'table-name' = 'factura'
);
```

---

## 🎯 Recomendación para tu Caso

### Para empezar (sin escribir código Java):

**Usa Flink SQL** (Opción 1)
- Conecta directo a MySQL
- No necesitas Prisma en Flink
- Sintaxis SQL familiar
- Suficiente para el 80% de casos

### Para casos avanzados:

**Arquitectura Híbrida** (Opción 3)
- NestJS + Prisma: CRUD y lógica de negocio
- Flink: Procesamiento de streams
- Kafka: Mensajería entre ambos

---

## 🚀 Cómo Empezar Hoy

### 1. Probar Flink SQL:

```bash
# Entrar al SQL Client
docker exec -it ayala-flink-jobmanager ./bin/sql-client.sh

# Crear tabla conectada a tu BD
CREATE TABLE facturas (
  id BIGINT,
  serie STRING,
  numero STRING,
  monto_total DECIMAL(10,2)
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://mysql:3306/ayala_db',
  'table-name' = 'factura',
  'username' = 'root',
  'password' = 'tu_password'
);

# Consultar
SELECT * FROM facturas LIMIT 10;

# Listo! Ya estás usando Flink con tu BD de Prisma
```

### 2. Ver ejemplos:

```bash
cd ~/ayala_back/flink/examples
cat flink-sql-example.sql
```

---

## 📚 Resumen

| Opción | Complejidad | Usa Prisma | Recomendado Para |
|--------|-------------|------------|------------------|
| **Flink SQL** | Baja | No (JDBC directo) | Empezar rápido, queries simples |
| **Java + JDBC** | Alta | No (clases Java) | Jobs complejos, custom logic |
| **Híbrido** | Media | Sí (en NestJS) | Producción, separación clara |
| **Helper Script** | Baja | Sí (genera SQL) | Automatizar configuración |

**Mi recomendación:** Empieza con **Flink SQL** (Opción 1). Es la forma más rápida de empezar sin escribir código Java y funciona perfectamente con tu BD actual.

---

¿Quieres que te ayude a configurar Flink SQL con tus tablas de Prisma?
