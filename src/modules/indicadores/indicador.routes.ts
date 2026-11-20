import { Router } from 'express';
import { requireAuth } from '../../shared/middlewares/auth.middleware';
import { IndicadorController } from './indicador.controller';

const controller = new IndicadorController();
export const indicadoresRouter = Router();

indicadoresRouter.use(requireAuth);
indicadoresRouter.get('/resumen', controller.resumen);
indicadoresRouter.get('/exportar', controller.exportarCsv);
