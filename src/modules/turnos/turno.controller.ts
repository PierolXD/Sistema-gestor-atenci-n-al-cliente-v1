import { NextFunction, Request, Response } from 'express';
import { TurnoService } from './turno.service';

export class TurnoController {
  constructor(private readonly service = new TurnoService()) {}

  obtenerTablero = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : req.user!.sucursal_id ?? 1;
      const modulo = req.query.modulo ? String(req.query.modulo) : undefined;
      const data = await this.service.obtenerTablero(sucursalId, req.user!.id, modulo);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  emitir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sucursalId = req.user!.sucursal_id ?? 1;
      const data = await this.service.emitirTurno(sucursalId, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  llamarSiguiente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sucursalId = req.user!.sucursal_id ?? 1;
      const data = await this.service.llamarSiguiente(sucursalId, req.user!.id);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  atenderEspecifico = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const turnoId = Number(req.params.id);
      const sucursalId = req.user!.sucursal_id ?? 1;
      const data = await this.service.atenderTurnoEspecifico(turnoId, sucursalId, req.user!.id);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  derivar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const turnoId = Number(req.params.id);
      const data = await this.service.derivarTurno(turnoId, req.user!.nombre_completo, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  ausente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const turnoId = Number(req.params.id);
      const data = await this.service.marcarAusente(turnoId);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  agregarNota = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const turnoId = Number(req.params.id);
      const data = await this.service.agregarNota(turnoId, req.user!.nombre_completo, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  finalizar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const turnoId = Number(req.params.id);
      const data = await this.service.finalizarTurno(turnoId, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };
}
