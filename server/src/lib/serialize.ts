import type { Order, OrderItem, OrderStatusHistory, Product, Review, User, BonusTx } from '@prisma/client';
import { parseJson } from './json.js';
import { nextTier, tierFor } from './tiers.js';

export type Rating = { avg: number; n: number };

export const productDto = (p: Product, rating?: Rating) => ({
  id: p.id, name: p.name, cat: p.categoryId, price: p.price, old: p.oldPrice, unit: p.unit, emoji: p.emoji,
  tags: parseJson<string[]>(p.tags, []), country: p.country, kcal: p.kcal, stock: p.stock, badge: p.badge,
  weight: p.weight, desc: p.description, barcode: p.barcode, active: p.active,
  rating: rating ?? { avg: 0, n: 0 }
});

export const reviewDto = (r: Review, viewerId?: number | null) => ({
  id: r.id, productId: r.productId, author: r.author, rating: r.rating, text: r.text,
  emojis: parseJson<string[]>(r.emojis, []), verified: r.verified, status: r.status, flagged: r.flagged,
  likes: r.likes, createdAt: r.createdAt, mine: viewerId != null && r.userId === viewerId
});

export const orderDto = (o: Order & { items: OrderItem[]; history: OrderStatusHistory[] }) => ({
  id: o.id, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod,
  paymentTx: o.paymentTx, paymentMask: o.paymentMask, createdAt: o.createdAt,
  customer: { name: o.customerName, phone: o.customerPhone, email: o.customerEmail },
  items: o.items.map(i => ({ productId: i.productId, name: i.name, emoji: i.emoji, price: i.price, qty: i.qty, bundle: i.bundle })),
  subtotal: o.subtotal, bundleDiscount: o.bundleDiscount, promoCode: o.promoCode, promoDiscount: o.promoDiscount,
  bonusSpent: o.bonusSpent, bonusEarned: o.bonusEarned, bonusCredited: o.bonusCredited,
  delivery: { type: o.deliveryType, cost: o.deliveryCost, label: o.deliveryLabel, eta: o.deliveryEta },
  total: o.total,
  history: o.history.sort((a, b) => +a.createdAt - +b.createdAt).map(h => ({ status: h.status, at: h.createdAt }))
});

export const userDto = (u: User, history: BonusTx[] = []) => {
  const tier = tierFor(u.lifetimeSpend), next = nextTier(u.lifetimeSpend);
  return {
    id: u.id, phone: u.phone, name: u.name, email: u.email, loyaltyCard: u.loyaltyCard,
    bonusBalance: u.bonusBalance, lifetimeSpend: u.lifetimeSpend,
    tier, nextTier: next, prefs: parseJson<Record<string, unknown>>(u.prefs, {}),
    bonusHistory: history.map(h => ({ id: h.id, delta: h.delta, reason: h.reason, orderId: h.orderId, at: h.createdAt }))
  };
};
