-- Tabla nueva para los asientos generados desde el Excel de Registro de Compras
-- (puerto a ayala de la herramienta standalone "herramienta_excel", que insertaba
-- en una tabla `masivo` de la BD MySQL sire2024/sire2025).
-- Corre esto contra la BD de prisma_third (DATABASE_URL_THIRD).
CREATE TABLE IF NOT EXISTS masivo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campo INT NOT NULL,
  sub_diario INT NOT NULL,
  num_comprobante VARCHAR(20) NOT NULL,
  fecha_documento DATETIME NOT NULL,
  fecha_vencimiento DATETIME NOT NULL,
  tipo_documento VARCHAR(10),
  numero_documento VARCHAR(50),
  codigo_anexo VARCHAR(20),
  glosa_principal VARCHAR(100),
  importe_original DECIMAL(14, 2) NOT NULL,
  debe_haber VARCHAR(1) NOT NULL,
  cod_moneda VARCHAR(5) NOT NULL,
  tasa_igv VARCHAR(5),
  cuenta_contable VARCHAR(20) NOT NULL,
  codigo_auxiliar VARCHAR(20),
  tipo_doc_referencia VARCHAR(10),
  num_doc_referencia VARCHAR(20),
  fecha_doc_referencia DATETIME,
  tipo_conversion VARCHAR(5),
  flag_conversion VARCHAR(5),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_masivo_num_comprobante (num_comprobante)
);
