import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateBody } from '../../shared/middlewares/validate.middleware';
import { ComprobanteController } from './comprobante.controller';
import { crearConvenioDtoSchema, emitirReciboDtoSchema, registrarPagoDtoSchema } from './comprobante.dto';

const controller = new ComprobanteController();
export const comprobantesRouter = Router();

comprobantesRouter.use(requireAuth);
comprobantesRouter.get('/consulta', controller.consultar);
comprobantesRouter.post('/recibos', validateBody(emitirReciboDtoSchema), controller.emitirRecibo);
comprobantesRouter.post('/pagos', validateBody(registrarPagoDtoSchema), controller.registrarPago);
comprobantesRouter.post('/convenios', validateBody(crearConvenioDtoSchema), controller.crearConvenio);
