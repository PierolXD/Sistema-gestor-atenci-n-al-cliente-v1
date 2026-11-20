export type TicketPrioridad = 'URGENTE' | 'ALTA' | 'NORMAL';
export type OtPrioridad = 'CRITICA' | 'ALTA' | 'NORMAL';

/**
 * Reglas SLA SEAL / Osinergmin:
 * - Emergencia / falta de luz: 5 horas
 * - Reclamo comercial formal: 15 días (360 horas)
 * - Atención regular: 24 horas
 */
export function calcularSlaTicketHoras(
  prioridad: TicketPrioridad,
  esReclamoFormal = false,
  tipificacion?: string | null
): number {
  if (esReclamoFormal) return 360;
  if (prioridad === 'URGENTE' || (tipificacion && tipificacion.includes('REC-ELEC'))) return 5;
  if (prioridad === 'ALTA') return 5;
  return 24;
}

export function calcularSlaOtHoras(tipo: string, prioridad: OtPrioridad): number {
  if (prioridad === 'CRITICA') return 2;
  if (tipo === 'EMERGENCIA' || prioridad === 'ALTA') return 5;
  return 24;
}

export function sumarHorasIso(horas: number, desde: Date = new Date()): Date {
  return new Date(desde.getTime() + horas * 3600 * 1000);
}
