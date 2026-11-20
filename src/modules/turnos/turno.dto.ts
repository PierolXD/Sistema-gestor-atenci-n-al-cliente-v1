import { z } from 'zod';

export const emitirTurnoDtoSchema = z.object({
  nombre_visitante: z.string().trim().min(2, 'Ingrese el nombre del visitante o titular.'),
  dni_visitante: z.string().trim().min(8, 'El DNI/RUC es obligatorio en ventanilla (mínimo 8 dígitos).').max(20),
  nis_visitante: z.string().trim().optional().nullable(),
  modulo_cola: z.enum(['A', 'B', 'C']).default('A'),
  motivo_visita: z.string().trim().min(3, 'Seleccione o ingrese el motivo de visita.'),
  canal_emision: z.enum(['SALA', 'TOTEM', 'CITA_WEB']).default('SALA')
});

export type EmitirTurnoDto = z.infer<typeof emitirTurnoDtoSchema>;

export const derivarTurnoDtoSchema = z.object({
  modulo_cola: z.enum(['A', 'B', 'C']),
  motivo_derivacion: z.string().trim().optional()
});

export type DerivarTurnoDto = z.infer<typeof derivarTurnoDtoSchema>;

export const agregarNotaTurnoDtoSchema = z.object({
  nota: z.string().trim().min(2, 'Ingrese una nota de atención.')
});

export type AgregarNotaTurnoDto = z.infer<typeof agregarNotaTurnoDtoSchema>;

export const finalizarTurnoDtoSchema = z.object({
  resolucion_resumen: z.string().trim().min(3, 'Ingrese un breve resumen de lo resuelto.'),
  calificacion_csat: z.coerce.number().int().min(1).max(5).optional().nullable()
});

export type FinalizarTurnoDto = z.infer<typeof finalizarTurnoDtoSchema>;
