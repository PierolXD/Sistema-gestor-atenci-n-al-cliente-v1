import { z } from 'zod';

export const crearTicketDtoSchema = z.object({
  nis_o_dni: z.string().trim().min(3, 'Ingrese el NIS o DNI/RUC del cliente.'),
  turno_id: z.coerce.number().int().positive().optional().nullable(),
  canal: z.enum(['PRESENCIAL', 'WHATSAPP', 'PORTAL_WEB', 'CALL_CENTER']).default('PRESENCIAL'),
  prioridad: z.enum(['URGENTE', 'ALTA', 'NORMAL']).default('NORMAL'),
  asunto: z.string().trim().min(4, 'Ingrese un asunto breve del caso.'),
  descripcion: z.string().trim().min(6, 'Describa el detalle reportado por el cliente.'),
  tipificacion_normativa: z.string().trim().optional().nullable(),
  es_reclamo_formal: z.boolean().optional().default(false)
});

export type CrearTicketDto = z.infer<typeof crearTicketDtoSchema>;

export const agregarMensajeTicketDtoSchema = z.object({
  autor_tipo: z.enum(['BOT', 'CLIENTE', 'SCADA', 'AGENTE', 'SISTEMA']).default('AGENTE'),
  mensaje: z.string().trim().min(2, 'Ingrese el contenido del mensaje o nota.'),
  evidencia_url: z.string().trim().optional().nullable()
});

export type AgregarMensajeTicketDto = z.infer<typeof agregarMensajeTicketDtoSchema>;

export const resolverTicketDtoSchema = z.object({
  tipificacion_normativa: z.string().trim().min(2, 'Seleccione la tipificación normativa Osinergmin.'),
  accion_inmediata: z.enum([
    'DESPACHAR_CUADRILLA',
    'ESCALAR_RECLAMO',
    'ATENCION_INFORMATIVA',
    'DERIVAR_LABORATORIO'
  ]),
  cuadrilla_id: z.union([z.coerce.number().int().positive(), z.string().trim()]).optional().nullable(),
  dictamen_tecnico: z.string().trim().min(3, 'Ingrese el dictamen o nota técnica.'),
  cerrar: z.boolean().default(true)
});

export type ResolverTicketDto = z.infer<typeof resolverTicketDtoSchema>;
