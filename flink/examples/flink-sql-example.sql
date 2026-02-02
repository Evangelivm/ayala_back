-- ================================================================================
-- EJEMPLO: FLINK SQL - Procesar facturas sin código Java
-- ================================================================================
-- Archivo: flink-sql-example.sql
-- Propósito: Mostrar cómo usar Flink SQL para procesar facturas
-- ================================================================================

-- 1. CREAR TABLA DE KAFKA (source)
-- Conecta al topic de Kafka donde llegan facturas nuevas
CREATE TABLE facturas_kafka (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  proveedor_id BIGINT,
  cliente_razon_social STRING,
  monto_total DECIMAL(10, 2),
  estado STRING,
  WATERMARK FOR fecha_emision AS fecha_emision - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'facturas.nuevas',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'flink-sql-consumer',
  'scan.startup.mode' = 'latest-offset',
  'format' = 'json'
);

-- 2. CREAR TABLA DE MYSQL (sink)
-- Conecta directamente a tu tabla de facturas en MySQL
CREATE TABLE facturas_mysql (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  proveedor_id BIGINT,
  cliente_razon_social STRING,
  monto_total DECIMAL(10, 2),
  estado STRING,
  procesado_por_flink BOOLEAN,
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://mysql:3306/ayala_db',
  'table-name' = 'factura',
  'username' = 'root',
  'password' = 'tu_password',
  'driver' = 'com.mysql.cj.jdbc.Driver'
);

-- 3. CREAR TABLA DE ELASTICSEARCH (sink)
-- Indexa facturas para búsqueda rápida
CREATE TABLE facturas_elasticsearch (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  proveedor_id BIGINT,
  cliente_razon_social STRING,
  monto_total DECIMAL(10, 2),
  estado STRING,
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'elasticsearch-7',
  'hosts' = 'http://elasticsearch:9200',
  'index' = 'facturas'
);

-- ================================================================================
-- QUERIES DE PROCESAMIENTO
-- ================================================================================

-- Query 1: Copiar de Kafka a MySQL (ETL básico)
INSERT INTO facturas_mysql
SELECT
  id,
  serie,
  numero,
  fecha_emision,
  proveedor_id,
  cliente_razon_social,
  monto_total,
  estado,
  TRUE as procesado_por_flink
FROM facturas_kafka;

-- Query 2: Indexar en Elasticsearch para búsquedas
INSERT INTO facturas_elasticsearch
SELECT
  id,
  serie,
  numero,
  fecha_emision,
  proveedor_id,
  cliente_razon_social,
  monto_total,
  estado
FROM facturas_kafka;

-- Query 3: Dashboard en Tiempo Real - Totales por proveedor cada minuto
CREATE VIEW dashboard_proveedores AS
SELECT
  proveedor_id,
  TUMBLE_START(fecha_emision, INTERVAL '1' MINUTE) as ventana_inicio,
  TUMBLE_END(fecha_emision, INTERVAL '1' MINUTE) as ventana_fin,
  COUNT(*) as total_facturas,
  SUM(monto_total) as monto_total,
  AVG(monto_total) as monto_promedio,
  MAX(monto_total) as monto_maximo
FROM facturas_kafka
GROUP BY
  proveedor_id,
  TUMBLE(fecha_emision, INTERVAL '1' MINUTE);

-- Query 4: Detección de Anomalías - Facturas con monto alto
CREATE VIEW facturas_sospechosas AS
SELECT
  id,
  serie,
  numero,
  cliente_razon_social,
  monto_total,
  'MONTO_ALTO' as tipo_alerta
FROM facturas_kafka
WHERE monto_total > 50000;

-- Query 5: Agregación por día
CREATE VIEW totales_diarios AS
SELECT
  DATE_FORMAT(fecha_emision, 'yyyy-MM-dd') as fecha,
  COUNT(*) as total_facturas,
  SUM(monto_total) as facturacion_total,
  COUNT(DISTINCT proveedor_id) as proveedores_unicos
FROM facturas_kafka
GROUP BY DATE_FORMAT(fecha_emision, 'yyyy-MM-dd');

-- ================================================================================
-- EJEMPLOS DE USO
-- ================================================================================

-- Consultar totales en tiempo real
SELECT * FROM dashboard_proveedores;

-- Ver facturas sospechosas
SELECT * FROM facturas_sospechosas;

-- Ver totales del día
SELECT * FROM totales_diarios WHERE fecha = CURRENT_DATE;

-- ================================================================================
-- NOTAS
-- ================================================================================
--
-- VENTAJAS DE FLINK SQL:
-- ✓ No necesitas escribir código Java/Scala
-- ✓ Se conecta directo a MySQL (sin Prisma, pero funciona)
-- ✓ Sintaxis SQL estándar
-- ✓ Procesa streams en tiempo real
-- ✓ Ventanas de tiempo (TUMBLE, HOP, SESSION)
-- ✓ Joins entre streams
--
-- CÓMO EJECUTAR:
-- 1. Abrir Flink SQL Client:
--    docker exec -it ayala-flink-jobmanager ./bin/sql-client.sh
--
-- 2. Copiar y pegar estas queries
--
-- 3. Las queries INSERT INTO se ejecutan como jobs continuos
--
-- 4. Ver jobs en http://localhost:8082
--
-- ================================================================================
