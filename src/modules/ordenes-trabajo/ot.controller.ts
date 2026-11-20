import { NextFunction, Request, Response } from 'express';
import { OtService } from './ot.service';

export class OtController {
  constructor(private readonly service = new OtService()) {}

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listar({
        tipo: req.query.tipo ? String(req.query.tipo) : undefined,
        etapa: req.query.etapa ? String(req.query.etapa) : undefined,
        q: req.query.q ? String(req.query.q) : undefined
      });
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  listarCuadrillas = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listarCuadrillas();
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

  reasignar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.reasignar(id, req.body, req.user!.nombre_completo);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  agregarEvento = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.agregarEvento(id, req.body, req.user!.nombre_completo);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  avanzarEtapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.avanzarEtapa(id, req.body, req.user!.nombre_completo);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };
}
