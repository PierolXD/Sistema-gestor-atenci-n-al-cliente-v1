import { z } from 'zod';

export const crearClienteSuministroDtoSchema = z.object({
  dni_ruc: z.string().trim().min(8, 'DNI/RUC inválido').max(15),
  tipo_documento: z.enum(['DNI', 'RUC', 'CE']).default('DNI'),
  nombres_apellidos: z.string().trim().min(3, 'Ingrese nombres y apellidos o razón social'),
  telefono: z.string().trim().optional().nullable(),
  correo: z.string().trim().email('Correo inválido').optional().or(z.literal('')).nullable(),
  notificaciones_sms: z.boolean().default(true),
  nis: z.string().trim().min(4, 'Ingrese N° de Suministro (NIS)').max(25),
  numero_medidor: z.string().trim().min(4, 'Ingrese N° de Medidor').max(40),
  tipo_medidor: z.string().trim().default('Monofásico Inteligente'),
  tarifa: z.string().trim().default('BT5B Residencial'),
  potencia_contratada_kw: z.coerce.number().positive().default(3.5),
  direccion: z.string().trim().min(4, 'Ingrese la dirección del suministro'),
  distrito: z.string().trim().default('Arequipa'),
  sector: z.string().trim().default('Sector Centro'),
  subestacion_sed: z.string().trim().optional().default('SE-041 Arequipa'),
  alimentador_mt: z.string().trim().optional().default('ALIM-B04')
});

export type CrearClienteSuministroDto = z.infer<typeof crearClienteSuministroDtoSchema>;

export const actualizarClienteDtoSchema = z.object({
  dni_ruc: z.string().trim().min(8, 'DNI/RUC inválido').max(15).optional(),
  tipo_documento: z.enum(['DNI', 'RUC', 'CE']).optional(),
  nombres_apellidos: z.string().trim().min(3).optional(),
  telefono: z.string().trim().optional().nullable(),
  correo: z.string().trim().email('Correo inválido').optional().or(z.literal('')).nullable(),
  notificaciones_sms: z.boolean().optional(),
  categoria_crediticia: z.enum(['A', 'B', 'C']).optional(),
  score_crediticio: z.coerce.number().int().min(0).max(100).optional(),
  activo: z.boolean().optional()
});

export type ActualizarClienteDto = z.infer<typeof actualizarClienteDtoSchema>;

export const cambiarEstadoClienteDtoSchema = z.object({
  activo: z.boolean()
});

export type CambiarEstadoClienteDto = z.infer<typeof cambiarEstadoClienteDtoSchema>;

export const actualizarSuministroDtoSchema = z.object({
  numero_medidor: z.string().trim().min(4).optional(),
  tipo_medidor: z.string().trim().optional(),
  tarifa: z.string().trim().optional(),
  potencia_contratada_kw: z.coerce.number().positive().optional(),
  estado_servicio: z.enum(['ACTIVO', 'CORTADO', 'SUSPENDIDO']).optional(),
  precinto_bornera: z.string().trim().optional(),
  precinto_caja: z.string().trim().optional(),
  lectura_actual_kwh: z.coerce.number().min(0).optional(),
  tension_rms_v: z.coerce.number().min(0).optional(),
  corriente_a: z.coerce.number().min(0).optional(),
  factor_potencia: z.coerce.number().min(0).max(1).optional()
});

export type ActualizarSuministroDto = z.infer<typeof actualizarSuministroDtoSchema>;

export const crearInspeccionDtoSchema = z.object({
  tipo: z.enum(['CONTRASTE', 'RENOVACION_ACOMETIDA', 'INSPECCION_PRECINTO']).default('CONTRASTE'),
  laboratorio_o_ot: z.string().trim().min(2).default('Laboratorio Móvil LAB-02'),
  estado: z.enum(['PROGRAMADO', 'APROBADO', 'OBSERVADO', 'EJECUTADO']).default('PROGRAMADO'),
  fecha_ensayo: z.string().trim().optional(),
  error_medido_pct: z.string().trim().optional().default('Pendiente'),
  precinto_bornera: z.string().trim().optional(),
  precinto_caja: z.string().trim().optional(),
  observaciones: z.string().trim().optional()
});

export type CrearInspeccionDto = z.infer<typeof crearInspeccionDtoSchema>;

export const crearAutorizadoDtoSchema = z.object({
  nombre_completo: z.string().trim().min(3, 'Ingrese nombre completo'),
  relacion: z.string().trim().min(2, 'Ingrese relación o cargo'),
  dni: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  correo: z.string().trim().email('Correo inválido').optional().or(z.literal('')).nullable(),
  poder_legal: z.boolean().default(false),
  nivel: z.enum(['PRINCIPAL', 'SECUNDARIO', 'TECNICO']).default('SECUNDARIO')
});

export type CrearAutorizadoDto = z.infer<typeof crearAutorizadoDtoSchema>;
