-- =============================================================================
-- Importación de Contabilidad — DDL + seed de catálogos
-- Generado a partir de prisma_third/schema.prisma (modelos agregados para el
-- módulo de importación de asientos contables). Ejecutar contra la BD
-- "inventariosayala2025" (DATABASE_URL_THIRD).
--
-- IMPORTANTE: este script es aditivo, solo CREATE TABLE + INSERT. No toca
-- ninguna tabla existente. NO usar `prisma db push`/`migrate dev` en este
-- schema: el diff completo contra la BD real incluye DROP TABLE de varias
-- tablas erp_* que existen en la BD pero no están modeladas en Prisma.
-- =============================================================================

-- ─── Tabla de lotes de importación ─────────────────────────────────────────
CREATE TABLE `lotes_importacion_contable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_archivo` VARCHAR(255) NULL,
    `total_filas` INTEGER NOT NULL,
    `filas_validas` INTEGER NOT NULL,
    `filas_error` INTEGER NOT NULL,
    `creado_por` INTEGER NULL,
    `creado_en` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Tabla de asientos contables (una fila = una línea debe/haber) ────────
CREATE TABLE `asientos_contables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_lote` INTEGER NOT NULL,
    `correlativo` INTEGER NOT NULL,
    `relacionado` INTEGER NOT NULL,
    `codigo_tipo_medio_pago` VARCHAR(3) NULL,
    `ejercicio` VARCHAR(4) NOT NULL,
    `periodo` VARCHAR(2) NOT NULL,
    `cod_modulo` VARCHAR(2) NOT NULL,
    `modulo` VARCHAR(4) NOT NULL,
    `fuente` VARCHAR(2) NOT NULL,
    `numero_cuenta` VARCHAR(50) NOT NULL,
    `codigo_tipo_documento` VARCHAR(2) NULL,
    `numero_serie` VARCHAR(20) NULL,
    `numero_documento` VARCHAR(20) NULL,
    `concepto_fec` INTEGER NULL,
    `glosa` VARCHAR(500) NULL,
    `codigo_moneda_origen` VARCHAR(2) NOT NULL,
    `codigo_moneda_registro` VARCHAR(2) NOT NULL,
    `codigo_centro_costo` VARCHAR(8) NOT NULL,
    `codigo_sub_centro_costo` VARCHAR(8) NOT NULL,
    `codigo_sub_sub_centro_costo` VARCHAR(8) NOT NULL,
    `codigo_forma_provision` VARCHAR(2) NULL,
    `codigo_forma_pago_cobro` VARCHAR(2) NULL,
    `codigo_area` VARCHAR(6) NOT NULL,
    `identificador_ctr_mda` VARCHAR(1) NULL,
    `identificador_tip_afecto` VARCHAR(1) NULL,
    `nro_cheque` VARCHAR(30) NULL,
    `grdo` VARCHAR(100) NULL,
    `fecha_emision_doc` DATE NULL,
    `fecha_vencimiento_doc` DATE NULL,
    `fecha_movimiento` DATE NULL,
    `fecha_cbr` DATE NULL,
    `fecha_registro` DATE NULL,
    `fecha_conc` DATE NULL,
    `fecha_dif` DATE NULL,
    `cod_tip_doc_ident_clt` VARCHAR(2) NULL,
    `nro_doc_clt` VARCHAR(10) NULL,
    `razon_social_1` VARCHAR(800) NULL,
    `cod_tip_doc_ident_prov` VARCHAR(2) NULL,
    `nro_doc_prov` VARCHAR(10) NULL,
    `razon_social_2` VARCHAR(800) NULL,
    `cod_tip_doc_ident_trab` VARCHAR(2) NULL,
    `nro_doc_trab` VARCHAR(10) NULL,
    `razon_social_3` VARCHAR(800) NULL,
    `monto_debe` DECIMAL(13, 2) NOT NULL,
    `monto_haber` DECIMAL(13, 2) NOT NULL,
    `monto_debe_me` DECIMAL(13, 2) NULL,
    `monto_haber_me` DECIMAL(13, 2) NULL,
    `cambio_moneda` DECIMAL(13, 2) NOT NULL,
    `es_cancelado` BOOLEAN NULL DEFAULT false,
    `es_conciliado` BOOLEAN NULL DEFAULT false,
    `es_provision` BOOLEAN NULL DEFAULT false,
    `es_anulado` BOOLEAN NULL DEFAULT false,
    `es_destino` BOOLEAN NULL DEFAULT false,
    `doc_ref_fecha_emision` DATE NULL,
    `doc_ref_cod_tip_doc` VARCHAR(2) NULL,
    `doc_ref_nro_serie` VARCHAR(4) NULL,
    `doc_ref_nro_doc` VARCHAR(8) NULL,
    `numero_detraccion` VARCHAR(8) NULL,
    `fecha_pago_detraccion` VARCHAR(8) NULL,
    `campos_adicionales` JSON NULL,
    `creado_por` INTEGER NULL,
    `creado_en` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `editado_por` INTEGER NULL,
    `fecha_edicion` TIMESTAMP(0) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `asientos_contables_id_lote_idx`(`id_lote`),
    INDEX `asientos_contables_ejercicio_periodo_idx`(`ejercicio`, `periodo`),
    INDEX `asientos_contables_numero_cuenta_idx`(`numero_cuenta`),
    INDEX `asientos_contables_correlativo_idx`(`correlativo`),
    INDEX `asientos_contables_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `asientos_contables`
  ADD CONSTRAINT `asientos_contables_id_lote_fkey`
  FOREIGN KEY (`id_lote`) REFERENCES `lotes_importacion_contable`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Catálogos (hoja "TABLAS" del Excel original, sección 5 del spec) ─────

CREATE TABLE `cat_modulo` (
    `codigo` VARCHAR(2) NOT NULL,
    `descripcion` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_modulo` (`codigo`, `descripcion`) VALUES
