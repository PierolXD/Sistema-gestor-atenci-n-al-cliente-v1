import { z } from 'zod';

export const registrarPagoDtoSchema = z.object({
  recibo_id: z.coerce.number().int().positive('Seleccione un recibo pendiente.'),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0.'),
  metodo_pago: z.enum(['EFECTIVO', 'POS', 'BILLETERA', 'TRANSFERENCIA']).default('EFECTIVO'),
  tipo_comprobante: z.enum(['BOLETA', 'FACTURA']).default('BOLETA'),
  destino_copia: z.enum(['IMPRESO', 'EMAIL_SMS']).default('IMPRESO')
});

export type RegistrarPagoDto = z.infer<typeof registrarPagoDtoSchema>;

export const crearConvenioDtoSchema = z.object({
  suministro_id: z.coerce.number().int().positive('Suministro inválido.'),
  numero_cuotas: z.coerce
    .number()
    .int()
    .refine((v): v is 3 | 6 | 12 => v === 3 || v === 6 || v === 12, {
      message: 'Las cuotas permitidas son 3, 6 o 12 meses.'
    }),
  recibo_ids: z.array(z.coerce.number().int().positive()).optional()
});

export type CrearConvenioDto = z.infer<typeof crearConvenioDtoSchema>;

export const emitirReciboDtoSchema = z.object({
  nis: z.string().trim().min(3, 'Ingrese el NIS del suministro.'),
  periodo: z.string().trim().min(3, 'Ingrese el periodo (ej. Nov 2026).'),
  consumo_kwh: z.coerce.number().min(0, 'Consumo inválido.'),
  energia_activa: z.coerce.number().positive('El importe de energía debe ser mayor a 0.'),
  reposicion_mant: z.coerce.number().min(0).default(4.1),
  cargo_fijo: z.coerce.number().min(0).default(5.1),
  alumbrado_publico: z.coerce.number().min(0).default(14.5),
  fecha_vencimiento: z.string().trim().optional()
});

export type EmitirReciboDto = z.infer<typeof emitirReciboDtoSchema>;
