import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { validateBody } from '../../shared/middlewares/validate.middleware';
import { UsuarioController } from './usuario.controller';
import { cambiarEstadoVentanillaDtoSchema, loginDtoSchema } from './usuario.dto';

const controller = new UsuarioController();

export const authRouter = Router();
authRouter.post('/login', validateBody(loginDtoSchema), controller.login);
authRouter.get('/me', requireAuth, controller.me);

export const usuariosRouter = Router();
usuariosRouter.get('/sucursales', controller.listarSucursales);
usuariosRouter.get('/ventanillas', requireAuth, controller.listarVentanillas);
usuariosRouter.patch(
  '/ventanillas/:id/estado',
  requireAuth,
  validateBody(cambiarEstadoVentanillaDtoSchema),
  controller.cambiarEstadoVentanilla
);
usuariosRouter.get('/', requireAuth, controller.listarUsuarios);
