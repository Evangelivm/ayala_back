export class CreateGreTestDto {
  tipo_de_comprobante: 7 | 8; // 7 = GRE Remitente, 8 = GRE Transportista
  descripcion_test?: string;
}

export interface GreRemitenteTestData {
  // DATOS PRINCIPALES
  operacion: 'generar_guia';
  tipo_de_comprobante: 7;
  serie: string;
  numero: number;

  // CLIENTE (Destinatario)
  cliente_tipo_de_documento: number;
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  cliente_email?: string;

  // FECHAS (Formato DD-MM-YYYY como string según API Nubefact)
  fecha_de_emision: string;
  fecha_de_inicio_de_traslado: string;

  // TRASLADO (Obligatorio para GRE Remitente)
  motivo_de_traslado: string;
  numero_de_bultos: number;
  tipo_de_transporte: string;

  // PESO
  peso_bruto_total: number;
  peso_bruto_unidad_de_medida: string;

  // TRANSPORTE
  transportista_placa_numero: string;
  transportista_documento_tipo?: number;
  transportista_documento_numero?: string;
  transportista_denominacion?: string;

  // CONDUCTOR (Si tipo_de_transporte = 02)
  conductor_documento_tipo?: number;
  conductor_documento_numero?: string;
  conductor_denominacion?: string;
  conductor_nombre?: string;
  conductor_apellidos?: string;
  conductor_numero_licencia?: string;

  // UBICACIONES
  punto_de_partida_ubigeo: string;
  punto_de_partida_direccion: string;
  punto_de_partida_codigo_establecimiento_sunat?: string;
  punto_de_llegada_ubigeo: string;
  punto_de_llegada_direccion: string;
  punto_de_llegada_codigo_establecimiento_sunat?: string;

  // OPCIONALES
  observaciones?: string;
  id_proyecto?: number;
  id_etapa?: number;
  id_sector?: number;
  id_frente?: number;
  id_partida?: number;

  // ITEMS
  items: {
    unidad_de_medida: string;
    codigo?: string;
    descripcion: string;
    cantidad: number;
  }[];

  // DOCUMENTOS RELACIONADOS (Opcional)
  documento_relacionado?: {
    tipo: string;
    serie: string;
    numero: number;
  }[];
}

export interface GreTransportistaTestData {
  // DATOS PRINCIPALES
  operacion: 'generar_guia';
  tipo_de_comprobante: 8;
  serie: string;
  numero: number;

  // CLIENTE (Remitente)
  cliente_tipo_de_documento: number;
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  cliente_email?: string;

  // FECHAS (Formato DD-MM-YYYY como string según API Nubefact)
  fecha_de_emision: string;
  fecha_de_inicio_de_traslado: string;

  // PESO
  peso_bruto_total: number;
  peso_bruto_unidad_de_medida: string;

  // TRANSPORTE
  transportista_placa_numero: string;
  tuc_vehiculo_principal?: string;

  // CONDUCTOR (Obligatorio para GRE Transportista)
  conductor_documento_tipo: number;
  conductor_documento_numero: string;
  conductor_denominacion: string;
  conductor_nombre: string;
  conductor_apellidos: string;
  conductor_numero_licencia: string;

  // DESTINATARIO (Obligatorio para GRE Transportista)
  destinatario_documento_tipo: number;
  destinatario_documento_numero: string;
  destinatario_denominacion: string;

  // UBICACIONES
  punto_de_partida_ubigeo: string;
  punto_de_partida_direccion: string;
  punto_de_partida_codigo_establecimiento_sunat?: string;
  punto_de_llegada_ubigeo: string;
  punto_de_llegada_direccion: string;
  punto_de_llegada_codigo_establecimiento_sunat?: string;

  // OPCIONALES
  observaciones?: string;
  id_proyecto?: number;
  id_etapa?: number;
  id_sector?: number;
  id_frente?: number;
  id_partida?: number;

  // ITEMS
  items: {
    unidad_de_medida: string;
    codigo?: string;
    descripcion: string;
    cantidad: number;
  }[];

  // DOCUMENTOS RELACIONADOS (Opcional)
  documento_relacionado?: {
    tipo: string;
    serie: string;
    numero: number;
  }[];
}
