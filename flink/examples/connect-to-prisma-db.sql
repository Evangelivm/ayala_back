-- ================================================================================
-- CONECTAR FLINK SQL A TU BASE DE DATOS PRISMA
-- ================================================================================
-- Archivo: connect-to-prisma-db.sql
-- Propósito: Ejemplos de cómo conectar Flink SQL a tus tablas de Prisma
-- Uso: Abrir con ./scripts/sql-client.sh y copiar/pegar
-- ================================================================================

-- ================================================================================
-- PASO 1: CONECTAR A TABLA DE FACTURAS
-- ================================================================================

-- Crear tabla Flink que apunta a tu tabla 'factura' de Prisma
CREATE TABLE facturas (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  proveedor_id BIGINT,
  proveedor_ruc STRING,
  proveedor_razon_social STRING,
  cliente_tipo_documento STRING,
  cliente_numero_documento STRING,
  cliente_razon_social STRING,
  cliente_direccion STRING,
  moneda STRING,
  tipo_cambio DECIMAL(10, 4),
  monto_gravada DECIMAL(10, 2),
  monto_igv DECIMAL(10, 2),
  monto_total DECIMAL(10, 2),
  estado STRING,
  enlace_pdf STRING,
  enlace_xml STRING,
  enlace_cdr STRING,
  aceptada_por_sunat BOOLEAN,
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://161.132.54.103:3306/ayala2025',
  'table-name' = 'factura',
  'username' = 'root',
  'password' = 'XXXperu2020XXX.',
  'driver' = 'com.mysql.cj.jdbc.Driver'
);

-- Probar la conexión
SELECT * FROM facturas LIMIT 5;

-- Ver facturas PROCESANDO
SELECT id, serie, numero, monto_total, estado
FROM facturas
WHERE estado = 'PROCESANDO';

-- Ver facturas del día
SELECT COUNT(*) as total, SUM(monto_total) as total_monto
FROM facturas
WHERE DATE_FORMAT(fecha_emision, 'yyyy-MM-dd') = CURRENT_DATE;

-- ================================================================================
-- PASO 2: CONECTAR A TABLA DE GUÍAS DE REMISIÓN
-- ================================================================================

CREATE TABLE guias_remision (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  destinatario_razon_social STRING,
  punto_partida STRING,
  punto_llegada STRING,
  motivo_traslado STRING,
  peso_bruto_total DECIMAL(10, 2),
  estado STRING,
  enlace_pdf STRING,
  aceptada_por_sunat BOOLEAN,
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'jdbc',
  'url' = 'jdbc:mysql://161.132.54.103:3306/ayala2025',
  'table-name' = 'guia_remision',
  'username' = 'root',
  'password' = 'XXXperu2020XXX.',
  'driver' = 'com.mysql.cj.jdbc.Driver'
);

-- Ver guías del día
SELECT * FROM guias_remision
WHERE DATE_FORMAT(fecha_emision, 'yyyy-MM-dd') = CURRENT_DATE;

-- ================================================================================
-- PASO 3: CONECTAR A KAFKA (facturas nuevas)
-- ================================================================================

CREATE TABLE facturas_kafka (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  proveedor_id BIGINT,
  monto_total DECIMAL(10, 2),
  estado STRING,
  WATERMARK FOR fecha_emision AS fecha_emision - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'facturas.nuevas',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'flink-sql-consumer',
  'scan.startup.mode' = 'latest-offset',
  'format' = 'json',
  'json.fail-on-missing-field' = 'false',
  'json.ignore-parse-errors' = 'true'
);

-- Ver eventos en tiempo real desde Kafka
SELECT * FROM facturas_kafka;

-- ================================================================================
-- PASO 4: QUERIES ÚTILES EN TIEMPO REAL
-- ================================================================================

-- Dashboard: Totales por proveedor en la última hora
SELECT
  proveedor_id,
  proveedor_razon_social,
  COUNT(*) as total_facturas,
  SUM(monto_total) as facturacion_total,
  AVG(monto_total) as ticket_promedio,
  MAX(monto_total) as factura_maxima
FROM facturas
WHERE fecha_emision >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR
GROUP BY proveedor_id, proveedor_razon_social
ORDER BY facturacion_total DESC;

-- Facturas pendientes de SUNAT
SELECT
  id,
  CONCAT(serie, '-', numero) as comprobante,
  cliente_razon_social,
  monto_total,
  estado,
  fecha_emision
FROM facturas
WHERE estado IN ('PROCESANDO', 'PENDIENTE')
ORDER BY fecha_emision DESC;

-- Facturas fallidas que necesitan revisión
SELECT
  id,
  CONCAT(serie, '-', numero) as comprobante,
  cliente_razon_social,
  monto_total,
  estado,
  fecha_emision
