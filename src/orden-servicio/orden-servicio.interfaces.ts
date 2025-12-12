export interface OrdenServicioHeader {
  og: string;
  fechaEmision: string;
  ruc: string;
}

export interface DatosProveedor {
  empresa: string;
  ruc: string;
  atencion: string;
  telefono: string;
}

export interface DatosOrdenServicio {
  direccion: string;
  condicion: string;
  moneda: string;
  tipoCambio?: number;
}

export interface Observacion {
  nivel1?: string;
  nivel2?: string;
  nivel3?: string;
  observaciones?: string;
  cuentaBancaria?: string;
  placaCamion?: string;
  placaMaquinaria?: string;
}

export interface DetalleItem {
  numero: number;
  descripcion: string;
  codigo: string;
  unidadMedida: string;
  cantidad: number;
  valorUnitario: number;
  subTotal: number;
}

export interface Totales {
  subtotal: number;
  igv: number;
  total: number;
  proveedorAgenteRetencion: boolean;
  detraccionPorcentaje: number;
  detraccionMonto: number;
  netoAPagar: number;
  tieneAnticipo?: boolean;
  tipoDetraccionTexto?: string; // Ejemplo: "001-Azúcar y melaza de caña"
}

export interface Firmas {
  generaOrden: string;
  jefeAdministrativo: string;
  gerencia: string;
  jefeProyectos: string;
}

export interface OrdenServicioData {
  header: OrdenServicioHeader;
  datosProveedor: DatosProveedor;
  datosOrdenServicio: DatosOrdenServicio;
  observacion: Observacion;
  detalleItems: DetalleItem[];
  totales: Totales;
  firmas: Firmas;
}
