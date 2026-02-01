# Guía de Inicio Rápido - Flink Stack

## ⚡ Inicio en 3 Pasos

### 1. Configurar Variables de Entorno

Edita `.env` y ajusta las conexiones a tus servicios existentes:

```bash
# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# MySQL
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_PASSWORD=tu_password_real

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

### 2. Crear Red Compartida

```bash
# Crear red (si no existe)
docker network create ayala-network

# Conectar tus servicios existentes
docker network connect ayala-network <nombre-contenedor-kafka>
docker network connect ayala-network <nombre-contenedor-mysql>
docker network connect ayala-network <nombre-contenedor-redis>
docker network connect ayala-network <nombre-contenedor-nestjs>
```

### 3. Iniciar Servicios

```bash
# Opción A: Usando script
./scripts/start.sh

# Opción B: Docker Compose directamente
docker-compose up -d
```

## ✅ Verificación

Accede a las siguientes URLs:

- **Flink Web UI:** http://localhost:8081
- **Elasticsearch:** http://localhost:9200
- **Kibana:** http://localhost:5601

## 📊 Ver Estado

```bash
# Opción A: Script
./scripts/status.sh

# Opción B: Docker Compose
docker-compose ps
```

## 📝 Ver Logs

```bash
# Todos los servicios
./scripts/logs.sh

# Servicio específico
./scripts/logs.sh flink-jobmanager
./scripts/logs.sh elasticsearch
```

## 🛑 Detener

```bash
# Opción A: Script
./scripts/stop.sh

# Opción B: Docker Compose
docker-compose down
```

## 🎯 Primer Job de Flink

### Ejemplo Simple: Contador de Eventos

```java
// FacturaCounter.java
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.connectors.kafka.FlinkKafkaConsumer;

public class FacturaCounter {
    public static void main(String[] args) throws Exception {

        // 1. Setup del entorno
        StreamExecutionEnvironment env =
            StreamExecutionEnvironment.getExecutionEnvironment();

        // 2. Habilitar checkpointing cada 60s
        env.enableCheckpointing(60000);

        // 3. Consumir de Kafka
        Properties props = new Properties();
        props.setProperty("bootstrap.servers", "kafka:9092");
        props.setProperty("group.id", "flink-factura-counter");

        DataStream<String> facturas = env
            .addSource(new FlinkKafkaConsumer<>(
                "facturas.nuevas",
                new SimpleStringSchema(),
                props
            ));

        // 4. Contar eventos cada minuto
        facturas
            .map(f -> 1)
            .timeWindowAll(Time.minutes(1))
            .sum(0)
            .print();

        // 5. Ejecutar
        env.execute("Contador de Facturas");
    }
}
```

### Compilar y Subir:

```bash
# 1. Compilar (Maven)
mvn clean package

# 2. Copiar JAR a carpeta jobs
cp target/factura-counter.jar ./jobs/

# 3. Subir via Web UI
# http://localhost:8081 → Submit New Job → Upload JAR
```

## 🔧 Troubleshooting Rápido

### Problema: Servicios no inician

```bash
# Ver logs
docker-compose logs

# Reiniciar
docker-compose restart
```

### Problema: No hay memoria suficiente

```bash
# Ver uso de memoria
free -h

# Reducir memoria de Elasticsearch
# En docker-compose.yml cambiar:
ELASTICSEARCH_MEMORY=1g  # de 2g a 1g
```

### Problema: Puerto ocupado

```bash
# Verificar qué usa el puerto 8081
netstat -tuln | grep 8081

# Cambiar puerto en docker-compose.yml
ports:
  - "8082:8081"  # Cambiar 8081 a 8082
```

## 📚 Siguiente Paso

Lee el [README.md](./README.md) completo para información detallada sobre:
- Arquitectura completa
- Casos de uso
- Desarrollo de jobs
- Monitoreo avanzado
- Configuración de producción

## 🎓 Recursos de Aprendizaje

### Tutoriales oficiales:
- https://nightlies.apache.org/flink/flink-docs-release-1.18/docs/try-flink/datastream/
- https://github.com/apache/flink-training

### Documentación:
- Flink: https://flink.apache.org/docs/stable/
- Elasticsearch: https://www.elastic.co/guide/

### Video recomendado:
- "Apache Flink in 100 Seconds": https://www.youtube.com/watch?v=kj6rZkjRDcI

---

¿Problemas? Revisa el [README.md](./README.md) sección Troubleshooting.
