import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateBody } from '../../shared/middlewares/validate.middleware';
import { TicketController } from './ticket.controller';
import {
  agregarMensajeTicketDtoSchema,
  crearTicketDtoSchema,
  resolverTicketDtoSchema
} from './ticket.dto';

const controller = new TicketController();
export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);
ticketsRouter.get('/', controller.listar);
ticketsRouter.get('/:id', controller.detalle);
ticketsRouter.post('/', validateBody(crearTicketDtoSchema), controller.crear);
ticketsRouter.post('/:id/mensajes', validateBody(agregarMensajeTicketDtoSchema), controller.agregarMensaje);
ticketsRouter.patch('/:id/resolver', validateBody(resolverTicketDtoSchema), controller.resolver);
ticketsRouter.patch('/:id/conflicto', controller.toggleConflicto);
