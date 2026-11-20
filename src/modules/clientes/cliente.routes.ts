import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateBody } from '../../shared/middlewares/validate.middleware';
import { ClienteController } from './cliente.controller';
import {
  actualizarClienteDtoSchema,
  actualizarSuministroDtoSchema,
  cambiarEstadoClienteDtoSchema,
  crearAutorizadoDtoSchema,
  crearClienteSuministroDtoSchema,
  crearInspeccionDtoSchema
} from './cliente.dto';

const controller = new ClienteController();
export const clientesRouter = Router();

clientesRouter.use(requireAuth);
clientesRouter.get('/', controller.buscar);
clientesRouter.get('/maestro', controller.listarMaestro);
clientesRouter.get('/maestro/exportar', controller.exportarMaestroCsv);
clientesRouter.get('/nis/:nis/ficha-360', controller.ficha360PorNis);
clientesRouter.get('/:id/ficha-360', controller.ficha360);
clientesRouter.post('/', validateBody(crearClienteSuministroDtoSchema), controller.crear);
clientesRouter.put('/:id', validateBody(actualizarClienteDtoSchema), controller.actualizar);
clientesRouter.patch('/:id/estado', validateBody(cambiarEstadoClienteDtoSchema), controller.cambiarEstado);
clientesRouter.delete('/:id', controller.eliminar);
clientesRouter.patch(
  '/suministros/:suministroId',
  validateBody(actualizarSuministroDtoSchema),
  controller.actualizarSuministro
);
clientesRouter.post('/suministros/:suministroId/ping', controller.pingTelemedidor);
clientesRouter.post(
  '/suministros/:suministroId/inspecciones',
  validateBody(crearInspeccionDtoSchema),
  controller.programarInspeccion
);
clientesRouter.post('/:id/autorizados', validateBody(crearAutorizadoDtoSchema), controller.agregarAutorizado);
