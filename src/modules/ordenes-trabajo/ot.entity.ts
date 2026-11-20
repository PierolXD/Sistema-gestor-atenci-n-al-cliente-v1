export type OtTipo = 'EMERGENCIA' | 'RECONEXION' | 'INSPECCION' | 'CORTE';
export type OtPrioridad = 'CRITICA' | 'ALTA' | 'NORMAL';
export type OtEtapa = 'GENERADA' | 'ASIGNADA' | 'EN_SITIO' | 'PRUEBAS' | 'LIQUIDADA';
export type OtEventoTipo = 'DESPACHO' | 'TRANSITO' | 'ARRIBO' | 'PRUEBA' | 'REASIGNACION' | 'CIERRE' | 'NOTA';

export interface CuadrillaEntity {
  id: number;
  codigo: string;
  nombre: string;
  lider_nombre: string;
  cip: string | null;
  especialidad: 'EMERGENCIA' | 'MEDIA_TENSION' | 'INSPECCION' | 'RECONEXION';
  estado: 'DISPONIBLE' | 'EN_RUTA' | 'EN_SITIO' | 'EN_BASE';
  zona: string | null;
  latitud: number | null;
  longitud: number | null;
  ubicacion_texto: string | null;
}

export interface OrdenTrabajoEntity {
  id: number;
  codigo: string;
  ticket_id: number | null;
  suministro_id: number;
  cuadrilla_id: number | null;
  tipo: OtTipo;
  prioridad: OtPrioridad;
  titulo: string;
  descripcion: string | null;
  etapa: OtEtapa;
  sla_horas: number;
  sla_limite_en: Date;
  materiales_imputados: string;
  acta_digital_hash: string | null;
  validacion_cliente: string | null;
  creado_por_id: number | null;
  creado_en: Date;
  actualizado_en: Date;
  liquidada_en: Date | null;
}

export interface OtEventoEntity {
  id: number;
  ot_id: number;
  tipo_evento: OtEventoTipo;
  descripcion: string;
  reportado_por: string;
  creado_en: Date;
}

export interface OrdenTrabajoDetalle extends OrdenTrabajoEntity {
  nis: string;
  numero_medidor: string;
  tarifa: string;
  direccion: string;
  subestacion_sed: string | null;
  alimentador_mt: string | null;
  latitud: number;
  longitud: number;
  cliente_nombre: string;
  cuadrilla_codigo: string | null;
  cuadrilla_nombre: string | null;
  cuadrilla_lider: string | null;
  cuadrilla_cip: string | null;
  cuadrilla_ubicacion: string | null;
  ticket_codigo: string | null;
  sla_restante_segundos: number;
  eventos?: OtEventoEntity[];
}
