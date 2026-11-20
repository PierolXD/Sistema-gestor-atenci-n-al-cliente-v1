export interface TurnoEntity {
  id: number;
  codigo_turno: string;
  sucursal_id: number;
  cliente_id: number | null;
  suministro_id: number | null;
  nombre_visitante: string;
  dni_visitante: string;
  nis_visitante: string | null;
  modulo_cola: 'A' | 'B' | 'C';
  prioridad: 'NORMAL' | 'PREFERENCIAL' | 'TECNICO';
  motivo_visita: string;
  canal_emision: 'SALA' | 'TOTEM' | 'CITA_WEB';
  estado: 'EN_ESPERA' | 'EN_ATENCION' | 'DERIVADO' | 'FINALIZADO' | 'AUSENTE';
  ventanilla_id: number | null;
  operador_id: number | null;
  notas_atencion: string;
  resolucion_resumen: string | null;
  calificacion_csat: number | null;
  creado_en: Date;
  llamado_en: Date | null;
  finalizado_en: Date | null;
  duracion_segundos: number;
}

export interface TurnoConEspera extends TurnoEntity {
  espera_segundos: number;
  transcurrido_segundos: number;
  ventanilla_nombre?: string | null;
}
