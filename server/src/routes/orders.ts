import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { buildCheckout, liqpayEnabled } from '../integrations/liqpay.js';
import { optionalAuth, requireCustomer, userId, type AuthedRequest } from '../lib/auth.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { newOrderId, orderInclude, releaseOrder } from '../lib/orders.js';
import { formatPhone } from '../lib/phone.js';
import { computeQuote, quoteSchema } from '../lib/pricing.js';
import { orderDto } from '../lib/serialize.js';

export const orders = Router();

orders.post('/checkout/quote', optionalAuth, ah(async (req: AuthedRequest, res) => {
  const input = quoteSchema.parse(req.body);
  const id = userId(req);
  const user = id ? await prisma.user.findUnique({ where: { id } }) : null;
  res.json(await computeQuote(input, user));
}));

const createSchema = quoteSchema.extend({
  delivery: quoteSchema.shape.delivery.unwrap().unwrap(),
  payMethod: z.enum(['card', 'apple', 'google', 'cash']),
  customer: z.object({ name: z.string().trim().min(2).max(80), email: z.union([z.string().trim().email().max(120), z.literal('')]).default('') })
});

function paymentFor(order: { id: string; total: number; paymentMethod: string }) {
  if (order.paymentMethod === 'cash') return null;
  if (!liqpayEnabled) return { provider: 'mock' as const };
  const paytypes = order.paymentMethod === 'apple' ? 'apay' : order.paymentMethod === 'google' ? 'gpay' : 'card';
  return { provider: 'liqpay' as const, ...buildCheckout({ orderId: order.id, amount: order.total, description: `NEON MARKET · заказ ${order.id}`, paytypes }) };
}

orders.post('/orders', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const input = createSchema.parse(req.body);
  const uid = req.auth!.sub;

  // Price everything first (may call Nova Poshta); the transaction below only re-checks
  // stock and bonus balance with guarded updates, so it stays short.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const q = await computeQuote(input, user);
  if (input.promoCode && q.promoError) throw badRequest(q.promoError, 'bad_promo');
  const d = q.delivery!;
  const id = newOrderId();
  const online = input.payMethod !== 'cash';

  const order = await prisma.$transaction(async tx => {

    // Reserve stock atomically; a concurrent order that drained it makes this fail.
    for (const l of q.lines) {
      const r = await tx.product.updateMany({ where: { id: l.productId, stock: { gte: l.qty } }, data: { stock: { decrement: l.qty } } });
      if (r.count !== 1) throw badRequest(`«${l.name}» закончился`, 'out_of_stock');
    }
    if (q.bonusApplied) {
      const r = await tx.user.updateMany({ where: { id: uid, bonusBalance: { gte: q.bonusApplied } }, data: { bonusBalance: { decrement: q.bonusApplied } } });
      if (r.count !== 1) throw badRequest('Недостаточно бонусов', 'bonus');
      await tx.bonusTx.create({ data: { userId: uid, delta: -q.bonusApplied, reason: `Списание · заказ ${id}`, orderId: id } });
    }
    await tx.user.update({ where: { id: uid }, data: { name: input.customer.name, ...(input.customer.email ? { email: input.customer.email } : {}) } });

    const status = online ? 'awaiting_payment' : 'new';
    return tx.order.create({
      data: {
        id, userId: uid, status, paymentStatus: online ? 'pending' : 'cod', paymentMethod: input.payMethod,
        customerName: input.customer.name, customerPhone: formatPhone(user.phone), customerEmail: input.customer.email,
        subtotal: q.subtotal, bundleDiscount: q.bundleDiscount, promoCode: q.promo?.code ?? null, promoDiscount: q.promoDiscount,
        bonusSpent: q.bonusApplied, bonusEarned: q.bonusEarn,
        deliveryType: d.type, deliveryCost: d.cost, deliveryLabel: d.label, deliveryEta: d.eta, deliveryData: JSON.stringify(input.delivery),
        total: q.total,
        items: { create: q.lines.map(l => ({ productId: l.productId, name: l.name, emoji: l.emoji, price: l.price, qty: l.qty, bundle: l.bundle })) },
        history: { create: [{ status }] }
      },
      include: orderInclude
    });
  });
  res.status(201).json({ order: orderDto(order), payment: paymentFor(order) });
}));

orders.get('/orders', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const list = await prisma.order.findMany({ where: { userId: req.auth!.sub }, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(list.map(orderDto));
}));

orders.get('/orders/:id', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const o = await prisma.order.findFirst({ where: { id: String(req.params.id), userId: req.auth!.sub }, include: orderInclude });
  if (!o) throw notFound('Заказ не найден');
  res.json({ order: orderDto(o), payment: o.paymentStatus === 'pending' ? paymentFor(o) : null });
}));

orders.post('/orders/:id/cancel', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const o = await prisma.order.findFirst({ where: { id: String(req.params.id), userId: req.auth!.sub } });
  if (!o) throw notFound('Заказ не найден');
  if (!['awaiting_payment', 'new'].includes(o.status)) throw badRequest('Этот заказ уже нельзя отменить');
  await prisma.$transaction(async tx => {
    await releaseOrder(tx, o.id);
    await tx.order.update({ where: { id: o.id }, data: { status: 'cancelled' } });
    await tx.orderStatusHistory.create({ data: { orderId: o.id, status: 'cancelled' } });
  });
  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: orderInclude });
  res.json(orderDto(fresh));
}));
