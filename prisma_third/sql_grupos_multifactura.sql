-- Código legible para los grupos de multifactura: MF-000045.
-- El grupo_id (UUID) de ordenes_compra / ordenes_servicio sigue siendo la clave
-- interna; esta tabla le asigna a cada grupo un número correlativo único
-- (compartido entre compra y servicio) que se muestra en PDFs y listados.
-- El número nunca se reutiliza: si un grupo se disuelve, su código queda libre
-- de órdenes pero no vuelve a asignarse.
-- Ejecutar manualmente en la BD terciaria inventariosayala2025 (NO usar prisma db push).

-- ── 0. Verificación previa (solo lectura) ────────────────────────────────────
-- Cuántos grupos existen hoy. Debe coincidir con las filas que cree el paso 2.
SELECT COUNT(*) AS grupos_existentes
FROM (
  SELECT grupo_id FROM ordenes_compra  WHERE grupo_id IS NOT NULL
  UNION
  SELECT grupo_id FROM ordenes_servicio WHERE grupo_id IS NOT NULL
) t;

-- Collation actual de grupo_id en las órdenes (informativo). La tabla nueva usa
-- utf8mb4_unicode_ci (como sql_contabilidad.sql) y las comparaciones de abajo
-- convierten el lado de las órdenes, así que no hay error 1267 de collations
-- distintas aunque ordenes_* use otra.
SELECT TABLE_NAME, CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('ordenes_compra', 'ordenes_servicio')
  AND COLUMN_NAME = 'grupo_id';

-- ── 1. Tabla ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos_multifactura (
  nro        INT         NOT NULL AUTO_INCREMENT COMMENT 'correlativo: MF-000045 = LPAD(nro, 6, 0)',
  grupo_id   VARCHAR(36) NOT NULL COMMENT 'mismo valor que ordenes_*.grupo_id',
  creado_en  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (nro),
  UNIQUE KEY uk_grupo_multifactura (grupo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Código para los grupos que ya existen ─────────────────────────────────
-- Se numeran por antigüedad (fecha de registro de su primera orden). Se puede
-- repetir sin riesgo: solo inserta los grupos que aún no tienen código.
INSERT INTO grupos_multifactura (grupo_id, creado_en)
SELECT g.grupo_id, COALESCE(g.primera, NOW())
FROM (
  SELECT t.grupo_id, MIN(t.fecha_registro) AS primera
  FROM (
    SELECT grupo_id, fecha_registro FROM ordenes_compra  WHERE grupo_id IS NOT NULL
    UNION ALL
    SELECT grupo_id, fecha_registro FROM ordenes_servicio WHERE grupo_id IS NOT NULL
  ) t
  GROUP BY t.grupo_id
) g
WHERE NOT EXISTS (
  SELECT 1 FROM grupos_multifactura x
  WHERE x.grupo_id = CONVERT(g.grupo_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
)
ORDER BY g.primera, g.grupo_id;

-- ── 3. Verificación posterior (solo lectura) ─────────────────────────────────
-- Todo grupo debe tener código: esta consulta debe devolver 0 filas.
SELECT o.grupo_id
FROM (
  SELECT grupo_id FROM ordenes_compra  WHERE grupo_id IS NOT NULL
  UNION
  SELECT grupo_id FROM ordenes_servicio WHERE grupo_id IS NOT NULL
) o
LEFT JOIN grupos_multifactura g
  ON g.grupo_id = CONVERT(o.grupo_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
WHERE g.nro IS NULL;

-- Vista de los primeros códigos con sus órdenes
SELECT CONCAT('MF-', LPAD(g.nro, 6, '0')) AS codigo,
       g.grupo_id,
       g.creado_en,
       (SELECT COUNT(*) FROM ordenes_compra  c WHERE CONVERT(c.grupo_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = g.grupo_id AND c.deleted_at IS NULL) AS ordenes_compra,
       (SELECT COUNT(*) FROM ordenes_servicio s WHERE CONVERT(s.grupo_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = g.grupo_id AND s.deleted_at IS NULL) AS ordenes_servicio
FROM grupos_multifactura g
ORDER BY g.nro
LIMIT 20;

-- ── Deshacer (solo si hace falta; no toca ordenes_compra ni ordenes_servicio) ─
-- DROP TABLE grupos_multifactura;
