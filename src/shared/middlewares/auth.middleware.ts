import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/app-error';

export type RolUsuario = 'ADMIN' | 'SUPERVISOR' | 'OPERADOR';

export interface AuthUserPayload {
  id: number;
  codigo_empleado: string;
  nombre_completo: string;
  iniciales: string;
  rol: RolUsuario;
  sucursal_id: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'sacs_seal_jwt_secret_2026_produccion_segura';
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'Acceso no autorizado. Debe iniciar sesión con un token válido.'));
    return;
  }

  const token = header.slice(7).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, 'Sesión expirada o token inválido. Inicie sesión nuevamente.'));
  }
}

export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Usuario no autenticado.'));
      return;
    }
    if (!roles.includes(req.user.rol)) {
      next(new AppError(403, 'No cuenta con permisos suficientes para ejecutar esta operación.'));
      return;
    }
    next();
  };
}
