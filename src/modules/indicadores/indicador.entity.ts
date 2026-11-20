export type PeriodoIndicador = 'hoy' | 'semana' | 'mes';

export interface IndicadorKpis {
  tmo_segundos: number;
  fcr_pct: number;
  csat_promedio: number;
  csat_evaluaciones: number;
  criticos_sla: number;
  total_atenciones_turno: number;
  total_tickets_periodo: number;
}

export interface PuntoAfluencia {
  hora: string;
  emitidos: number;
  espera_min: number;
}

export interface DistribucionSolicitud {
  categoria: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

export interface RendimientoOperadorRow {
  usuario_id: number;
  codigo_empleado: string;
  nombre_completo: string;
  iniciales: string;
  rol: string;
  cargo: string | null;
  ventanilla_codigo: string | null;
  ventanilla_nombre: string | null;
  tipo_modulo: string | null;
  ventanilla_estado: string | null;
  atenciones_totales: number;
  tmo_segundos: number;
  csat_promedio: number;
  tickets_resueltos: number;
  indice_conformidad_pct: number;
}
