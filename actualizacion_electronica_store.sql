-- =============================================================================
--  ACTUALIZACIÓN DE LA BASE DE DATOS "electronica_store"
--  Proyecto: Trabajo1-IIIP (Visual Basic .NET + MySQL/XAMPP)
-- =============================================================================
--  Qué hace este script:
--   1. Agrega a la tabla `facturas` las columnas metodo_pago, estado e
--      id_cierre SI NO EXISTEN TODAVÍA (no falla si ya las tienes).
--   2. Crea la tabla `cierres_caja` (historial de arqueos) si no existe.
--
--  Cómo usarlo:
--   1. Abre phpMyAdmin -> selecciona la base "electronica_store".
--   2. Ve a la pestaña "SQL" y pega todo este archivo, o usa "Importar".
--   3. Ejecuta. Es seguro correrlo varias veces, no duplica columnas.
-- =============================================================================

USE electronica_store;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_agregar_columna_si_no_existe $$
CREATE PROCEDURE sp_agregar_columna_si_no_existe(
    IN p_tabla VARCHAR(64),
    IN p_columna VARCHAR(64),
    IN p_definicion VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_tabla
          AND COLUMN_NAME = p_columna
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_tabla, '` ADD COLUMN ', p_definicion);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DELIMITER ;

-- 1. Columnas necesarias en `facturas`
CALL sp_agregar_columna_si_no_existe('facturas', 'metodo_pago',
    "metodo_pago VARCHAR(20) NOT NULL DEFAULT 'Efectivo' AFTER total_pagar");

CALL sp_agregar_columna_si_no_existe('facturas', 'estado',
    "estado VARCHAR(20) NOT NULL DEFAULT 'Pagada' AFTER metodo_pago");

CALL sp_agregar_columna_si_no_existe('facturas', 'id_cierre',
    "id_cierre INT NULL AFTER estado");

-- 2. Tabla de historial de Cierres de Caja
CREATE TABLE IF NOT EXISTS cierres_caja (
    id_cierre INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    usuario VARCHAR(100) NOT NULL,
    total_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_transferencia DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_cheque DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_general DECIMAL(10,2) NOT NULL DEFAULT 0,
    num_facturas INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Limpieza: ya no se necesita el procedimiento auxiliar
DROP PROCEDURE IF EXISTS sp_agregar_columna_si_no_existe;

-- =============================================================================
-- Verificación rápida (opcional): descomenta para revisar la estructura final
-- =============================================================================
-- DESCRIBE facturas;
-- DESCRIBE cierres_caja;
