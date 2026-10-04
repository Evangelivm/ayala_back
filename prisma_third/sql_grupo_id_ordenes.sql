-- Grupo de órdenes (multifactura): varias órdenes creadas juntas comparten grupo_id.
-- Una orden normal queda con grupo_id NULL.
-- Ejecutar manualmente en la BD terciaria inventariosayala2025 (NO usar prisma db push).

ALTER TABLE ordenes_servicio
  ADD COLUMN grupo_id VARCHAR(36) NULL,
  ADD INDEX idx_grupo (grupo_id);

ALTER TABLE ordenes_compra
  ADD COLUMN grupo_id VARCHAR(36) NULL,
  ADD INDEX idx_grupo (grupo_id);
