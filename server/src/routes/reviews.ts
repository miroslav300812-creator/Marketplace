import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireCustomer, type AuthedRequest } from '../lib/auth.js';
import { ah, notFound } from '../lib/errors.js';
import { reviewDto } from '../lib/serialize.js';

export const reviews = Router();

reviews.post('/products/:id/reviews', requireCustomer, ah(async (req: AuthedRequest, res) => {
  const productId = Number(req.params.id);
  const body = z.object({
    rating: z.number().int().min(1).max(5),
    text: z.string().trim().min(10, 'минимум 10 символов').max(1000),
    author: z.string().trim().max(60).default(''),
    emojis: z.array(z.string().max(8)).max(4).default([])
  }).parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound('Товар не найден');
  const uid = req.auth!.sub;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const bought = await prisma.orderItem.findFirst({ where: { productId, order: { userId: uid, OR: [{ paymentStatus: 'paid' }, { status: 'done' }] } } });
  const r = await prisma.review.create({
    data: {
      productId, userId: uid, author: body.author || user.name || 'Покупатель', rating: body.rating, text: body.text,
      emojis: JSON.stringify(body.emojis), verified: !!bought, status: 'pending',
      flagged: /(https?:|www\.|t\.me\/|казино|\$\$\$)/i.test(body.text)
    }
  });
  res.status(201).json(reviewDto(r, uid));
}));

reviews.post('/reviews/:id/like', ah(async (req, res) => {
  const { delta } = z.object({ delta: z.union([z.literal(1), z.literal(-1)]) }).parse(req.body);
  const r = await prisma.review.updateMany({ where: { id: Number(req.params.id), status: 'approved', ...(delta < 0 ? { likes: { gt: 0 } } : {}) }, data: { likes: { increment: delta } } });
  if (!r.count) throw notFound('Отзыв не найден');
  res.json({ ok: true });
}));
