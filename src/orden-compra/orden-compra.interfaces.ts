export interface OrdenCompraHeader {
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

export interface DatosOrdenCompra {
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
  retencionPorcentaje: number;
  retencionMonto: number;
  netoAPagar: number;
  tieneAnticipo?: boolean;
}

export interface Firmas {
  generaOrden: string;
  jefeAdministrativo: string;
  gerencia: string;
}

export interface OrdenCompraData {
  header: OrdenCompraHeader;
  datosProveedor: DatosProveedor;
  datosOrdenCompra: DatosOrdenCompra;
  observacion: Observacion;
  detalleItems: DetalleItem[];
  totales: Totales;
  firmas: Firmas;
}
