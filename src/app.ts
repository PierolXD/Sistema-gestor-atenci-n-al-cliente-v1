import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { query } from './shared/database/connection';
import { initializeDatabase } from './shared/database/init';
import { errorMiddleware } from './shared/middlewares/error.middleware';
import { authRouter, usuariosRouter } from './modules/usuarios/usuario.routes';
import { turnosRouter } from './modules/turnos/turno.routes';
import { clientesRouter } from './modules/clientes/cliente.routes';
import { ticketsRouter } from './modules/tickets/ticket.routes';
import { comprobantesRouter } from './modules/comprobantes/comprobante.routes';
import { otsRouter } from './modules/ordenes-trabajo/ot.routes';
import { indicadoresRouter } from './modules/indicadores/indicador.routes';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

app.get('/api/health', async (_req: Request, res: Response, next) => {
  try {
    await query('SELECT 1');
    res.status(200).json({
      ok: true,
      service: 'SACS - Sistema de Atención al Cliente SEAL',
      architecture: 'N-Tier + Repository Pattern + Package by Feature',
      db: 'postgresql',
      database: process.env.DB_NAME || 'sacs_atencion',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// Rutas de Módulos (Package by Feature)
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/turnos', turnosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/comprobantes', comprobantesRouter);
app.use('/api/ordenes-trabajo', otsRouter);
app.use('/api/indicadores', indicadoresRouter);

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: 'Endpoint de API no encontrado.' });
});

app.get(/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorMiddleware);

async function startServer(): Promise<void> {
  const port = Number(process.env.PORT || 3000);
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`[SACS] Servidor operativo ejecutándose en http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[SACS] Error fatal al iniciar el servidor:', err);
    process.exit(1);
  });
}
