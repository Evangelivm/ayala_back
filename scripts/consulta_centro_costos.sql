-- Vista: nro_factura, url y centro de costo (cabecera + detalle por ítem)
-- de órdenes de compra y órdenes de servicio, unificadas en un solo resultado.
CREATE OR REPLACE VIEW ordenes_centro_costo AS
SELECT
    'compra' AS tipo_orden,
    oc.id_orden_compra AS id_orden,
    oc.numero_orden,
    oc.nro_factura,
    oc.url,
    oc.centro_costo_nivel1,
    oc.centro_costo_nivel2,
    oc.centro_costo_nivel3,
    d.id_detalle,
    d.codigo_item,
    d.descripcion_item,
    d.centro_costo AS centro_costo_item
FROM ordenes_compra oc
INNER JOIN detalles_orden_compra d ON d.id_orden_compra = oc.id_orden_compra
WHERE oc.deleted_at IS NULL

UNION ALL

SELECT
    'servicio' AS tipo_orden,
    os.id_orden_servicio AS id_orden,
    os.numero_orden,
    os.nro_factura,
    os.url,
    os.centro_costo_nivel1,
    os.centro_costo_nivel2,
    os.centro_costo_nivel3,
    d.id_detalle,
    d.codigo_item,
    d.descripcion_item,
    d.centro_costo AS centro_costo_item
FROM ordenes_servicio os
INNER JOIN detalles_orden_servicio d ON d.id_orden_servicio = os.id_orden_servicio
WHERE os.deleted_at IS NULL;


-- Uso:
-- SELECT * FROM vw_ordenes_centro_costo ORDER BY tipo_orden, id_orden, id_detalle;
-- SELECT * FROM vw_ordenes_centro_costo WHERE tipo_orden = 'compra';
