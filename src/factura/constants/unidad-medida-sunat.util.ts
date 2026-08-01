// Mapeo de unidades de medida en texto libre (columna items.u_m) a códigos
// del Catálogo 03 de SUNAT, requeridos por NUBEFACT en unidad_de_medida.
// Fuente única: antes estaba duplicado en factura-detector.service.ts y
// factura-crud.controller.ts, lo que provocó que diverjan entre sí.
const MAPEO_UNIDAD_MEDIDA_SUNAT: Record<string, string> = {
  UNIDAD: 'NIU',
  UNIDADES: 'NIU',
  UND: 'NIU',
  SERVICIO: 'ZZ',
  SERVICIOS: 'ZZ',
  SRV: 'ZZ',
  SERV: 'ZZ',
  HORA: 'HUR',
  HORAS: 'HUR',
  HR: 'HUR',
  HRS: 'HUR',
  VIAJE: 'ZZ',
  VIAJES: 'ZZ',
  METRO: 'MTR',
  METROS: 'MTR',
  M: 'MTR',
  KILOGRAMO: 'KGM',
  KILOGRAMOS: 'KGM',
  KG: 'KGM',
  LITRO: 'LTR',
  LITROS: 'LTR',
  L: 'LTR',
  'METRO CUBICO': 'MTQ',
  M3: 'MTQ',
  TONELADA: 'TNE',
  TONELADAS: 'TNE',
  TON: 'TNE',
  CAJA: 'BX',
  CAJAS: 'BX',
  BOLSA: 'BG',
  BOLSAS: 'BG',
  PAQUETE: 'PK',
  PAQUETES: 'PK',
  GALON: 'GLL',
  GALONES: 'GLL',
  JUEGO: 'SET',
  JUEGOS: 'SET',
  'PQT 8U': 'PK',
  TALONARIO: 'NIU',
  TALONARIOS: 'NIU',
  BALDE: 'NIU',
  BALDES: 'NIU',
  'BAL 19LT': 'NIU',
  BIDON: 'NIU',
  BIDONES: 'NIU',
  BLISTER: 'NIU',
  BLISTERS: 'NIU',
};

/**
 * Mapea una unidad de medida en texto libre a un código válido del
 * Catálogo 03 de SUNAT. Si no hay mapeo conocido, devuelve la unidad
 * original sin cambios (NUBEFACT la rechazará con codigo 21 si no es
 * ya un código válido).
 */
export function mapearUnidadMedidaSunat(unidad: string): string {
  const unidadUpper = unidad.toUpperCase().trim();
  return MAPEO_UNIDAD_MEDIDA_SUNAT[unidadUpper] || unidad;
}
