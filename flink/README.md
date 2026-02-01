# Apache Flink Stack - Sistema Ayala

Stack de procesamiento en tiempo real con Apache Flink, RocksDB y Elasticsearch para el sistema de Maquinarias Ayala.

## 📋 Contenido

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Uso](#uso)
- [Componentes](#componentes)
- [Configuración](#configuración)
- [Desarrollo](#desarrollo)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Sistema Ayala                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Next.js) → Backend (NestJS)                       │
│                            ↓                                  │
│                       Kafka Topics                            │
│                            ↓                                  │
│                   ┌────────────────┐                         │
│                   │ Flink Cluster  │                         │
│                   ├────────────────┤                         │
│                   │  JobManager    │ (Coordinador)           │
│                   │  TaskManager 1 │ (Ejecutor)              │
│                   │  TaskManager 2 │ (Ejecutor)              │
│                   └────────────────┘                         │
│                            ↓                                  │
│              ┌─────────────┼─────────────┐                  │
│              ↓             ↓             ↓                   │
│         RocksDB       MySQL      Elasticsearch              │
│        (Estado)    (Persistencia)   (Búsquedas)             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos:

1. **Backend NestJS** → Publica eventos a **Kafka**
2. **Flink** → Consume eventos de Kafka
3. **Flink** → Procesa streams en tiempo real
4. **RocksDB** → Guarda estado interno de Flink
5. **MySQL** → Persistencia de resultados
6. **Elasticsearch** → Indexa para búsquedas rápidas
7. **WebSocket** → Notifica frontend en tiempo real

---

## 💻 Requisitos

### Hardware (VPS):
- **RAM:** 32GB (mínimo recomendado)
- **CPU:** 8 cores
- **Disco:** 100GB SSD

### Distribución de Memoria:
```
Total: 32GB
├── Sistema Operativo:    2GB
├── NestJS Backend:       4GB
├── MySQL:                6GB
├── Redis:                2GB
├── Kafka:                6GB
├── Flink JobManager:     2GB
├── Flink TaskManager 1:  4GB
├── Flink TaskManager 2:  4GB
└── Elasticsearch:        4GB (opcional)
```

### Software:
- Docker 24.x+
- Docker Compose 2.x+
- Git

### Servicios Externos (debe estar corriendo):
- Kafka (puerto 9092)
- MySQL (puerto 3306)
- Redis (puerto 6379)
- NestJS Backend (puerto 3000)

---

## 🚀 Instalación

### 1. Clonar o verificar estructura:

```bash
cd D:\recuperacion\ayala\ayala_back\flink
```

### 2. Verificar estructura de directorios:

```
flink/
├── docker compose.yml
├── .env
├── README.md
├── config/
│   └── flink-conf.yaml
├── checkpoints/          # Automático (RocksDB guarda aquí)
├── jobs/                 # Coloca aquí tus .jar compilados
└── scripts/              # Scripts útiles
```

### 3. Conectar con la red de Docker existente:

```bash
# Crear red compartida (si no existe)
docker network create shared_network

# Conectar tus servicios existentes
docker network connect shared_network <nombre-contenedor-kafka>
docker network connect shared_network <nombre-contenedor-mysql>
docker network connect shared_network <nombre-contenedor-redis>
docker network connect shared_network <nombre-contenedor-nestjs>
```

### 4. Configurar variables de entorno:

Edita `.env` y ajusta según tu configuración:

```bash
# Especialmente estos:
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
MYSQL_HOST=mysql
MYSQL_PASSWORD=tu_password_real
REDIS_HOST=redis
```

### 5. Levantar servicios:

```bash
# Levantar todo
docker compose up -d

# Ver logs
docker compose logs -f

# Verificar estado
docker compose ps
```

### 6. Verificar que todo funciona:

```bash
# Flink Web UI
http://localhost:8081

# Elasticsearch
curl http://localhost:9200

# Kibana (opcional)
http://localhost:5601
```

---

## 🎮 Uso

### Acceder a Flink Web UI:

```
http://localhost:8081
```

Desde aquí puedes:
- Ver jobs en ejecución
- Monitorear TaskManagers
- Ver checkpoints
- Cancelar/reiniciar jobs
- Ver métricas en tiempo real

### Subir un Job a Flink:

#### Opción 1: Via Web UI
1. Ir a http://localhost:8081
2. Click en "Submit New Job"
3. Upload tu archivo `.jar`
4. Configurar parámetros
5. Click "Submit"

#### Opción 2: Via CLI
```bash
docker exec -it ayala-flink-jobmanager flink run \
  /opt/flink/jobs/factura-processor.jar \
  --parallelism 4
```

#### Opción 3: Via REST API
```bash
curl -X POST http://localhost:8081/jars/upload \
  -F "jarfile=@./jobs/factura-processor.jar"
```

### Comandos Útiles:

```bash
# Ver jobs en ejecución
docker exec -it ayala-flink-jobmanager flink list

# Cancelar un job
docker exec -it ayala-flink-jobmanager flink cancel <job-id>

# Ver logs de JobManager
docker logs ayala-flink-jobmanager -f

# Ver logs de TaskManager
docker logs ayala-flink-taskmanager-1 -f

# Crear savepoint (backup manual)
docker exec -it ayala-flink-jobmanager flink savepoint <job-id>

# Restaurar desde savepoint
docker exec -it ayala-flink-jobmanager flink run \
  -s /opt/flink/checkpoints/savepoints/savepoint-xxx \
  /opt/flink/jobs/factura-processor.jar
```

---

## 🧩 Componentes

### 1. **Flink JobManager**
- **Puerto:** 8081 (Web UI)
- **Función:** Coordinador del cluster
- **Memoria:** 2GB
- **Responsabilidades:**
  - Scheduling de tareas
  - Checkpointing
  - Recuperación ante fallos

### 2. **Flink TaskManager 1 & 2**
- **Función:** Ejecutores de tareas
- **Memoria:** 4GB cada uno
- **Slots:** 4 por TaskManager (8 total)
- **Responsabilidades:**
  - Ejecutar operadores de stream
  - Mantener estado en RocksDB
  - Buffering de red

### 3. **RocksDB (State Backend)**
- **Ubicación:** `/opt/flink/checkpoints`
- **Función:** Persistencia de estado
- **Características:**
  - Checkpoints incrementales
  - Recuperación ante fallos
  - Soporta estados grandes (GB/TB)

### 4. **Elasticsearch**
- **Puerto:** 9200 (REST API)
- **Función:** Motor de búsqueda
- **Memoria:** 2-4GB
- **Casos de uso:**
  - Búsqueda full-text de facturas
  - Autocompletado
  - Reportes rápidos
  - Análisis de logs

### 5. **Kibana (Opcional)**
- **Puerto:** 5601
- **Función:** UI para Elasticsearch
- **Características:**
  - Visualizaciones
  - Dashboards
  - Exploración de datos

---

## ⚙️ Configuración

### Configuración de Flink (`config/flink-conf.yaml`):

Principales configuraciones:

```yaml
# State Backend
state.backend: rocksdb
state.checkpoints.dir: file:///opt/flink/checkpoints
state.backend.incremental: true

# Checkpointing
execution.checkpointing.interval: 60000  # Cada 60s
execution.checkpointing.mode: EXACTLY_ONCE

# Restart Strategy
restart-strategy: exponential-delay
restart-strategy.exponential-delay.initial-backoff: 1s
restart-strategy.exponential-delay.max-backoff: 5min

# Paralelismo
parallelism.default: 4
taskmanager.numberOfTaskSlots: 4
```

### Ajustar Memoria:

Si necesitas más/menos memoria:

1. Edita `docker compose.yml`:
```yaml
flink-taskmanager-1:
  deploy:
    resources:
      limits:
        memory: 8G  # Cambiar aquí
```

2. Edita `config/flink-conf.yaml`:
```yaml
taskmanager.memory.process.size: 8192m  # Cambiar aquí
```

3. Reinicia:
```bash
docker compose restart flink-taskmanager-1
```

### Ajustar Paralelismo:

```yaml
# En flink-conf.yaml
parallelism.default: 8  # Cambiar de 4 a 8

# En docker compose.yml
TASK_MANAGER_NUMBER_OF_TASK_SLOTS: 8
```

---

## 💡 Desarrollo

### Estructura de un Job de Flink:

```typescript
// Ejemplo conceptual en TypeScript (en producción se usa Java/Scala)

// 1. Setup del entorno
const env = StreamExecutionEnvironment.getExecutionEnvironment();

// 2. Configurar checkpointing
env.enableCheckpointing(60000); // 60s

// 3. Consumir de Kafka
const facturas = env
  .addSource(new FlinkKafkaConsumer(
    'facturas.nuevas',
    new JSONSchema(),
    kafkaProps
  ));

// 4. Transformar
const transformadas = facturas
  .map(f => transformarNubefact(f))
  .filter(f => validarFactura(f));

// 5. Procesar con estado
const porProveedor = transformadas
  .keyBy(f => f.proveedor_id)
  .window(TumblingEventTimeWindows.of(Time.hours(1)))
  .aggregate(new FacturaAggregator());

// 6. Escribir a MySQL
porProveedor.addSink(new JDBCSink(mysqlConfig));

// 7. Escribir a Elasticsearch
porProveedor.addSink(new ElasticsearchSink(esConfig));

// 8. Ejecutar
env.execute("Procesador de Facturas Ayala");
```

### Ciclo de Desarrollo:

1. **Desarrollar job localmente** (Java/Scala)
2. **Compilar a JAR:**
   ```bash
   mvn clean package
   ```
3. **Copiar JAR a carpeta jobs:**
   ```bash
   cp target/factura-processor.jar ./flink/jobs/
   ```
4. **Subir a Flink via Web UI**
5. **Monitorear en dashboard**
6. **Iterar**

---

## 🔧 Troubleshooting

### Problema: Flink no arranca

```bash
# Ver logs
docker logs ayala-flink-jobmanager

# Verificar memoria disponible
free -h

# Verificar que el puerto 8081 no está ocupado
netstat -tuln | grep 8081
```

### Problema: TaskManager se desconecta

```bash
# Verificar memoria del TaskManager
docker stats ayala-flink-taskmanager-1

# Aumentar timeout en flink-conf.yaml:
akka.ask.timeout: 120s

# Reiniciar
docker compose restart flink-taskmanager-1
```

### Problema: Checkpoints fallan

```bash
# Verificar espacio en disco
df -h

# Ver logs de checkpointing
docker logs ayala-flink-jobmanager | grep checkpoint

# Aumentar timeout:
execution.checkpointing.timeout: 600000  # 10 minutos
```

### Problema: Elasticsearch no arranca

```bash
# Verificar memoria
docker logs ayala-elasticsearch

# Aumentar límite de memoria virtual
sudo sysctl -w vm.max_map_count=262144

# Hacer permanente
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

### Problema: Job muy lento

```bash
# Verificar paralelismo
# En Web UI: Running Jobs → Tu job → Configuration

# Aumentar paralelismo:
docker exec -it ayala-flink-jobmanager flink run \
  --parallelism 8 \
  /opt/flink/jobs/factura-processor.jar

# Verificar backpressure en Web UI
# Running Jobs → Tu job → BackPressure
```

### Problema: OutOfMemory en TaskManager

```bash
# Ver uso de memoria
docker exec -it ayala-flink-taskmanager-1 free -h

# Solución 1: Aumentar memoria TaskManager
# En docker compose.yml: memory: 8G

# Solución 2: Reducir estado en memoria
# En flink-conf.yaml:
taskmanager.memory.managed.fraction: 0.3
```

---

## 📊 Monitoreo

### Métricas Importantes:

1. **Checkpoints:**
   - Web UI → Running Jobs → Checkpoints
   - Ver: duración, tamaño, tasa de éxito

2. **Backpressure:**
   - Web UI → Running Jobs → BackPressure
   - Verde = OK, Amarillo = Atención, Rojo = Problema

3. **Throughput:**
   - Records/segundo procesados
   - Latencia end-to-end

4. **Recursos:**
   - CPU por TaskManager
   - Memoria heap/managed
   - Network buffers

### Logs:

```bash
# JobManager
docker logs ayala-flink-jobmanager -f --tail 100

# TaskManager
docker logs ayala-flink-taskmanager-1 -f --tail 100

# Elasticsearch
docker logs ayala-elasticsearch -f --tail 100
```

---

## 🎯 Casos de Uso

### 1. Pipeline de Facturas
- Consumir facturas nuevas de Kafka
- Transformar a formato NUBEFACT
- Enviar a SUNAT
- Polling de estado
- Actualizar MySQL
- Indexar en Elasticsearch
- Notificar frontend via WebSocket

### 2. Dashboard en Tiempo Real
- Agregar facturas por ventanas de tiempo (1min, 5min, 1h)
- Calcular totales, promedios, top proveedores
- Push updates al frontend cada segundo

### 3. Detección de Anomalías
- Detectar facturas duplicadas
- Montos sospechosos
- Frecuencia anormal
- Alertas en tiempo real

### 4. Búsqueda Full-Text
- Indexar facturas en Elasticsearch
- Búsqueda por cliente, proveedor, descripción
- Autocompletado
- Sugerencias inteligentes

---

## 📚 Recursos

### Documentación Oficial:
- [Apache Flink](https://flink.apache.org/docs/stable/)
- [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana](https://www.elastic.co/guide/en/kibana/current/index.html)

### Tutoriales:
- [Flink Training](https://github.com/apache/flink-training)
- [Flink SQL Cookbook](https://github.com/ververica/flink-sql-cookbook)

### Libros:
- "Stream Processing with Apache Flink" - Fabian Hueske
- "Designing Data-Intensive Applications" - Martin Kleppmann

---

## 🤝 Soporte

Para problemas o preguntas:
1. Revisar [Troubleshooting](#troubleshooting)
2. Ver logs: `docker compose logs`
3. Contactar al equipo de desarrollo

---

## 📝 Notas

- **RocksDB** guarda checkpoints en `./checkpoints/` - asegúrate de tener espacio en disco
- **Elasticsearch** puede consumir mucha RAM - ajusta según necesidad
- **Kibana** es opcional - puedes comentarlo en docker compose.yml si no lo necesitas
- Los **TaskManagers** se pueden escalar horizontalmente agregando más en docker compose.yml

---

**Última actualización:** 2026-01-31
**Versión:** 1.0
**Sistema:** Maquinarias Ayala
