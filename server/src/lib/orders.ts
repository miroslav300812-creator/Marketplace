import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

type Tx = Prisma.TransactionClient;

export const ORDER_STATUSES = ['awaiting_payment', 'new', 'picking', 'transit', 'done', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const newOrderId = () => 'NM-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 90 + 10);

/** Credits the cashback of an order once (idempotent). */
export async function creditCashback(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.bonusCredited || !o.userId) return;
  await tx.order.update({ where: { id: o.id }, data: { bonusCredited: true } });
  await tx.user.update({ where: { id: o.userId }, data: { bonusBalance: { increment: o.bonusEarned }, lifetimeSpend: { increment: o.total } } });
  if (o.bonusEarned) await tx.bonusTx.create({ data: { userId: o.userId, delta: o.bonusEarned, reason: `Кэшбэк · заказ ${o.id}`, orderId: o.id } });
}

/** Marks an online payment as successful and moves the order into the fulfilment pipeline. */
export async function markPaid(orderId: string, p: { tx: string; mask?: string | null }) {
  return prisma.$transaction(async tx => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o) return null;
    if (o.paymentStatus === 'paid') return o;
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'paid', paymentTx: p.tx, paymentMask: p.mask ?? null, status: o.status === 'awaiting_payment' ? 'new' : o.status } });
    if (o.status === 'awaiting_payment') await tx.orderStatusHistory.create({ data: { orderId, status: 'new' } });
    await creditCashback(tx, orderId);
    return tx.order.findUnique({ where: { id: orderId } });
  });
}

/** Returns reserved stock and spent bonuses of a cancelled order; reverses credited cashback. */
export async function releaseOrder(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const i of o.items) if (i.productId) await tx.product.updateMany({ where: { id: i.productId }, data: { stock: { increment: i.qty } } });
  if (o.userId) {
    const back = o.bonusSpent - (o.bonusCredited ? o.bonusEarned : 0);
    await tx.user.update({ where: { id: o.userId }, data: { bonusBalance: { increment: back }, ...(o.bonusCredited ? { lifetimeSpend: { decrement: o.total } } : {}) } });
    if (o.bonusSpent) await tx.bonusTx.create({ data: { userId: o.userId, delta: o.bonusSpent, reason: `Возврат бонусов · отмена ${o.id}`, orderId: o.id } });
    if (o.bonusCredited && o.bonusEarned) await tx.bonusTx.create({ data: { userId: o.userId, delta: -o.bonusEarned, reason: `Отмена кэшбэка · ${o.id}`, orderId: o.id } });
  }
  await tx.order.update({ where: { id: orderId }, data: { bonusCredited: false, paymentStatus: o.paymentStatus === 'paid' ? 'refunded' : o.paymentStatus } });
}

export const orderInclude = { items: true, history: true } as const;
