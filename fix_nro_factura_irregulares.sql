START TRANSACTION;

-- ordenes_compra (irregulares)
UPDATE ordenes_compra SET nro_factura = 'F001-0000016874 / F001-0000016879' WHERE id_orden_compra = 245 AND nro_factura = 'F001-0016874 / F001-0016879';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016856 / F001-0000016867 / F001-0000016882' WHERE id_orden_compra = 246 AND nro_factura = 'F001-0016856 / F001-0016867 / F001-0016882';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016892 / F001-0000016910' WHERE id_orden_compra = 274 AND nro_factura = 'F001-0016892 / F001-0016910';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016900 / F001-0000016938' WHERE id_orden_compra = 275 AND nro_factura = 'F001-0016900 / F001-0016938';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016901 / F001-0000016902' WHERE id_orden_compra = 276 AND nro_factura = 'F001-0016901 / F001-0016902';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016897 / F001-0000016936' WHERE id_orden_compra = 277 AND nro_factura = 'F001-0016897 / F001-0016936';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016963 / F001-0000016982' WHERE id_orden_compra = 325 AND nro_factura = 'F001-0016963 / F001-0016982';
UPDATE ordenes_compra SET nro_factura = 'F001-0000016951 / F001-0000016952 / F001-0000016984' WHERE id_orden_compra = 326 AND nro_factura = 'F001-0016951 / F001-0016952 / F001-0016984';
UPDATE ordenes_compra SET nro_factura = 'F001-0000001789 / F001-0000001780' WHERE id_orden_compra = 453 AND nro_factura = 'F001-1789 / F001-1780';
UPDATE ordenes_compra SET nro_factura = 'FC44-0000501659' WHERE id_orden_compra = 583 AND nro_factura = 'FC44--501659';

-- ordenes_servicio (irregulares)
UPDATE ordenes_servicio SET nro_factura = 'E001-0000000454' WHERE id_orden_servicio = 39 AND nro_factura = 'E001454';
UPDATE ordenes_servicio SET nro_factura = 'E001-0000000468' WHERE id_orden_servicio = 132 AND nro_factura = 'E001 468';
UPDATE ordenes_servicio SET nro_factura = 'E001-0000001094' WHERE id_orden_servicio = 604 AND nro_factura = 'E001 1094';
UPDATE ordenes_servicio SET nro_factura = 'E001-0000000843' WHERE id_orden_servicio = 436 AND nro_factura = 'EE001-843';
UPDATE ordenes_servicio SET nro_factura = 'E001-0000000929 / E001-0000000934' WHERE id_orden_servicio = 617 AND nro_factura = 'E001-929 // E001-934';
UPDATE ordenes_servicio SET nro_factura = 'E001-0000000930 / E001-0000000938' WHERE id_orden_servicio = 618 AND nro_factura = 'E001-930 // E001-938';
UPDATE ordenes_servicio SET nro_factura = 'E001-0000001453' WHERE id_orden_servicio = 621 AND nro_factura = 'TMA / E001-1453';

-- NOTA: id_orden_compra=469 (F1798-00003584) y id_orden_servicio=209 (20614105608-E001-93) se dejan sin cambios por instrucción del usuario.

COMMIT;
-- Si algo salio mal:
-- ROLLBACK;
