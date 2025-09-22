-- Eliminar triggers existentes
DROP TRIGGER IF EXISTS tr_insertar_programacion_tecnica;
DROP TRIGGER IF EXISTS tr_insertar_programacion_tecnica_new;
DROP PROCEDURE IF EXISTS sp_migrar_registros_existentes;

DELIMITER $$

-- Trigger 2: Insertar en programacion_tecnica cuando estado_programacion sea "OK"
CREATE TRIGGER tr_insertar_programacion_tecnica
    AFTER UPDATE ON programacion
    FOR EACH ROW
BEGIN
    -- Verificar si estado_programacion cambió a "OK" y no existe en programacion_tecnica
    IF NEW.estado_programacion = 'OK'
       AND (OLD.estado_programacion IS NULL OR OLD.estado_programacion != 'OK')
       AND NEW.identificador_unico IS NOT NULL
    THEN
        -- Verificar si no existe ya en programacion_tecnica usando codigo_transporte
        IF NOT EXISTS (
            SELECT 1 FROM programacion_tecnica
            WHERE codigo_transporte = NEW.identificador_unico
        ) THEN
            INSERT INTO programacion_tecnica (
                programacion,
                fecha_trabajo,
                proyecto,
                placa_serie,
                codigo_transporte
            ) VALUES (
                NEW.programacion,
                NEW.fecha,
                NEW.proyectos,
                NEW.unidad,
                NEW.identificador_unico
            );
        END IF;
    END IF;
END$$

-- Trigger adicional: Para nuevos registros INSERT que ya vengan con estado_programacion "OK"
CREATE TRIGGER tr_insertar_programacion_tecnica_new
    AFTER INSERT ON programacion
    FOR EACH ROW
BEGIN
    -- Verificar si el nuevo registro tiene estado_programacion "OK"
    IF NEW.estado_programacion = 'OK'
       AND NEW.identificador_unico IS NOT NULL
    THEN
        -- Verificar si no existe ya en programacion_tecnica usando codigo_transporte
        IF NOT EXISTS (
            SELECT 1 FROM programacion_tecnica
            WHERE codigo_transporte = NEW.identificador_unico
        ) THEN
            INSERT INTO programacion_tecnica (
                programacion,
                fecha_trabajo,
                proyecto,
                placa_serie,
                codigo_transporte
            ) VALUES (
                NEW.programacion,
                NEW.fecha,
                NEW.proyectos,
                NEW.unidad,
                NEW.identificador_unico
            );
        END IF;
    END IF;
END$$

DELIMITER ;

-- Procedimiento para procesar registros existentes
DELIMITER $$

CREATE PROCEDURE sp_migrar_registros_existentes()
BEGIN
    -- Insertar registros existentes que cumplan las condiciones
    INSERT INTO programacion_tecnica (
        programacion,
        fecha_trabajo,
        proyecto,
        placa_serie,
        codigo_transporte
    )
    SELECT
        p.programacion,
        p.fecha,
        p.proyectos,
        p.unidad,
        p.identificador_unico
    FROM programacion p
    WHERE p.estado_programacion = 'OK'
      AND p.identificador_unico IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM programacion_tecnica pt
          WHERE pt.codigo_transporte = p.identificador_unico
      );

    -- Mostrar cuántos registros se procesaron
    SELECT ROW_COUNT() as registros_migrados;
END$$

DELIMITER ;

-- Para ejecutar los triggers:
-- SOURCE D:\recuperacion\ayala\ayala_back\triggers_programacion.sql;

-- Para ejecutar la migración de registros existentes:
-- CALL sp_migrar_registros_existentes();