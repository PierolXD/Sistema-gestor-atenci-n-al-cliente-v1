import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      details: err.details ?? null
    });
    return;
  }

  const pgErr = err as PgError;
  if (pgErr.code === '23505') {
    res.status(409).json({
      ok: false,
      error: 'Ya existe un registro con ese identificador único (DNI, NIS, Medidor o Código).',
      details: pgErr.detail ?? pgErr.constraint ?? null
    });
    return;
  }

  if (pgErr.code === '23503') {
    res.status(400).json({
      ok: false,
      error: 'Referencia inválida: el registro relacionado no existe.',
      details: pgErr.detail ?? null
    });
    return;
  }

  if (pgErr.code === '22P02' || pgErr.code === '23514') {
    res.status(400).json({
      ok: false,
      error: 'Formato de datos o restricción de dominio inválida.',
      details: pgErr.detail ?? pgErr.message
    });
    return;
  }

  console.error('[ERROR NO CONTROLADO]', err);
  res.status(500).json({
    ok: false,
    error: 'Error interno del servidor al procesar la solicitud.',
    details: process.env.NODE_ENV === 'development' ? err.message : null
  });
}
