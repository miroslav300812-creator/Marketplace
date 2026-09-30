import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { SUCCESS_STATUSES, liqpayEnabled, verifyCallback } from '../integrations/liqpay.js';
import { requireCustomer, type AuthedRequest } from '../lib/auth.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { markPaid, orderInclude } from '../lib/orders.js';
import { orderDto } from '../lib/serialize.js';

export const payments = Router();

/** LiqPay server-to-server notification (form-encoded `data` + `signature`). */
payments.post('/payments/liqpay/callback', ah(async (req, res) => {
  const { data, signature } = z.object({ data: z.string(), signature: z.string() }).parse(req.body);
  const cb = verifyCallback(data, signature);
  if (!cb) { res.status(400).send('bad signature'); return; }
  const order = await prisma.order.findUnique({ where: { id: cb.order_id } });
  if (!order) { res.status(404).send('unknown order'); return; }
  if (SUCCESS_STATUSES.has(cb.status)) {
    if (Math.round(cb.amount) !== order.total) { console.warn(`[liqpay] amount mismatch for ${order.id}`); res.status(400).send('amount mismatch'); return; }
    await markPaid(order.id, { tx: String(cb.transaction_id ?? ''), mask: cb.sender_card_mask2 ?? cb.paytype ?? null });
  } else if (['failure', 'error', 'reversed'].includes(cb.status)) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } });
  }
  res.send('ok');
}));

/* ------------------------------------------------------------------
   Sandbox payment emulator — used when LiqPay keys are not configured.
   Test cards: 4242… success · 4000 0000 0000 3220 → 3-D Secure · …0002 declined · …9995 no funds.
   ------------------------------------------------------------------ */
const pending3ds = new Map<string, { orderId: string; otp: string; mask: string; expires: number }>();

const luhn = (num: string) => {
  let s = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) { let n = +num[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; }
  return num.length === 16 && s % 10 === 0;
};

payments.use('/payments/mock', (_req, _res, next) => next(liqpayEnabled ? notFound('Mock payments are disabled when LiqPay keys are set') : undefined));

async function ownPendingOrder(req: AuthedRequest, orderId: string) {
  const o = await prisma.order.findFirst({ where: { id: orderId, userId: req.auth!.sub } });
  if (!o) throw notFound('Заказ не найден');
  if (o.paymentStatus === 'paid') throw badRequest('Заказ уже оплачен', 'already_paid');
  if (o.status === 'cancelled') throw badRequest('Заказ отменён', 'cancelled');
  if (o.paymentMethod === 'cash') throw badRequest('Заказ оплачивается при получении');
  return o;
}
const done = async (orderId: string, mask: string) => {
  await markPaid(orderId, { tx: 'SBX' + crypto.randomInt(1e8, 1e9), mask });
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  return { status: 'success' as const, order: orderDto(o) };
};

payments.post('/payments/mock/charge', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const body = z.object({
    orderId: z.string(),
    method: z.enum(['card', 'apple', 'google']),
    card: z.object({ number: z.string(), exp: z.string(), cvv: z.string() }).optional()
  }).parse(req.body);
  const order = await ownPendingOrder(req, body.orderId);
  if (body.method !== 'card') { res.json(await done(order.id, body.method === 'apple' ? 'Apple Pay' : 'Google Pay')); return; }

  const num = (body.card?.number ?? '').replace(/\D/g, '');
  const m = /^(\d{2})\/(\d{2})$/.exec(body.card?.exp ?? '');
  if (!luhn(num)) throw badRequest('Неверный номер карты', 'card_number');
  if (!m || +m[1] < 1 || +m[1] > 12 || new Date(2000 + +m[2], +m[1], 1) < new Date()) throw badRequest('Неверный срок действия', 'card_exp');
  if (!/^\d{3}$/.test(body.card?.cvv ?? '')) throw badRequest('Неверный CVV', 'card_cvv');
  const mask = num.slice(0, 6) + '******' + num.slice(-4);

  if (num.endsWith('0002') || num.endsWith('9995')) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } });
    res.json({ status: 'failure', message: num.endsWith('0002') ? 'Карта отклонена банком-эмитентом' : 'Недостаточно средств на карте' });
    return;
  }
  if (num === '4000000000003220') {
    const txId = crypto.randomUUID();
    const otp = String(crypto.randomInt(100000, 1000000));
    pending3ds.set(txId, { orderId: order.id, otp, mask, expires: Date.now() + 5 * 60_000 });
    res.json({ status: '3ds_verify', txId, devOtp: otp });
    return;
  }
  res.json(await done(order.id, mask));
}));

payments.post('/payments/mock/3ds', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const { txId, otp } = z.object({ txId: z.string(), otp: z.string() }).parse(req.body);
  const p = pending3ds.get(txId);
  if (!p || p.expires < Date.now()) throw badRequest('Сессия 3-D Secure истекла', '3ds_expired');
  await ownPendingOrder(req, p.orderId);
  if (p.otp !== otp.trim()) throw badRequest('Неверный код 3-D Secure', '3ds_code');
  pending3ds.delete(txId);
  res.json(await done(p.orderId, p.mask));
}));
