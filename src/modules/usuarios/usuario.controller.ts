import { NextFunction, Request, Response } from 'express';
import { UsuarioService } from './usuario.service';

export class UsuarioController {
  constructor(private readonly service = new UsuarioService()) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.login(req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getPerfilActual(req.user!.id, req.user!.sucursal_id);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  listarSucursales = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listarSucursales();
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  listarUsuarios = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listarUsuarios();
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  listarVentanillas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : undefined;
      const data = await this.service.listarVentanillas(sucursalId);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  cambiarEstadoVentanilla = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.cambiarEstadoVentanilla(id, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };
}
