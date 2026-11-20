import { NextFunction, Request, Response } from 'express';
import { IndicadorService } from './indicador.service';

export class IndicadorController {
  constructor(private readonly service = new IndicadorService()) {}

  resumen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.obtenerResumen(req.query as Record<string, unknown>);
      res.status(200).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  };

  exportarCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csv = await this.service.generarCsv(req.query as Record<string, unknown>);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte_indicadores_sacs.csv"');
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  };
}
