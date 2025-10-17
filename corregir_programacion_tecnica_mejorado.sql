-- Procedimiento almacenado mejorado para corregir la tabla programacion_tecnica
-- Este procedimiento hace lo siguiente:
-- 1. Elimina registros incorrectos (que no tienen estado_programacion = "OK")
-- 2. Migra registros que deberían estar en programacion_tecnica pero no están
-- 3. Completa información faltante en los registros existentes

DELIMITER $$

-- Eliminar el procedimiento si ya existe
DROP PROCEDURE IF EXISTS corregir_programacion_tecnica_mejorado$$
DROP PROCEDURE IF EXISTS sp_corregir_programacion_tecnica_v2$$

CREATE PROCEDURE sp_corregir_programacion_tecnica_v2()
BEGIN
    -- Declaraciones
    DECLARE registros_eliminados INT DEFAULT 0;
    DECLARE registros_migrados INT DEFAULT 0;
    DECLARE registros_actualizados INT DEFAULT 0;
    DECLARE mensaje_error VARCHAR(255);
    
    -- Declarar variables para la verificación
    DECLARE total_incorrectos INT DEFAULT 0;
    DECLARE total_faltantes INT DEFAULT 0;
    
    -- Declarar handler para errores
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1
            mensaje_error = MESSAGE_TEXT;
        ROLLBACK;
        SELECT CONCAT('Error: ', mensaje_error) AS mensaje_error;
    END;

    -- Iniciar transacción
    START TRANSACTION;
    
    -- Mostrar mensaje inicial
    SELECT 'Iniciando proceso de corrección de programacion_tecnica...' AS mensaje;
    
    -- 1. Contar cuántos registros incorrectos existen ANTES
    SELECT COUNT(*) INTO total_incorrectos
    FROM programacion_tecnica
    WHERE estado_programacion IS NULL OR estado_programacion != 'OK';
    
    SELECT CONCAT('Se encontraron ', total_incorrectos, ' registros incorrectos para eliminar') AS mensaje;
    
    -- 2. Eliminar registros incorrectos de programacion_tecnica
    -- Eliminar registros que:
    -- a) No tienen estado_programacion = "OK"
    -- b) Existen en programacion_tecnica pero en programacion NO tienen estado_programacion = "OK"
    DELETE pt FROM programacion_tecnica pt
    LEFT JOIN programacion p ON pt.identificador_unico = p.identificador_unico
    WHERE pt.estado_programacion IS NULL
       OR pt.estado_programacion != 'OK'
       OR p.estado_programacion IS NULL
       OR p.estado_programacion != 'OK';
    
    -- Contar los registros eliminados
    SET registros_eliminados = ROW_COUNT();
    
    -- 3. Contar cuántos registros faltan ANTES de la migración
    SELECT COUNT(*) INTO total_faltantes
    FROM programacion p
    WHERE p.estado_programacion = 'OK'
      AND p.identificador_unico IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM programacion_tecnica pt
          WHERE pt.identificador_unico = p.identificador_unico
      );
    
    SELECT CONCAT('Se migrarán ', total_faltantes, ' registros que tienen estado_programacion = "OK" pero no están en programacion_tecnica') AS mensaje;
    
    -- 4. Migrar registros que tienen estado_programacion = "OK" en la tabla original
    -- pero que no están en programacion_tecnica
    INSERT INTO programacion_tecnica (
        programacion,
        fecha,
        proyectos,
        unidad,
        identificador_unico,
        proveedor,
        apellidos_nombres,
        estado_programacion,
        hora_partida
    )
    SELECT
        p.programacion,
        p.fecha,
        p.proyectos,
        p.unidad,
        p.identificador_unico,
        p.proveedor,
        p.apellidos_nombres,
        p.estado_programacion,
        p.hora_partida
    FROM programacion p
    WHERE p.estado_programacion = 'OK'
      AND p.identificador_unico IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM programacion_tecnica pt
          WHERE pt.identificador_unico = p.identificador_unico
      );
    
    -- Contar los registros migrados
    SET registros_migrados = ROW_COUNT();
    
    -- 5. Actualizar información faltante en los registros existentes
    -- de programacion_tecnica con base en la tabla programacion
    -- Actualiza campos que estén NULL o vacíos en programacion_tecnica
    UPDATE programacion_tecnica pt
    INNER JOIN programacion p ON pt.identificador_unico = p.identificador_unico
    SET
        pt.programacion = IF(pt.programacion IS NULL OR pt.programacion = '', p.programacion, pt.programacion),
        pt.fecha = IF(pt.fecha IS NULL, p.fecha, pt.fecha),
        pt.proyectos = IF(pt.proyectos IS NULL OR pt.proyectos = '', p.proyectos, pt.proyectos),
        pt.unidad = IF(pt.unidad IS NULL OR pt.unidad = '', p.unidad, pt.unidad),
        pt.proveedor = IF(pt.proveedor IS NULL OR pt.proveedor = '', p.proveedor, pt.proveedor),
        pt.apellidos_nombres = IF(pt.apellidos_nombres IS NULL OR pt.apellidos_nombres = '', p.apellidos_nombres, pt.apellidos_nombres),
        pt.estado_programacion = IF(pt.estado_programacion IS NULL OR pt.estado_programacion = '', p.estado_programacion, pt.estado_programacion),
        pt.hora_partida = IF(pt.hora_partida IS NULL OR pt.hora_partida = '', p.hora_partida, pt.hora_partida)
    WHERE p.estado_programacion = 'OK'
      AND (
          pt.programacion IS NULL OR pt.programacion = ''
          OR pt.fecha IS NULL
          OR pt.proyectos IS NULL OR pt.proyectos = ''
          OR pt.unidad IS NULL OR pt.unidad = ''
          OR pt.proveedor IS NULL OR pt.proveedor = ''
          OR pt.apellidos_nombres IS NULL OR pt.apellidos_nombres = ''
          OR pt.estado_programacion IS NULL OR pt.estado_programacion = ''
          OR pt.hora_partida IS NULL OR pt.hora_partida = ''
      );
    
    -- Contar los registros actualizados
    SET registros_actualizados = ROW_COUNT();
    
    -- Confirmar transacción
    COMMIT;
    
    -- Mostrar resultados
    SELECT 
        total_incorrectos AS registros_incorrectos_identificados,
        registros_eliminados AS registros_eliminados,
        total_faltantes AS registros_faltantes_identificados,
        registros_migrados AS registros_migrados,
        registros_actualizados AS registros_actualizados,
        'Proceso completado exitosamente' AS mensaje;
        
END$$

DELIMITER ;

-- Instrucciones de uso:
-- CALL sp_corregir_programacion_tecnica_v2();