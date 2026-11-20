export type ReciboEstado = 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'FRACCIONADO';
export type MetodoPago = 'EFECTIVO' | 'POS' | 'BILLETERA' | 'TRANSFERENCIA';
export type TipoComprobante = 'BOLETA' | 'FACTURA';
export type DestinoCopia = 'IMPRESO' | 'EMAIL_SMS';

export interface ReciboEntity {
  id: number;
  numero_recibo: string;
  suministro_id: number;
  periodo: string;
  consumo_kwh: number;
  energia_activa: number;
  reposicion_mant: number;
  cargo_fijo: number;
  alumbrado_publico: number;
  igv: number;
  total: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: ReciboEstado;
  convenio_id: number | null;
}

export interface PagoEntity {
  id: number;
  codigo_operacion: string;
  recibo_id: number;
  suministro_id: number;
  operador_id: number | null;
  monto: number;
  metodo_pago: MetodoPago;
  tipo_comprobante: TipoComprobante;
  numero_comprobante: string;
  destino_copia: DestinoCopia;
  pagado_en: Date;
}

export interface ConvenioEntity {
  id: number;
  codigo_acta: string;
  cliente_id: number;
  suministro_id: number;
  operador_id: number | null;
  capital_fraccionado: number;
  tcea_pct: number;
  numero_cuotas: 3 | 6 | 12;
  interes_estimado: number;
  cuota_mensual: number;
  estado: 'VIGENTE' | 'CANCELADO' | 'ANULADO';
  creado_en: Date;
}
