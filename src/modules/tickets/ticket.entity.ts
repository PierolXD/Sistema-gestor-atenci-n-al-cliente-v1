export type TicketCanal = 'PRESENCIAL' | 'WHATSAPP' | 'PORTAL_WEB' | 'CALL_CENTER';
export type TicketPrioridad = 'URGENTE' | 'ALTA' | 'NORMAL';
export type TicketEstado =
  | 'REGISTRADO'
  | 'EN_ATENCION'
  | 'EN_CUADRILLA'
  | 'ESCALADO_RECLAMO'
  | 'RESUELTO'
  | 'CERRADO';

export type AccionInmediata =
  | 'DESPACHAR_CUADRILLA'
  | 'ESCALAR_RECLAMO'
  | 'ATENCION_INFORMATIVA'
  | 'DERIVAR_LABORATORIO';

export interface TicketEntity {
  id: number;
  codigo: string;
  turno_id: number | null;
  cliente_id: number;
  suministro_id: number;
  canal: TicketCanal;
  prioridad: TicketPrioridad;
  asunto: string;
  descripcion: string;
  tipificacion_normativa: string | null;
  accion_inmediata: AccionInmediata | string | null;
  estado: TicketEstado;
  es_reclamo_formal: boolean;
  operador_asignado_id: number | null;
  sla_horas: number;
  sla_limite_en: Date;
  dictamen_tecnico: string | null;
  conflicto_marcado: boolean;
  resuelto_primer_contacto: boolean;
  creado_en: Date;
  actualizado_en: Date;
  cerrado_en: Date | null;
}

export interface TicketMensajeEntity {
  id: number;
  ticket_id: number;
  autor_tipo: 'BOT' | 'CLIENTE' | 'SCADA' | 'AGENTE' | 'SISTEMA';
  autor_nombre: string;
  mensaje: string;
  evidencia_url: string | null;
  creado_en: Date;
}

export interface TicketDetalle extends TicketEntity {
  cliente_nombre: string;
  dni_ruc: string;
  telefono: string | null;
  nis: string;
  numero_medidor: string;
  tarifa: string;
  direccion: string;
  subestacion_sed: string | null;
  operador_nombre: string | null;
  sla_restante_segundos: number;
  ot_vinculada?: {
    id: number;
    codigo: string;
    etapa: string;
    cuadrilla_nombre: string | null;
  } | null;
  mensajes?: TicketMensajeEntity[];
}