('01', 'MODULO VENTA'),
('02', 'MODULO COMPRAS'),
('03', 'MODULO CONTABILIDAD'),
('04', 'MODULO TESORERIA'),
('05', 'MODULO ALMACEN'),
('08', 'MODULO CANJE DE LETRAS POR PAGAR'),
('09', 'MODULO CANJE DE LETRAS POR COBRAR'),
('11', 'MODULO PRODUCCION'),
('12', 'MODULO IMPORTACION'),
('13', 'MODULO FABRICACION'),
('14', 'MODULO LIQUIDACION DE FONDOS'),
('15', 'MODULO PLANILLA'),
('16', 'MODULO ACTIVOS FIJOS'),
('17', 'MODULO PROCESO COMPRA');

CREATE TABLE `cat_fuente` (
    `codigo` VARCHAR(2) NOT NULL,
    `descripcion` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Nota (sección 6.5 del spec): "CB" aparecía duplicado en el Excel original
-- (fila 3 y fila 7 de la Tabla 2). Se conserva un único valor acá.
INSERT INTO `cat_fuente` (`codigo`, `descripcion`) VALUES
('CB', 'CAJA BANCOS'),
('LD', 'LIBRO DIARIO'),
('RC', 'REGISTRO DE COMPRAS'),
('RV', 'REGISTRO DE VENTAS');

CREATE TABLE `cat_moneda` (
    `codigo` VARCHAR(2) NOT NULL,
    `descripcion` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_moneda` (`codigo`, `descripcion`) VALUES
('01', 'Nuevos Soles'),
('02', 'Dólares Américanos');

CREATE TABLE `cat_tipo_doc_identidad` (
    `codigo` VARCHAR(2) NOT NULL,
    `descripcion` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_tipo_doc_identidad` (`codigo`, `descripcion`) VALUES
('9', 'CARNET'),
('00', 'OTROS TIPOS DE DOCUMENTOS'),
('01', 'DOCUMENTO NACIONAL DE IDENTIDAD'),
('02', 'CIP'),
('03', 'PLACAS AUTOMOTRIZ'),
('04', 'CARNET DE EXTRANJERIA'),
('05', 'PLACA DE REGISTRO'),
('06', 'REGISTRO UNICO DE CONTRIBUYENTES'),
('07', 'PASAPORTE'),
('08', 'AGENTES'),
('09', 'LOTE'),
('10', 'NO DOMICILIADOS'),
('11', 'NUMERO DE IDENTIFICACION TRIBUTARIA'),
('12', 'CLAVE UNICA DE IDENTIFICACION TRIBUTARIA'),
('13', 'BANCOS');

-- Rotulada "(FUENTE)" en el Excel original pero contiene datos de FORMA DE
-- PAGO (referenciada por "Cod. Forma Pago/Cobro", no por "Fuente" — sección
-- 6.5 del spec). Renombrada acá para evitar confusión.
CREATE TABLE `cat_forma_pago` (
    `codigo` VARCHAR(2) NOT NULL,
    `descripcion` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_forma_pago` (`codigo`, `descripcion`) VALUES
('01', 'CONTADO'),
('02', 'CREDITO'),
('03', 'LETRA');

CREATE TABLE `cat_medio_pago` (
    `codigo` VARCHAR(3) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_medio_pago` (`codigo`, `descripcion`) VALUES
('001', 'Depósito en cuenta'),
('002', 'Giro'),
('003', 'Transferencia de Fondos'),
('004', 'Orden de Pago'),
('005', 'Tarjeta de Débito'),
('006', 'Tarjeta de Credito'),
('007', 'Cheques con la clausula de "no negociable","Instrasferibles","No a la orden" u otra equivalente, a que se refiere el inciso F) del articulo 5° del Decreto Legislativo'),
('008', 'Efectivo, por operaciones en las que no existe obligación de utilizar medios de pago'),
('009', 'Efectivo, en los demas casos'),
('010', 'Medios de pago de comercio exterior'),
('011', 'Letra de cambio'),
('101', 'Transferencias - Comercio Exterior'),
('102', 'Cheques bancarios - Comercio Exterior'),
('103', 'Orden de Pago Simple - Comercio Exterior'),
('104', 'Orden de Pago Documentario - Comercio Exterior'),
('105', 'Remesa Simple - Comercio Exterior'),
('106', 'Remesa Documentaria - Comercio Exterior'),
('107', 'Carta de Crédito Simple - Comercio Exterior'),
('108', 'Carta de Crédito Documentario - Comercio Exterior');

CREATE TABLE `cat_indicador_afecto` (
    `codigo` VARCHAR(1) NOT NULL,
    `descripcion` VARCHAR(150) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_indicador_afecto` (`codigo`, `descripcion`) VALUES
('S', 'Adquisiciones Gravadas destinadas a Operaciones Gravadas'),
('E', 'Adquisiciones Gravadas destinadas a Operaciones Gravadas y No Gravadas'),
('C', 'Adquisiciones Gravadas destinadas a No Gravadas'),
('F', 'Operaciones que no dan Credido Fiscal'),
('N', 'Operaciones No Gravadas'),
('O', 'Otros'),
('X', 'Operaciones SIN REGISTRO en libro RC');

CREATE TABLE `cat_concepto_flujo_efectivo` (
    `codigo` VARCHAR(1) NOT NULL,
    `descripcion` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`codigo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cat_concepto_flujo_efectivo` (`codigo`, `descripcion`) VALUES
('1', 'OPERACIÓN'),
('2', 'INVERSIÓN'),
('3', 'FINANCIACIÓN');
