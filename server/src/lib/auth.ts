import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { forbidden, unauthorized } from './errors.js';

export type TokenPayload = { sub: number; role: 'customer' } | { sub: 0; role: 'admin' };
export type AuthedRequest = Request & { auth?: TokenPayload };

export const signCustomer = (userId: number) => jwt.sign({ sub: userId, role: 'customer' }, env.JWT_SECRET, { expiresIn: '30d' });
export const signAdmin = () => jwt.sign({ sub: 0, role: 'admin' }, env.JWT_SECRET, { expiresIn: '12h' });

function read(req: Request): TokenPayload | undefined {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return undefined;
  try { return jwt.verify(h.slice(7), env.JWT_SECRET) as unknown as TokenPayload; } catch { return undefined; }
}

/** Attaches auth info if a valid token is present; never rejects. */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.auth = read(req);
  next();
}
export function requireCustomer(req: AuthedRequest, _res: Response, next: NextFunction) {
  const a = read(req);
  if (!a || a.role !== 'customer') return next(unauthorized('Подтвердите номер телефона'));
  req.auth = a; next();
}
export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) {
  const a = read(req);
  if (!a) return next(unauthorized());
  if (a.role !== 'admin') return next(forbidden());
  req.auth = a; next();
}
export const userId = (req: AuthedRequest) => (req.auth?.role === 'customer' ? req.auth.sub : null);
