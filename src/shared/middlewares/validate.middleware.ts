import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/app-error';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message
      }));
      next(new AppError(400, 'Datos de entrada inválidos.', issues));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
