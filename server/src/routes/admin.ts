import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { requireAdmin, signAdmin } from '../lib/auth.js';
import { productBarcode } from '../lib/barcode.js';
import { ah, badRequest, notFound, unauthorized } from '../lib/errors.js';
import { ORDER_STATUSES, creditCashback, orderInclude, releaseOrder } from '../lib/orders.js';
import { orderDto, productDto, reviewDto } from '../lib/serialize.js';
import { ratings } from './catalog.js';

export const admin = Router();

admin.post('/admin/login', ah(async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  const a = crypto.createHash('sha256').update(password).digest(), b = crypto.createHash('sha256').update(env.ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) throw unauthorized('Неверный пароль');
  res.json({ token: signAdmin() });
}));

admin.use('/admin', requireAdmin);

/* ---------------- dashboard ---------------- */
admin.get('/admin/stats', ah(async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = await prisma.order.findMany({ where: { createdAt: { gte: start }, status: { notIn: ['cancelled', 'awaiting_payment'] } }, include: { items: true } });
  const revenue = today.reduce((s, o) => s + o.total, 0);
  const hourly = Array.from({ length: 24 }, (_, h) => ({ h, rev: 0, n: 0 }));
  const agg = new Map<number, { productId: number; name: string; emoji: string; qty: number; rev: number }>();
  for (const o of today) {
    const h = o.createdAt.getHours(); hourly[h].rev += o.total; hourly[h].n++;
    for (const i of o.items) {
      if (!i.productId) continue;
      const a = agg.get(i.productId) ?? { productId: i.productId, name: i.name, emoji: i.emoji, qty: 0, rev: 0 };
      a.qty += i.qty; a.rev += i.qty * i.price; agg.set(i.productId, a);
    }
  }
  const byStatus = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  const [lowStock, pendingReviews] = await Promise.all([
    prisma.product.findMany({ where: { active: true, stock: { lte: 5 } }, orderBy: { stock: 'asc' } }),
    prisma.review.count({ where: { status: 'pending' } })
  ]);
  res.json({
    count: today.length, revenue, avg: today.length ? Math.round(revenue / today.length) : 0,
    bonusSpent: today.reduce((s, o) => s + o.bonusSpent, 0), bonusEarned: today.reduce((s, o) => s + o.bonusEarned, 0),
    hourly, top: [...agg.values()].sort((a, b) => b.rev - a.rev).slice(0, 5),
    byStatus: ORDER_STATUSES.map(s => ({ status: s, n: byStatus.find(b => b.status === s)?._count._all ?? 0 })),
    lowStock: lowStock.map(p => productDto(p)), pendingReviews
  });
}));

/* ---------------- products ---------------- */
const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  cat: z.string().min(1),
  price: z.number().int().positive(),
  old: z.number().int().positive().nullable().default(null),
  unit: z.string().trim().max(40).default('1 шт'),
  emoji: z.string().max(8).default('🛒'),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  country: z.string().trim().max(60).default('Украина'),
  kcal: z.number().int().min(0).max(2000).default(0),
  stock: z.number().int().min(0).max(100000).default(0),
  badge: z.enum(['', 'Хит', 'Sale', 'New']).default(''),
  weight: z.number().min(0).max(100).default(0.3),
  desc: z.string().max(2000).default('')
});
const toData = (p: Partial<z.infer<typeof productSchema>>) => {
  if (p.old != null && p.price != null && p.old <= p.price) throw badRequest('Старая цена должна быть больше новой');
  const tags = p.tags ? [...new Set(p.old ? [...p.tags, 'акция'] : p.tags.filter(t => t !== 'акция'))] : undefined;
  return {
    name: p.name, categoryId: p.cat, price: p.price, oldPrice: p.old, unit: p.unit, emoji: p.emoji,
    tags: tags ? JSON.stringify(tags) : undefined, country: p.country, kcal: p.kcal, stock: p.stock, badge: p.badge,
    weight: p.weight, description: p.desc
  };
};

