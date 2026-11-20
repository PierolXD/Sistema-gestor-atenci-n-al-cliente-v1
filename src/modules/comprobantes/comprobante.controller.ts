import { NextFunction, Request, Response } from 'express';
import { ComprobanteService } from './comprobante.service';

export class ComprobanteController {
  constructor(private readonly service = new ComprobanteService()) {}

  consultar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = String(req.query.q ?? '');
      const data = await this.service.consultar(q);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  registrarPago = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.registrarPago(req.body, req.user!.id);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  crearConvenio = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.crearConvenio(req.body, req.user!.id);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  emitirRecibo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.emitirRecibo(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };
}
