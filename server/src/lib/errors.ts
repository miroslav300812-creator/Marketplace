import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}
export const badRequest = (msg: string, code = 'bad_request') => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Требуется авторизация') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Недостаточно прав') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Не найдено') => new HttpError(404, msg, 'not_found');
export const tooMany = (msg: string) => new HttpError(429, msg, 'rate_limited');

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const ah = <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: T, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation', message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal', message: 'Внутренняя ошибка сервера' });
}
