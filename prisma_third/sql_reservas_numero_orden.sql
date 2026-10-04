-- Reservas temporales de número de orden (compra y servicio).
-- Cada formulario abierto reserva su número en el servidor para que dos
-- personas nunca vean el mismo número. La unicidad real de las órdenes sigue
-- garantizada por el UNIQUE de numero_orden en ordenes_compra / ordenes_servicio.
-- Ejecutar manualmente en la BD terciaria (NO usar prisma db push).

CREATE TABLE IF NOT EXISTS reservas_numero_orden (
  id           INT          NOT NULL AUTO_INCREMENT,
  tipo         VARCHAR(10)  NOT NULL COMMENT 'compra | servicio',
  serie        VARCHAR(10)  NOT NULL,
  nro          INT          NOT NULL,
  propietario  VARCHAR(64)  NOT NULL COMMENT 'clave generada por el navegador (una por dialog abierto)',
  expira_en    DATETIME     NOT NULL,
  creado_en    TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reserva_numero (tipo, serie, nro),
  KEY idx_reserva_propietario (propietario),
  KEY idx_reserva_expira (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