admin.get('/admin/products', ah(async (_req, res) => {
  const [list, rt] = await Promise.all([prisma.product.findMany({ where: { active: true }, orderBy: { id: 'desc' } }), ratings()]);
  res.json(list.map(p => productDto(p, rt.get(p.id))));
}));
admin.post('/admin/products', ah(async (req, res) => {
  const body = productSchema.parse(req.body);
  const created = await prisma.$transaction(async tx => {
    const p = await tx.product.create({ data: { ...toData(body), barcode: 'tmp-' + crypto.randomUUID() } as never });
    return tx.product.update({ where: { id: p.id }, data: { barcode: productBarcode(p.id) } });
  });
  res.status(201).json(productDto(created));
}));
admin.patch('/admin/products/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await prisma.product.findUnique({ where: { id } });
  if (!cur) throw notFound();
  const body = productSchema.partial().parse(req.body);
  const price = body.price ?? cur.price;
  const old = req.body?.old !== undefined ? body.old ?? null : cur.oldPrice;
  const tags = body.tags ?? JSON.parse(cur.tags) as string[];
  const p = await prisma.product.update({ where: { id }, data: toData({ ...body, price, old, tags }) });
  res.json(productDto(p));
}));
admin.delete('/admin/products/:id', ah(async (req, res) => {
  // Soft delete keeps order history and reviews intact.
  await prisma.product.update({ where: { id: Number(req.params.id) }, data: { active: false } });
  res.json({ ok: true });
}));

/* ---------------- orders ---------------- */
async function findOrders(q: { status?: string; q?: string }) {
  const where = {
    ...(q.status && q.status !== 'all' ? { status: q.status } : {}),
    ...(q.q ? { OR: [{ id: { contains: q.q } }, { customerName: { contains: q.q } }, { customerPhone: { contains: q.q } }] } : {})
  };
  const list = await prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 200 });
  return list.map(orderDto);
}
const listQuery = z.object({ status: z.string().optional(), q: z.string().max(60).optional() });

admin.get('/admin/orders', ah(async (req, res) => { res.json(await findOrders(listQuery.parse(req.query))); }));
admin.get('/admin/orders/export', ah(async (req, res) => {
  const data = await findOrders(listQuery.parse(req.query));
  res.setHeader('Content-Disposition', `attachment; filename="neon-orders-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
}));
admin.patch('/admin/orders/:id', ah(async (req, res) => {
  const { status } = z.object({ status: z.enum(ORDER_STATUSES) }).parse(req.body);
  const id = String(req.params.id);
  const o = await prisma.order.findUnique({ where: { id } });
  if (!o) throw notFound('Заказ не найден');
  if (o.status === 'cancelled') throw badRequest('Отменённый заказ нельзя изменить');
  if (o.status === status) { res.json(orderDto(await prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude }))); return; }
  if (status === 'awaiting_payment') throw badRequest('Этот статус выставляется автоматически');
  await prisma.$transaction(async tx => {
    if (status === 'cancelled') await releaseOrder(tx, id);
    await tx.order.update({ where: { id }, data: { status, ...(status === 'done' && o.paymentStatus === 'cod' ? { paymentStatus: 'paid' } : {}) } });
    if (status === 'done') await creditCashback(tx, id); // cash-on-delivery cashback lands on delivery
    await tx.orderStatusHistory.create({ data: { orderId: id, status } });
  });
  res.json(orderDto(await prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude })));
}));

/* ---------------- reviews ---------------- */
admin.get('/admin/reviews', ah(async (req, res) => {
  const status = z.enum(['pending', 'approved', 'all']).default('all').parse(req.query.status ?? 'all');
  const list = await prisma.review.findMany({ where: status === 'all' ? {} : { status }, orderBy: { createdAt: 'desc' }, take: 200, include: { product: { select: { name: true, emoji: true } } } });
  res.json(list.map(r => ({ ...reviewDto(r), product: r.product })));
}));
admin.patch('/admin/reviews/:id', ah(async (req, res) => {
  const { status } = z.object({ status: z.enum(['approved', 'pending']) }).parse(req.body);
  const r = await prisma.review.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.json(reviewDto(r));
}));
admin.delete('/admin/reviews/:id', ah(async (req, res) => {
  await prisma.review.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));
