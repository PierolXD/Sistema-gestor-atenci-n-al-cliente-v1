import { z } from 'zod';

export const crearOtDtoSchema = z.object({
  nis: z.string().trim().min(3, 'Ingrese el NIS del suministro.'),
  ticket_id: z.coerce.number().int().positive().optional().nullable(),
  cuadrilla_id: z.coerce.number().int().positive().optional().nullable(),
  tipo: z.enum(['EMERGENCIA', 'RECONEXION', 'INSPECCION', 'CORTE']).default('EMERGENCIA'),
  prioridad: z.enum(['CRITICA', 'ALTA', 'NORMAL']).default('ALTA'),
  titulo: z.string().trim().min(4, 'Ingrese el título de la Orden de Trabajo.'),
  descripcion: z.string().trim().optional().default(''),
  materiales_imputados: z.string().trim().optional().default('')
});

export type CrearOtDto = z.infer<typeof crearOtDtoSchema>;

export const reasignarOtDtoSchema = z.object({
  cuadrilla_id: z.coerce.number().int().positive('Seleccione una cuadrilla válida.'),
  motivo: z.string().trim().optional()
});

export type ReasignarOtDto = z.infer<typeof reasignarOtDtoSchema>;

export const agregarEventoOtDtoSchema = z.object({
  tipo_evento: z
    .enum(['DESPACHO', 'TRANSITO', 'ARRIBO', 'PRUEBA', 'REASIGNACION', 'CIERRE', 'NOTA'])
    .default('NOTA'),
  descripcion: z.string().trim().min(3, 'Ingrese la descripción del evento en campo.')
});

export type AgregarEventoOtDto = z.infer<typeof agregarEventoOtDtoSchema>;

export const avanzarEtapaOtDtoSchema = z.object({
  etapa: z.enum(['GENERADA', 'ASIGNADA', 'EN_SITIO', 'PRUEBAS', 'LIQUIDADA']),
  materiales_imputados: z.string().trim().optional(),
  validacion_cliente: z.string().trim().optional(),
  nota: z.string().trim().optional()
});

export type AvanzarEtapaOtDto = z.infer<typeof avanzarEtapaOtDtoSchema>;
