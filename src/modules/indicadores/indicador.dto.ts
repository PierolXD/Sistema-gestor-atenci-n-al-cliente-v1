import { z } from 'zod';

export const filtroIndicadoresDtoSchema = z.object({
  periodo: z.enum(['hoy', 'semana', 'mes']).default('hoy'),
  canal: z.enum(['todos', 'PRESENCIAL', 'WHATSAPP', 'PORTAL_WEB', 'CALL_CENTER']).default('todos'),
  q: z.string().trim().optional().default('')
});

export type FiltroIndicadoresDto = z.infer<typeof filtroIndicadoresDtoSchema>;
