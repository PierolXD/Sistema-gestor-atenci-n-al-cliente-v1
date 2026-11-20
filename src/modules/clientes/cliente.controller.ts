import { NextFunction, Request, Response } from 'express';
import { ClienteService } from './cliente.service';

export class ClienteController {
  constructor(private readonly service = new ClienteService()) {}

  buscar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = String(req.query.q ?? '');
      const data = await this.service.buscar(q);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  listarMaestro = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = String(req.query.q ?? '');
      const rawEstado = String(req.query.estado ?? 'todos');
      const estado = ['todos', 'activos', 'inactivos'].includes(rawEstado)
        ? (rawEstado as 'todos' | 'activos' | 'inactivos')
        : 'todos';
      const data = await this.service.listarTablaMaestra(q, estado);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  exportarMaestroCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = String(req.query.q ?? '');
      const rawEstado = String(req.query.estado ?? 'todos');
      const estado = ['todos', 'activos', 'inactivos'].includes(rawEstado)
        ? (rawEstado as 'todos' | 'activos' | 'inactivos')
        : 'todos';
      const csv = await this.service.exportarMaestroCsv(q, estado);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="maestro_clientes_seal.csv"');
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  };

  cambiarEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.cambiarEstado(id, req.body.activo);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  eliminar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.eliminarCliente(id);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  ficha360 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const suministroId = req.query.suministroId ? Number(req.query.suministroId) : undefined;
      const data = await this.service.obtenerFicha360PorCliente(id, suministroId);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  ficha360PorNis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.obtenerFicha360PorNis(String(req.params.nis));
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.crearClienteYSuministro(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  actualizar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const data = await this.service.actualizarCliente(id, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  actualizarSuministro = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suministroId = Number(req.params.suministroId);
      const data = await this.service.actualizarSuministro(suministroId, req.body);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  pingTelemedidor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suministroId = Number(req.params.suministroId);
      const data = await this.service.pingTelemedidor(suministroId);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  programarInspeccion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suministroId = Number(req.params.suministroId);
      const data = await this.service.programarInspeccion(suministroId, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  agregarAutorizado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clienteId = Number(req.params.id);
      const data = await this.service.agregarAutorizado(clienteId, req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };
}
