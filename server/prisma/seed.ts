import { PrismaClient } from '@prisma/client';
import { productBarcode, ean13 } from '../src/lib/barcode.js';
import { CATEGORIES, PRODUCTS, PROMO_CODES, RECIPES, REVIEW_AUTHORS, REVIEW_EMOJI, REVIEW_TEXTS, seeded } from './data.js';

const prisma = new PrismaClient();

async function main() {
  // Wipe in dependency order so the seed is repeatable.
  await prisma.$transaction([
    prisma.orderStatusHistory.deleteMany(), prisma.orderItem.deleteMany(), prisma.order.deleteMany(),
    prisma.bonusTx.deleteMany(), prisma.review.deleteMany(), prisma.recipeItem.deleteMany(), prisma.recipe.deleteMany(),
    prisma.product.deleteMany(), prisma.category.deleteMany(), prisma.promoCode.deleteMany(), prisma.smsCode.deleteMany(), prisma.user.deleteMany()
  ]);

  await prisma.category.createMany({ data: CATEGORIES.map((c, i) => ({ ...c, sort: i })) });
  for (const [id, name, cat, price, old, unit, emoji, tags, country, kcal, stock, badge, weight, description] of PRODUCTS) {
    await prisma.product.create({
      data: {
        id, name, categoryId: cat, price, oldPrice: old, unit, emoji, country, kcal, stock, badge, weight, description,
        tags: JSON.stringify(old ? [...new Set([...tags, 'акция'])] : tags), barcode: productBarcode(id)
      }
    });
  }
  for (const [i, r] of RECIPES.entries()) {
    await prisma.recipe.create({
      data: {
        id: r.id, title: r.title, emoji: r.emoji, time: r.time, kcal: r.kcal, level: r.level, portions: r.portions,
        discount: r.discount, tint: r.tint, steps: JSON.stringify(r.steps), sort: i,
        items: { create: r.items.map(([productId, qty]) => ({ productId, qty })) }
      }
    });
  }
  await prisma.promoCode.createMany({ data: PROMO_CODES });

  // Reviews
  const rnd = seeded(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  for (const [id] of PRODUCTS) {
    const n = Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const x = rnd(), rating = x < 0.6 ? 5 : x < 0.88 ? 4 : 3;
      await prisma.review.create({
        data: {
          productId: id, author: pick(REVIEW_AUTHORS), rating, text: pick(REVIEW_TEXTS[rating]),
          emojis: JSON.stringify(rnd() < 0.35 ? [pick(REVIEW_EMOJI), pick(REVIEW_EMOJI)] : []),
          verified: rnd() < 0.7, status: 'approved', likes: Math.floor(rnd() * 24),
          createdAt: new Date(Date.now() - Math.floor(rnd() * 60) * 864e5)
        }
      });
    }
  }
  await prisma.review.createMany({
    data: [
      { productId: 1, author: 'Гость', rating: 2, text: 'Авокадо пришли слишком твёрдыми, пришлось ждать 3 дня.', emojis: '["📦"]', status: 'pending' },
      { productId: 29, author: 'Марина Т.', rating: 5, text: 'Лучший колд брю, который я пробовала! Возьму ещё ящик.', emojis: '["☕","😍"]', verified: true, status: 'pending' }
    ]
  });

  // Demo customers and orders so the admin dashboard is not empty.
  const names = ['Олег Ш.', 'Наталья Ф.', 'Игорь К.', 'Вера Л.', 'Роман Д.', 'Алина Г.', 'Сергей П.', 'Мила Н.'];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const span = Math.max(60_000, Date.now() - +start);
  const statuses = ['new', 'picking', 'transit', 'done'];
  for (const [i, name] of names.entries()) {
    const phone = '+38067' + String(1000000 + i * 7919).slice(0, 7);
    const user = await prisma.user.create({ data: { phone, name, loyaltyCard: ean13('48209900' + String(i).padStart(4, '0')), bonusBalance: 150, welcomeGiven: true, lifetimeSpend: 2500 } });
    const items: { productId: number; name: string; emoji: string; price: number; qty: number }[] = [];
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) {
      const [pid, pname, , price, , , emoji] = pick(PRODUCTS);
      if (!items.some(x => x.productId === pid)) items.push({ productId: pid, name: pname, emoji, price, qty: 1 + Math.floor(rnd() * 3) });
    }
    const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
    const bonusSpent = rnd() < 0.4 ? Math.floor(subtotal * 0.2) : 0;
    const type = pick(['np', 'courier', 'pickup']);
    const deliveryCost = type === 'pickup' ? 0 : type === 'np' ? 85 : 49;
    const status = statuses[Math.floor(rnd() * statuses.length)];
    const createdAt = new Date(Date.now() - Math.floor(rnd() * span));
    const idx = statuses.indexOf(status);
    await prisma.order.create({
      data: {
        id: 'NM-DEMO' + (i + 1), userId: user.id, status, paymentStatus: 'paid', paymentMethod: 'card', paymentMask: '424242******4242', paymentTx: 'SBX' + (100000 + i),
        customerName: name, customerPhone: phone, subtotal, bonusSpent, bonusEarned: Math.floor((subtotal - bonusSpent) * 0.05), bonusCredited: true,
        deliveryType: type, deliveryCost, deliveryLabel: type === 'pickup' ? 'NEON Крещатик, ул. Крещатик, 22' : type === 'np' ? 'Киев, Отделение №12' : 'ул. Шевченко, 14',
        total: subtotal - bonusSpent + deliveryCost, createdAt,
        items: { create: items },
        history: { create: statuses.slice(0, idx + 1).map((s, j) => ({ status: s, createdAt: new Date(+createdAt + j * 900_000) })) }
      }
    });
  }
  const counts = await Promise.all([prisma.product.count(), prisma.review.count(), prisma.order.count()]);
  console.log(`Seeded: ${counts[0]} products, ${counts[1]} reviews, ${counts[2]} demo orders.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
