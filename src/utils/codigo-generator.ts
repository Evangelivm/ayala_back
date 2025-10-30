/**
 * Utilidades para generar códigos únicos
 */

/**
 * Genera un código alfanumérico único de longitud especificada
 * Usa mayúsculas y números (A-Z, 0-9)
 * @param length Longitud del código a generar (default: 10)
 * @returns String alfanumérico único
 */
export function generarCodigoAlfanumerico(length: number = 10): string {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';

  for (let i = 0; i < length; i++) {
    const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
    codigo += caracteres.charAt(indiceAleatorio);
  }

  return codigo;
}

/**
 * Genera un identificador único con timestamp y parte aleatoria
 * Formato: YYYYMMDD + 2 caracteres aleatorios (10 caracteres totales)
 * Ejemplo: 2025103027
 * @returns String alfanumérico de 10 caracteres
 */
export function generarIdentificadorUnico(): string {
  const fecha = new Date();
  const year = fecha.getFullYear().toString();
  const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const day = fecha.getDate().toString().padStart(2, '0');

  // Parte de fecha: 8 dígitos (YYYYMMDD)
  const partefecha = `${year}${month}${day}`;

  // Parte aleatoria: 2 caracteres
  const parteAleatoria = generarCodigoAlfanumerico(2);

  return `${partefecha}${parteAleatoria}`;
}

/**
 * Genera un identificador completamente aleatorio de 10 caracteres
 * Solo usa letras mayúsculas y números
 * @returns String alfanumérico de 10 caracteres
 */
export function generarIdentificadorAleatorio(): string {
  return generarCodigoAlfanumerico(10);
}
