-- ============================================================================
-- TRIGGERS CORREGIDOS PARA PROGRAMACION
-- Este archivo corrige los triggers para usar solo campos existentes
-- Fecha: 2025-10-30
-- ============================================================================

-- Eliminar triggers existentes
DROP TRIGGER IF EXISTS tr_insertar_programacion_tecnica;
DROP TRIGGER IF EXISTS tr_insertar_programacion_tecnica_new;
DROP PROCEDURE IF EXISTS sp_migrar_registros_existentes;
DROP PROCEDURE IF EXISTS sp_actualizar_campos_faltantes;

DELIMITER $$

-- ============================================================================
-- Trigger 1: Actualizar programacion_tecnica cuando estado cambie a "OK"
-- ============================================================================
CREATE TRIGGER tr_insertar_programacion_tecnica
    AFTER UPDATE ON programacion
    FOR EACH ROW
BEGIN
    -- Verificar si estado_programacion cambió a "OK" y no existe en programacion_tecnica
    IF NEW.estado_programacion = 'OK'
       AND (OLD.estado_programacion IS NULL OR OLD.estado_programacion != 'OK')
       AND NEW.identificador_unico IS NOT NULL
    THEN
        -- Verificar si no existe ya en programacion_tecnica usando identificador_unico
        IF NOT EXISTS (
            SELECT 1 FROM programacion_tecnica
            WHERE identificador_unico = NEW.identificador_unico
        ) THEN
            INSERT INTO programacion_tecnica (
                fecha,
                unidad,
                proveedor,
                programacion,
                hora_partida,
                estado_programacion,
                comentarios,
                identificador_unico,
                km_del_dia,
                mes,
                num_semana,
                guia_partida_ubigeo,
                guia_partida_direccion,
                guia_llegada_ubigeo,
                guia_llegada_direccion,
                guia_traslado_peso_bruto
            ) VALUES (
                NEW.fecha,
                CAST(NEW.unidad AS CHAR),
                NEW.proveedor,
                NEW.programacion,
                NEW.hora_partida,
                NEW.estado_programacion,
                NEW.comentarios,
                NEW.identificador_unico,
                NEW.km_del_dia,
                NEW.mes,
                NEW.num_semana,
                NEW.punto_partida_ubigeo,
                NEW.punto_partida_direccion,
                NEW.punto_llegada_ubigeo,
                NEW.punto_llegada_direccion,
                NEW.peso
            );
        END IF;
    END IF;
END$$

-- ============================================================================
-- Trigger 2: Para nuevos registros INSERT que vengan con estado "OK"
-- ============================================================================
CREATE TRIGGER tr_insertar_programacion_tecnica_new
    AFTER INSERT ON programacion
    FOR EACH ROW
BEGIN
    -- Verificar si el nuevo registro tiene estado_programacion "OK"
    IF NEW.estado_programacion = 'OK'
       AND NEW.identificador_unico IS NOT NULL
    THEN
        -- Verificar si no existe ya en programacion_tecnica usando identificador_unico
        IF NOT EXISTS (
            SELECT 1 FROM programacion_tecnica
            WHERE identificador_unico = NEW.identificador_unico
        ) THEN
            INSERT INTO programacion_tecnica (
                fecha,
                unidad,
                proveedor,
                programacion,
                hora_partida,
                estado_programacion,
                comentarios,
                identificador_unico,
                km_del_dia,
                mes,
                num_semana,
                guia_partida_ubigeo,
                guia_partida_direccion,
                guia_llegada_ubigeo,
                guia_llegada_direccion,
                guia_traslado_peso_bruto
            ) VALUES (
                NEW.fecha,
                CAST(NEW.unidad AS CHAR),
                NEW.proveedor,
                NEW.programacion,
                NEW.hora_partida,
                NEW.estado_programacion,
                NEW.comentarios,
                NEW.identificador_unico,
                NEW.km_del_dia,
                NEW.mes,
                NEW.num_semana,
                NEW.punto_partida_ubigeo,
                NEW.punto_partida_direccion,
                NEW.punto_llegada_ubigeo,
                NEW.punto_llegada_direccion,
                NEW.peso
            );
        END IF;
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- Procedimiento para migrar registros existentes
-- ============================================================================
DELIMITER $$

CREATE PROCEDURE sp_migrar_registros_existentes()
BEGIN
    -- Insertar registros existentes que cumplan las condiciones
    INSERT INTO programacion_tecnica (
        fecha,
        unidad,
        proveedor,
        programacion,
        hora_partida,
        estado_programacion,
        comentarios,
        identificador_unico,
        km_del_dia,
        mes,
        num_semana,
        guia_partida_ubigeo,
        guia_partida_direccion,
        guia_llegada_ubigeo,
        guia_llegada_direccion,
        guia_traslado_peso_bruto
    )
    SELECT
        p.fecha,
        CAST(p.unidad AS CHAR),
        p.proveedor,
        p.programacion,
        p.hora_partida,
        p.estado_programacion,
        p.comentarios,
        p.identificador_unico,
        p.km_del_dia,
        p.mes,
        p.num_semana,
        p.punto_partida_ubigeo,
        p.punto_partida_direccion,
        p.punto_llegada_ubigeo,
        p.punto_llegada_direccion,
        p.peso
    FROM programacion p
    WHERE p.estado_programacion = 'OK'
      AND p.identificador_unico IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM programacion_tecnica pt
          WHERE pt.identificador_unico = p.identificador_unico
      );

    -- Mostrar cuántos registros se procesaron
    SELECT ROW_COUNT() as registros_migrados;
