import { NextFunction, Request, Response } from 'express';
import { TicketService } from './ticket.service';

export class TicketController {
  constructor(private readonly service = new TicketService()) {}

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listar({
        canal: req.query.canal ? String(req.query.canal) : undefined,
        prioridad: req.query.prioridad ? String(req.query.prioridad) : undefined,
        estado: req.query.estado ? String(req.query.estado) : undefined,
        q: req.query.q ? String(req.query.q) : undefined
      });
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  detalle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.obtenerDetalle(id);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.crear(req.body, req.user!.id, req.user!.nombre_completo);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  agregarMensaje = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.agregarMensaje(id, req.user!.nombre_completo, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  resolver = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.resolver(id, req.user!.id, req.user!.nombre_completo, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  toggleConflicto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.toggleConflicto(id);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };
}
