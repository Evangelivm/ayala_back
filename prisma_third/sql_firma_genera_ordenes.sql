-- Firma de "Genera orden" que se imprime en el PDF de la orden.
-- Valores: NULL (sin firma), 'vladimir', 'raul'.
-- Ejecutar manualmente en la BD terciaria inventariosayala2025 (NO usar prisma db push).

ALTER TABLE ordenes_compra
  ADD COLUMN firma_genera VARCHAR(20) NULL;

ALTER TABLE ordenes_servicio
  ADD COLUMN firma_genera VARCHAR(20) NULL;