FROM facturas
WHERE estado = 'FALLADO'
ORDER BY fecha_emision DESC;

-- Top 10 clientes por facturación este mes
SELECT
  cliente_razon_social,
  COUNT(*) as num_facturas,
  SUM(monto_total) as total_facturado
FROM facturas
WHERE MONTH(fecha_emision) = MONTH(CURRENT_DATE)
  AND YEAR(fecha_emision) = YEAR(CURRENT_DATE)
GROUP BY cliente_razon_social
ORDER BY total_facturado DESC
LIMIT 10;

-- ================================================================================
-- PASO 5: PROCESAMIENTO EN TIEMPO REAL CON VENTANAS
-- ================================================================================

-- Dashboard en vivo: Totales cada minuto (desde Kafka)
CREATE VIEW dashboard_realtime AS
SELECT
  TUMBLE_START(fecha_emision, INTERVAL '1' MINUTE) as ventana_inicio,
  TUMBLE_END(fecha_emision, INTERVAL '1' MINUTE) as ventana_fin,
  COUNT(*) as facturas_procesadas,
  SUM(monto_total) as monto_total,
  AVG(monto_total) as monto_promedio
FROM facturas_kafka
GROUP BY TUMBLE(fecha_emision, INTERVAL '1' MINUTE);

-- Ver dashboard en tiempo real
SELECT * FROM dashboard_realtime;

-- ================================================================================
-- PASO 6: COPIAR DE KAFKA A MYSQL (ETL en tiempo real)
-- ================================================================================

-- Este INSERT INTO funciona como un job continuo
-- Lee de Kafka y escribe automáticamente en MySQL
INSERT INTO facturas
SELECT
  id,
  serie,
  numero,
  fecha_emision,
  proveedor_id,
  NULL as proveedor_ruc,
  NULL as proveedor_razon_social,
  NULL as cliente_tipo_documento,
  NULL as cliente_numero_documento,
  NULL as cliente_razon_social,
  NULL as cliente_direccion,
  'PEN' as moneda,
  1.0 as tipo_cambio,
  monto_total * 0.82 as monto_gravada,  -- Aproximado
  monto_total * 0.18 as monto_igv,      -- Aproximado
  monto_total,
  estado,
  NULL as enlace_pdf,
  NULL as enlace_xml,
  NULL as enlace_cdr,
  FALSE as aceptada_por_sunat
FROM facturas_kafka;

-- ================================================================================
-- PASO 7: INDEXAR EN ELASTICSEARCH PARA BÚSQUEDAS
-- ================================================================================

CREATE TABLE facturas_elasticsearch (
  id BIGINT,
  serie STRING,
  numero STRING,
  fecha_emision TIMESTAMP(3),
  cliente_razon_social STRING,
  proveedor_razon_social STRING,
  monto_total DECIMAL(10, 2),
  estado STRING,
  PRIMARY KEY (id) NOT ENFORCED
) WITH (
  'connector' = 'elasticsearch-7',
  'hosts' = 'http://elasticsearch:9200',
  'index' = 'facturas',
  'document-id.key-delimiter' = '_',
  'sink.bulk-flush.max-actions' = '1000',
  'sink.bulk-flush.interval' = '5s',
  'format' = 'json'
);

-- Copiar facturas a Elasticsearch para búsqueda full-text
INSERT INTO facturas_elasticsearch
SELECT
  id,
  serie,
  numero,
  fecha_emision,
  cliente_razon_social,
  proveedor_razon_social,
  monto_total,
  estado
FROM facturas;

-- ================================================================================
-- NOTAS IMPORTANTES
-- ================================================================================
--
-- 1. PRISMA vs FLINK SQL:
--    - Prisma es un ORM de TypeScript
--    - Flink SQL se conecta directo a MySQL con JDBC
--    - Ambos usan la misma base de datos
--    - No interfieren entre sí
--
-- 2. TABLAS EN FLINK:
--    - Las tablas CREATE TABLE en Flink son solo "vistas"
--    - No crean tablas reales en MySQL
--    - Solo definen cómo Flink accede a las tablas existentes de Prisma
--
-- 3. QUERIES INSERT INTO:
--    - Los INSERT INTO son JOBS CONTINUOS
--    - Se ejecutan indefinidamente procesando streams
--    - Ver en http://localhost:8082
--    - Cancelar con: STOP JOB '<job-id>';
--
-- 4. CÓMO EJECUTAR:
--    docker exec -it ayala-flink-jobmanager ./bin/sql-client.sh
--    Luego copiar/pegar estas queries
--
-- 5. VER JOBS CORRIENDO:
--    SHOW JOBS;
--    STOP JOB '<job-id>';
--
-- ================================================================================
