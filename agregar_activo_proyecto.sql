-- Interruptor activo/inactivo de proyecto (independiente de `estado`).
-- Los proyectos existentes quedan activos. Ejecutar una sola vez y luego `npx prisma generate`.
ALTER TABLE proyecto
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER estado,
  ADD INDEX idx_proyecto_activo (activo);

-- Las listas de los selects filtran `activo = 1`; si alguna fila legada quedó en NULL desaparecería.
UPDATE etapas SET activo = 1 WHERE activo IS NULL;
UPDATE sector SET activo = 1 WHERE activo IS NULL;
UPDATE frente SET activo = 1 WHERE activo IS NULL;
UPDATE partida SET activo = 1 WHERE activo IS NULL;
UPDATE subproyectos SET activo = 1 WHERE activo IS NULL;
UPDATE sub_etapas SET activo = 1 WHERE activo IS NULL;
UPDATE subsector SET activo = 1 WHERE activo IS NULL;
UPDATE subfrente SET activo = 1 WHERE activo IS NULL;
UPDATE subpartida SET activo = 1 WHERE activo IS NULL;

-- Proyectos en borrador (cotizaciones): no aparecen en ningún select hasta aprobarse
-- (aprobar = pasar `estado` de 'borrador' a 'activo').
ALTER TABLE proyecto
  MODIFY COLUMN estado ENUM('activo','inactivo','finalizado','borrador') NULL DEFAULT 'activo';
