// Tipos de detracción según SUNAT
export enum DetraccionTipo {
  AZUCAR = 1, // Azúcar
  ALCOHOL_ETILICO = 3, // Alcohol etílico
  RECURSOS_HIDROBIOLOGICOS = 4, // Recursos hidrobiológicos
  MAIZ_AMARILLO_DURO = 5, // Maíz amarillo duro
  ALGODON = 6, // Algodón
  CANA_DE_AZUCAR = 7, // Caña de azúcar
  MADERA = 8, // Madera
  ARENA_PIEDRA = 9, // Arena y piedra
  RESIDUOS_DESECHOS = 10, // Residuos, subproductos, desechos, recortes, desperdicios y formas primarias derivadas
  BIENES_APENDICE_I = 11, // Bienes del inciso A) del Apéndice I de la Ley del IGV
  INTERMEDIACION_LABORAL = 12, // Intermediación laboral y tercerización
  ARRENDAMIENTO_BIENES = 19, // Arrendamiento de bienes
  MANTENIMIENTO_REPARACION = 20, // Mantenimiento y reparación de bienes muebles
  MOVIMIENTO_CARGA = 21, // Movimiento de carga
  OTROS_SERVICIOS_EMPRESARIALES = 22, // Otros servicios empresariales
  LECHE = 23, // Leche
  COMISION_MERCANTIL = 30, // Comisión mercantil
  FABRICACION_BIENES = 31, // Fabricación de bienes por encargo
  SERVICIO_TRANSPORTE_PERSONAS = 32, // Servicio de transporte de personas
  CONTRATOS_CONSTRUCCION = 37, // Contratos de construcción
  TRANSPORTE_BIENES_VIA_TERRESTRE = 40, // Transporte de bienes realizado por vía terrestre
  TRANSPORTE_BIENES_VIA_FLUVIAL = 41, // Transporte de bienes realizado por vía fluvial
}

// Mapeo de nombres y porcentajes
export const DetraccionConfig: Record<
  DetraccionTipo,
  { nombre: string; porcentaje: number }
> = {
  [DetraccionTipo.AZUCAR]: { nombre: 'Azúcar', porcentaje: 10 },
  [DetraccionTipo.ALCOHOL_ETILICO]: { nombre: 'Alcohol etílico', porcentaje: 10 },
  [DetraccionTipo.RECURSOS_HIDROBIOLOGICOS]: {
    nombre: 'Recursos hidrobiológicos',
    porcentaje: 4,
  },
  [DetraccionTipo.MAIZ_AMARILLO_DURO]: {
    nombre: 'Maíz amarillo duro',
    porcentaje: 4,
  },
  [DetraccionTipo.ALGODON]: { nombre: 'Algodón', porcentaje: 10 },
  [DetraccionTipo.CANA_DE_AZUCAR]: { nombre: 'Caña de azúcar', porcentaje: 10 },
  [DetraccionTipo.MADERA]: { nombre: 'Madera', porcentaje: 4 },
  [DetraccionTipo.ARENA_PIEDRA]: { nombre: 'Arena y piedra', porcentaje: 10 },
  [DetraccionTipo.RESIDUOS_DESECHOS]: {
    nombre: 'Residuos, subproductos, desechos',
    porcentaje: 15,
  },
  [DetraccionTipo.BIENES_APENDICE_I]: {
    nombre: 'Bienes del Apéndice I',
    porcentaje: 10,
  },
  [DetraccionTipo.INTERMEDIACION_LABORAL]: {
    nombre: 'Intermediación laboral y tercerización',
    porcentaje: 12,
  },
  [DetraccionTipo.ARRENDAMIENTO_BIENES]: {
    nombre: 'Arrendamiento de bienes',
    porcentaje: 10,
  },
  [DetraccionTipo.MANTENIMIENTO_REPARACION]: {
    nombre: 'Mantenimiento y reparación',
    porcentaje: 10,
  },
  [DetraccionTipo.MOVIMIENTO_CARGA]: { nombre: 'Movimiento de carga', porcentaje: 10 },
  [DetraccionTipo.OTROS_SERVICIOS_EMPRESARIALES]: {
    nombre: 'Otros servicios empresariales',
    porcentaje: 10,
  },
  [DetraccionTipo.LECHE]: { nombre: 'Leche', porcentaje: 4 },
  [DetraccionTipo.COMISION_MERCANTIL]: {
    nombre: 'Comisión mercantil',
    porcentaje: 10,
  },
  [DetraccionTipo.FABRICACION_BIENES]: {
    nombre: 'Fabricación de bienes por encargo',
    porcentaje: 10,
  },
  [DetraccionTipo.SERVICIO_TRANSPORTE_PERSONAS]: {
    nombre: 'Transporte de personas',
    porcentaje: 10,
  },
  [DetraccionTipo.CONTRATOS_CONSTRUCCION]: {
    nombre: 'Contratos de construcción',
    porcentaje: 4,
  },
  [DetraccionTipo.TRANSPORTE_BIENES_VIA_TERRESTRE]: {
    nombre: 'Transporte terrestre de bienes',
    porcentaje: 4,
  },
  [DetraccionTipo.TRANSPORTE_BIENES_VIA_FLUVIAL]: {
    nombre: 'Transporte fluvial de bienes',
    porcentaje: 4,
  },
};

// Medio de pago para detracción
export enum MedioPagoDetraccion {
  DEPOSITO_CUENTA = 1, // Depósito en cuenta
  TRANSFERENCIA = 2, // Transferencia
}
