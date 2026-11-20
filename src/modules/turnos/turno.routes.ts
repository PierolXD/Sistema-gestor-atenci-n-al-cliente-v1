import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateBody } from '../../shared/middlewares/validate.middleware';
import { TurnoController } from './turno.controller';
import {
  agregarNotaTurnoDtoSchema,
  derivarTurnoDtoSchema,
  emitirTurnoDtoSchema,
  finalizarTurnoDtoSchema
} from './turno.dto';

const controller = new TurnoController();
export const turnosRouter = Router();

turnosRouter.use(requireAuth);
turnosRouter.get('/', controller.obtenerTablero);
turnosRouter.post('/', validateBody(emitirTurnoDtoSchema), controller.emitir);
turnosRouter.post('/llamar-siguiente', controller.llamarSiguiente);
turnosRouter.patch('/:id/atender', controller.atenderEspecifico);
turnosRouter.patch('/:id/derivar', validateBody(derivarTurnoDtoSchema), controller.derivar);
turnosRouter.patch('/:id/ausente', controller.ausente);
turnosRouter.post('/:id/notas', validateBody(agregarNotaTurnoDtoSchema), controller.agregarNota);
turnosRouter.patch('/:id/finalizar', validateBody(finalizarTurnoDtoSchema), controller.finalizar);
