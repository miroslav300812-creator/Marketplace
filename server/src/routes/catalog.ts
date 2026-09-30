import { Router } from 'express';
import { prisma } from '../db.js';
import { integrations } from '../env.js';
import { optionalAuth, userId, type AuthedRequest } from '../lib/auth.js';
import { ah, notFound } from '../lib/errors.js';
import { parseJson } from '../lib/json.js';
import { BONUS_MAX_SHARE, COURIER_FREE_FROM, NP_FREE_FROM } from '../lib/pricing.js';
import { productDto, reviewDto, type Rating } from '../lib/serialize.js';
import { TIERS } from '../lib/tiers.js';

export const catalog = Router();

export async function ratings(): Promise<Map<number, Rating>> {
  const rows = await prisma.review.groupBy({ by: ['productId'], where: { status: 'approved' }, _avg: { rating: true }, _count: { _all: true } });
  return new Map(rows.map(r => [r.productId, { avg: +(r._avg.rating ?? 0).toFixed(2), n: r._count._all }]));
}

catalog.get('/catalog', ah(async (_req, res) => {
  const [categories, products, recipes, rt] = await Promise.all([
    prisma.category.findMany({ orderBy: { sort: 'asc' } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { id: 'asc' } }),
    prisma.recipe.findMany({ orderBy: { sort: 'asc' }, include: { items: true } }),
    ratings()
  ]);
  res.json({
    categories,
    products: products.map(p => productDto(p, rt.get(p.id))),
    recipes: recipes.map(r => ({ ...r, steps: parseJson<string[]>(r.steps, []), items: r.items.map(i => ({ productId: i.productId, qty: i.qty })) })),
    tiers: TIERS,
    config: { courierFreeFrom: COURIER_FREE_FROM, npFreeFrom: NP_FREE_FROM, bonusMaxShare: BONUS_MAX_SHARE, integrations }
  });
}));

catalog.get('/products/:id', optionalAuth, ah(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const p = await prisma.product.findFirst({ where: { id, active: true } });
  if (!p) throw notFound('Товар не найден');
  const me = userId(req);
  const reviews = await prisma.review.findMany({
    where: { productId: id, OR: [{ status: 'approved' }, ...(me ? [{ userId: me }] : [])] },
    orderBy: { createdAt: 'desc' }
  });
  const approved = reviews.filter(r => r.status === 'approved');
  const dist = [1, 2, 3, 4, 5].map(s => approved.filter(r => r.rating === s).length);
  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
  res.json({ product: productDto(p, { avg: +avg.toFixed(2), n: approved.length }), reviews: reviews.map(r => reviewDto(r, me)), dist });
}));
