import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateBody } from '../../shared/middlewares/validate.middleware';
import { OtController } from './ot.controller';
import {
  agregarEventoOtDtoSchema,
  avanzarEtapaOtDtoSchema,
  crearOtDtoSchema,
  reasignarOtDtoSchema
} from './ot.dto';

const controller = new OtController();
export const otsRouter = Router();

otsRouter.use(requireAuth);
otsRouter.get('/cuadrillas', controller.listarCuadrillas);
otsRouter.get('/', controller.listar);
otsRouter.get('/:id', controller.detalle);
otsRouter.post('/', validateBody(crearOtDtoSchema), controller.crear);
otsRouter.patch('/:id/reasignar', validateBody(reasignarOtDtoSchema), controller.reasignar);
otsRouter.post('/:id/eventos', validateBody(agregarEventoOtDtoSchema), controller.agregarEvento);
otsRouter.patch('/:id/etapa', validateBody(avanzarEtapaOtDtoSchema), controller.avanzarEtapa);
