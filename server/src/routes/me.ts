import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireCustomer, type AuthedRequest } from '../lib/auth.js';
import { ah, notFound } from '../lib/errors.js';
import { userDto } from '../lib/serialize.js';

export const me = Router();
me.use('/me', requireCustomer);

async function load(id: number) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw notFound('Пользователь не найден');
  const history = await prisma.bonusTx.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
  return userDto(u, history);
}

me.get('/me', ah(async (req: AuthedRequest, res) => { res.json(await load(req.auth!.sub)); }));

me.patch('/me', ah(async (req: AuthedRequest, res) => {
  const body = z.object({
    name: z.string().trim().max(80).optional(),
    email: z.union([z.string().trim().email().max(120), z.literal('')]).optional(),
    prefs: z.record(z.string(), z.unknown()).optional()
  }).parse(req.body);
  const prefs = body.prefs ? JSON.stringify(body.prefs).slice(0, 5000) : undefined;
  await prisma.user.update({ where: { id: req.auth!.sub }, data: { name: body.name, email: body.email, prefs } });
  res.json(await load(req.auth!.sub));
}));

/** One-time code the cashier can type in instead of scanning the card. */
me.post('/me/loyalty/otp', ah(async (_req, res) => {
  res.json({ otp: String(crypto.randomInt(0, 1e6)).padStart(6, '0'), ttl: 60 });
}));
