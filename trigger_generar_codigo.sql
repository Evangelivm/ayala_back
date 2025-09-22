-- Eliminar función y triggers existentes
DROP FUNCTION IF EXISTS generarCodigoAlfanumerico;
DROP TRIGGER IF EXISTS tr_generar_identificador_unico;
DROP TRIGGER IF EXISTS tr_actualizar_identificador_unico_vacio;

-- Función para generar código alfanumérico
DELIMITER $$

CREATE FUNCTION generarCodigoAlfanumerico()
RETURNS VARCHAR(10)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE resultado VARCHAR(10) DEFAULT '';
    DECLARE i INT DEFAULT 0;
    DECLARE caracteres VARCHAR(36) DEFAULT 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    DECLARE posicion INT;

    WHILE i < 10 DO
        SET posicion = FLOOR(1 + (RAND() * 36));
        SET resultado = CONCAT(resultado, SUBSTRING(caracteres, posicion, 1));
        SET i = i + 1;
    END WHILE;

    RETURN resultado;
END$$

-- Trigger para generar identificador_unico en INSERT
CREATE TRIGGER tr_generar_identificador_unico
    BEFORE INSERT ON programacion
    FOR EACH ROW
BEGIN
    IF NEW.identificador_unico IS NULL OR TRIM(NEW.identificador_unico) = '' THEN
        SET NEW.identificador_unico = generarCodigoAlfanumerico();
    END IF;
END$$

-- Trigger para actualizar identificador_unico en registros existentes que estén vacíos
CREATE TRIGGER tr_actualizar_identificador_unico_vacio
    BEFORE UPDATE ON programacion
    FOR EACH ROW
BEGIN
    IF (NEW.identificador_unico IS NULL OR TRIM(NEW.identificador_unico) = '') THEN
        SET NEW.identificador_unico = generarCodigoAlfanumerico();
    END IF;
END$$

DELIMITER ;

-- Actualizar registros existentes que no tienen identificador_unico
UPDATE programacion
SET identificador_unico = (
    SELECT CONCAT(
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1),
        SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', FLOOR(1 + RAND() * 36), 1)
    )
)
WHERE identificador_unico IS NULL OR TRIM(identificador_unico) = '';

-- Para ejecutar el script completo:
-- SOURCE D:\recuperacion\ayala\ayala_back\trigger_generar_codigo.sql;