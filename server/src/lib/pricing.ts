import { z } from 'zod';
import { prisma } from '../db.js';
import { novaPoshta } from '../integrations/novaposhta.js';
import { STORES, coverage } from '../integrations/stores.js';
import { badRequest } from './errors.js';
import { tierFor } from './tiers.js';

export const COURIER_FREE_FROM = 1000;
export const NP_FREE_FROM = 2000;
export const BONUS_MAX_SHARE = 0.5;

export const deliverySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('np'),
    cityRef: z.string().min(1).max(64),
    cityName: z.string().max(80).default(''),
    whType: z.enum(['branch', 'postomat']).default('branch'),
    whRef: z.string().min(1).max(64),
    whName: z.string().max(120).default(''),
    whAddress: z.string().max(200).default('')
  }),
  z.object({
    type: z.literal('courier'),
    x: z.number().min(0).max(800),
    y: z.number().min(0).max(500),
    address: z.string().min(3).max(200),
    apt: z.string().max(20).default(''),
    comment: z.string().max(300).default('')
  }),
  z.object({ type: z.literal('pickup'), storeId: z.string().min(1) })
]);
export type DeliveryInput = z.infer<typeof deliverySchema>;

export const quoteSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    qty: z.number().int().min(1).max(99),
    bundle: z.string().max(40).nullish()
  })).min(1).max(100),
  promoCode: z.string().max(40).nullish(),
  bonusUse: z.number().int().min(0).default(0),
  delivery: deliverySchema.nullish()
});
export type QuoteInput = z.infer<typeof quoteSchema>;

type UserLike = { bonusBalance: number; lifetimeSpend: number } | null;

export async function computeQuote(input: QuoteInput, user: UserLike) {
  const ids = [...new Set(input.items.map(i => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true } });
  const byId = new Map(products.map(p => [p.id, p]));
  const recipeIds = [...new Set(input.items.map(i => i.bundle).filter((b): b is string => !!b))];
  const recipes = recipeIds.length ? await prisma.recipe.findMany({ where: { id: { in: recipeIds } }, include: { items: true } }) : [];

  // Merge duplicate lines and check stock per product.
  const qtyByProduct = new Map<number, number>();
  const lines = input.items.map(i => {
    const p = byId.get(i.productId);
    if (!p) throw badRequest(`Товар #${i.productId} недоступен`, 'product_unavailable');
    const recipe = i.bundle ? recipes.find(r => r.id === i.bundle && r.items.some(x => x.productId === p.id)) : undefined;
    qtyByProduct.set(p.id, (qtyByProduct.get(p.id) ?? 0) + i.qty);
    const sum = p.price * i.qty;
    const disc = recipe ? Math.round(sum * recipe.discount) : 0;
    return { productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: i.qty, bundle: recipe?.id ?? null, sum, disc, weight: p.weight * i.qty };
  });
  for (const [pid, qty] of qtyByProduct) {
    const p = byId.get(pid)!;
    if (qty > p.stock) throw badRequest(`«${p.name}»: в наличии только ${p.stock} шт.`, 'out_of_stock');
  }

  const subtotal = lines.reduce((s, l) => s + l.sum, 0);
  const bundleDiscount = lines.reduce((s, l) => s + l.disc, 0);

  let promo: { code: string; label: string; type: string } | null = null;
  let promoError: string | null = null;
  let promoDiscount = 0;
  if (input.promoCode) {
    const code = input.promoCode.trim().toUpperCase();
    const pc = await prisma.promoCode.findUnique({ where: { code } });
    if (!pc || !pc.active) promoError = 'Промокод не найден или истёк';
    else if (subtotal < pc.minSubtotal) promoError = `Минимальная сумма для ${pc.code} — ${pc.minSubtotal} ₴`;
    else {
      promo = { code: pc.code, label: pc.label, type: pc.type };
      const base = subtotal - bundleDiscount;
      if (pc.type === 'percent') promoDiscount = Math.round(base * pc.value / 100);
      else if (pc.type === 'fixed') promoDiscount = Math.min(pc.value, base);
    }
  }

  const goods = Math.max(0, subtotal - bundleDiscount - promoDiscount);
  const bonusMax = user ? Math.max(0, Math.min(user.bonusBalance, Math.floor(goods * BONUS_MAX_SHARE))) : 0;
  const bonusApplied = Math.min(input.bonusUse, bonusMax);
  const weight = +lines.reduce((s, l) => s + l.weight, 0).toFixed(2);

  const delivery = input.delivery ? await quoteDelivery(input.delivery, { goods, weight, freeByPromo: promo?.type === 'delivery' }) : null;
  const total = goods - bonusApplied + (delivery?.cost ?? 0);
  const tier = tierFor(user?.lifetimeSpend ?? 0);

  return {
    lines, subtotal, bundleDiscount, promo, promoError, promoDiscount, goods,
    bonusMax, bonusApplied, bonusEarn: Math.floor((goods - bonusApplied) * tier.rate), cashbackRate: tier.rate,
    weight, delivery, total
  };
}

async function quoteDelivery(d: DeliveryInput, ctx: { goods: number; weight: number; freeByPromo: boolean }) {
  let base: number, eta: string, label: string;
  let freeFrom = 0;
  if (d.type === 'pickup') {
    const s = STORES.find(x => x.id === d.storeId);
    if (!s) throw badRequest('Магазин не найден');
    base = 0; eta = 'через 1 час'; label = `${s.name}, ${s.address}`;
  } else if (d.type === 'np') {
    const q = await novaPoshta.quote({ cityRef: d.cityRef, type: d.whType, weight: ctx.weight, declared: ctx.goods });
    base = q.cost; eta = q.etaLabel; freeFrom = NP_FREE_FROM;
    label = [d.cityName, d.whName].filter(Boolean).join(', ') + (d.whAddress ? ` (${d.whAddress})` : '');
  } else {
    const c = coverage(d.x, d.y);
    if (!c.inZone) throw badRequest('Адрес вне зоны курьерской доставки', 'out_of_zone');
    base = c.cost; eta = c.eta; freeFrom = COURIER_FREE_FROM;
    label = d.address + (d.apt ? `, кв. ${d.apt}` : '');
  }
  let cost = base;
  if (freeFrom && ctx.goods >= freeFrom) cost = 0;
  if (ctx.freeByPromo) cost = 0;
  return { type: d.type, cost, baseCost: base, eta, label, freeFrom };
}