END$$

-- ============================================================================
-- Procedimiento para actualizar campos en programacion_tecnica
-- ============================================================================
CREATE PROCEDURE sp_actualizar_campos_faltantes()
BEGIN
    DECLARE registros_actualizados INT DEFAULT 0;

    -- Actualizar registros existentes con los campos disponibles
    UPDATE programacion_tecnica pt
    INNER JOIN programacion p ON pt.identificador_unico = p.identificador_unico
    SET
        pt.unidad = COALESCE(pt.unidad, CAST(p.unidad AS CHAR)),
        pt.proveedor = COALESCE(pt.proveedor, p.proveedor),
        pt.hora_partida = COALESCE(pt.hora_partida, p.hora_partida),
        pt.estado_programacion = COALESCE(pt.estado_programacion, p.estado_programacion),
        pt.comentarios = COALESCE(pt.comentarios, p.comentarios),
        pt.km_del_dia = COALESCE(pt.km_del_dia, p.km_del_dia),
        pt.mes = COALESCE(pt.mes, p.mes),
        pt.num_semana = COALESCE(pt.num_semana, p.num_semana),
        pt.guia_partida_ubigeo = COALESCE(pt.guia_partida_ubigeo, p.punto_partida_ubigeo),
        pt.guia_partida_direccion = COALESCE(pt.guia_partida_direccion, p.punto_partida_direccion),
        pt.guia_llegada_ubigeo = COALESCE(pt.guia_llegada_ubigeo, p.punto_llegada_ubigeo),
        pt.guia_llegada_direccion = COALESCE(pt.guia_llegada_direccion, p.punto_llegada_direccion),
        pt.guia_traslado_peso_bruto = COALESCE(pt.guia_traslado_peso_bruto, p.peso)
    WHERE pt.identificador_unico = p.identificador_unico;

    -- Obtener el número de registros actualizados
    SET registros_actualizados = ROW_COUNT();

    -- Mostrar cuántos registros se actualizaron
    SELECT registros_actualizados as registros_actualizados;
END$$

DELIMITER ;

-- ============================================================================
-- INSTRUCCIONES DE USO
-- ============================================================================

-- 1. Conectarse a la base de datos MySQL:
--    mysql -u tu_usuario -p nombre_base_datos

-- 2. Aplicar estos triggers corregidos (usa / en lugar de \):
--    SOURCE D:/recuperacion/ayala/ayala_back/triggers_programacion_corregidos.sql;

-- 3. Verificar que los triggers se crearon correctamente:
--    SHOW TRIGGERS WHERE `Table` = 'programacion';

-- 4. (Opcional) Migrar registros existentes:
--    CALL sp_migrar_registros_existentes();

-- 5. (Opcional) Actualizar campos faltantes en programacion_tecnica:
--    CALL sp_actualizar_campos_faltantes();

-- ============================================================================
-- MAPEO DE CAMPOS
-- ============================================================================
-- programacion.fecha                  -> programacion_tecnica.fecha
-- programacion.unidad (Int)           -> programacion_tecnica.unidad (String)
-- programacion.proveedor              -> programacion_tecnica.proveedor
-- programacion.programacion           -> programacion_tecnica.programacion
-- programacion.hora_partida           -> programacion_tecnica.hora_partida
-- programacion.estado_programacion    -> programacion_tecnica.estado_programacion
-- programacion.comentarios            -> programacion_tecnica.comentarios
-- programacion.identificador_unico    -> programacion_tecnica.identificador_unico
-- programacion.km_del_dia             -> programacion_tecnica.km_del_dia
-- programacion.mes                    -> programacion_tecnica.mes
-- programacion.num_semana             -> programacion_tecnica.num_semana
-- programacion.punto_partida_ubigeo   -> programacion_tecnica.guia_partida_ubigeo
-- programacion.punto_partida_direccion-> programacion_tecnica.guia_partida_direccion
-- programacion.punto_llegada_ubigeo   -> programacion_tecnica.guia_llegada_ubigeo
-- programacion.punto_llegada_direccion-> programacion_tecnica.guia_llegada_direccion
-- programacion.peso                   -> programacion_tecnica.guia_traslado_peso_bruto
-- ============================================================================

-- NOTA: Los campos 'proyectos' y 'apellidos_nombres' NO existen en la tabla
-- 'programacion', por lo que NO se copian a 'programacion_tecnica'.
