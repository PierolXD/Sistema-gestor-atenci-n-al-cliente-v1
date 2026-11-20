import { z } from 'zod';

export const loginDtoSchema = z.object({
  codigo_empleado: z.string().trim().min(2, 'Ingrese su código o usuario de empleado.'),
  password: z.string().min(1, 'Ingrese su contraseña.'),
  sucursal_id: z.coerce.number().int().positive().optional()
});

export type LoginDto = z.infer<typeof loginDtoSchema>;

export const cambiarEstadoVentanillaDtoSchema = z.object({
  estado: z.enum(['DISPONIBLE', 'PAUSA'])
});

export type CambiarEstadoVentanillaDto = z.infer<typeof cambiarEstadoVentanillaDtoSchema>;
