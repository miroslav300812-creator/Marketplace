import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { verifyCallback } from '../src/integrations/liqpay.js';

const app = createApp();
const api = () => request(app);
let phoneSeq = 0;

async function login(): Promise<{ token: string; phone: string }> {
  const phone = `+38050${String(1000000 + ++phoneSeq * 13).slice(0, 7)}`;
  const s = await api().post('/api/auth/sms/send').send({ phone });
  expect(s.status).toBe(200);
  const v = await api().post('/api/auth/sms/verify').send({ phone, code: s.body.devCode });
  expect(v.status).toBe(200);
  return { token: v.body.token, phone };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const pickup = { type: 'pickup', storeId: 's1' };

describe('catalog', () => {
  it('returns products, categories and recipes', async () => {
    const r = await api().get('/api/catalog');
    expect(r.status).toBe(200);
    expect(r.body.products).toHaveLength(39);
    expect(r.body.categories.length).toBeGreaterThan(5);
    expect(r.body.recipes[0].items.length).toBeGreaterThan(3);
    expect(r.body.products[0].barcode).toMatch(/^\d{13}$/);
  });
  it('product detail hides pending reviews from others', async () => {
    const r = await api().get('/api/products/1');
    expect(r.body.reviews.every((x: { status: string }) => x.status === 'approved')).toBe(true);
  });
});

describe('sms auth', () => {
  it('rejects bad phone, wrong code, and fast resend', async () => {
    expect((await api().post('/api/auth/sms/send').send({ phone: '123' })).status).toBe(400);
    const phone = '+380931112233';
    const s = await api().post('/api/auth/sms/send').send({ phone });
    expect(s.body.devCode).toMatch(/^\d{4}$/);
    expect((await api().post('/api/auth/sms/send').send({ phone })).status).toBe(429);
    const wrong = s.body.devCode === '1111' ? '2222' : '1111';
    expect((await api().post('/api/auth/sms/verify').send({ phone, code: wrong })).status).toBe(400);
    const ok = await api().post('/api/auth/sms/verify').send({ phone, code: s.body.devCode });
    expect(ok.body.user.bonusBalance).toBe(100);
    expect(ok.body.user.loyaltyCard).toMatch(/^\d{13}$/);
  });
  it('protects /me', async () => {
    expect((await api().get('/api/me')).status).toBe(401);
  });
});

describe('pricing', () => {
  it('applies bundle discount, promo and caps bonuses at 50%', async () => {
    const { token } = await login();
    const r = await api().post('/api/checkout/quote').set(auth(token)).send({
      items: [{ productId: 9, qty: 1, bundle: 'burger' }, { productId: 29, qty: 1 }], promoCode: 'extra20', bonusUse: 100000, delivery: pickup
    });
    expect(r.status).toBe(200);
    expect(r.body.subtotal).toBe(219 + 89);
    expect(r.body.bundleDiscount).toBe(Math.round(219 * 0.12));
    expect(r.body.promoDiscount).toBe(Math.round((308 - 26) * 0.2));
    expect(r.body.bonusApplied).toBe(100); // balance 100 < 50% cap
    expect(r.body.total).toBe(r.body.goods - 100);
  });
  it('rejects courier addresses outside coverage and unknown promo', async () => {
    const r = await api().post('/api/checkout/quote').send({ items: [{ productId: 1, qty: 1 }], delivery: { type: 'courier', x: 790, y: 490, address: 'ул. Далёкая, 1' } });
    expect(r.status).toBe(400);
    const p = await api().post('/api/checkout/quote').send({ items: [{ productId: 1, qty: 1 }], promoCode: 'NOPE' });
    expect(p.body.promoError).toBeTruthy();
  });
  it('frees courier delivery above the threshold', async () => {
    const r = await api().post('/api/checkout/quote').send({ items: [{ productId: 12, qty: 3 }], delivery: { type: 'courier', x: 452, y: 268, address: 'ул. Крещатик, 1' } });
    expect(r.body.delivery.cost).toBe(0);
    expect(r.body.delivery.baseCost).toBeGreaterThan(0);
  });
});

describe('orders & payments', () => {
  let token: string;
  beforeAll(async () => { ({ token } = await login()); });
  const order = (extra: object) => api().post('/api/orders').set(auth(token)).send({
    items: [{ productId: 2, qty: 2 }], delivery: pickup, customer: { name: 'Тест Тестович' }, payMethod: 'cash', ...extra
  });

  it('cash order reserves stock and spends bonuses', async () => {
    const before = (await prisma.product.findUniqueOrThrow({ where: { id: 2 } })).stock;
    const r = await order({ bonusUse: 50 });
    expect(r.status).toBe(201);
    expect(r.body.order.status).toBe('new');
    expect(r.body.order.bonusSpent).toBe(50);
    expect(r.body.payment).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: 2 } })).stock).toBe(before - 2);
    expect((await api().get('/api/me').set(auth(token))).body.bonusBalance).toBe(50);
  });

  it('card order is paid through the sandbox and credits cashback', async () => {
    const r = await order({ payMethod: 'card' });
    expect(r.body.order.status).toBe('awaiting_payment');
    expect(r.body.payment.provider).toBe('mock');
    const bad = await api().post('/api/payments/mock/charge').set(auth(token)).send({ orderId: r.body.order.id, method: 'card', card: { number: '4000000000000002', exp: '12/29', cvv: '123' } });
    expect(bad.body.status).toBe('failure');
    const ok = await api().post('/api/payments/mock/charge').set(auth(token)).send({ orderId: r.body.order.id, method: 'card', card: { number: '4242 4242 4242 4242', exp: '12/29', cvv: '123' } });
    expect(ok.body.status).toBe('success');
    expect(ok.body.order.paymentStatus).toBe('paid');
    expect(ok.body.order.bonusCredited).toBe(true);
    const again = await api().post('/api/payments/mock/charge').set(auth(token)).send({ orderId: r.body.order.id, method: 'apple' });
    expect(again.status).toBe(400);
  });

  it('3-D Secure flow', async () => {
    const r = await order({ payMethod: 'card' });
    const c = await api().post('/api/payments/mock/charge').set(auth(token)).send({ orderId: r.body.order.id, method: 'card', card: { number: '4000000000003220', exp: '12/29', cvv: '123' } });
    expect(c.body.status).toBe('3ds_verify');
    expect((await api().post('/api/payments/mock/3ds').set(auth(token)).send({ txId: c.body.txId, otp: '000000' })).status).toBe(400);
    const ok = await api().post('/api/payments/mock/3ds').set(auth(token)).send({ txId: c.body.txId, otp: c.body.devOtp });
    expect(ok.body.order.status).toBe('new');
  });

  it('rejects ordering more than in stock', async () => {
    const r = await order({ items: [{ productId: 39, qty: 99 }] });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('out_of_stock');
  });

  it('cancel returns stock and bonuses', async () => {
    const before = (await prisma.product.findUniqueOrThrow({ where: { id: 2 } })).stock;
    const bal = (await api().get('/api/me').set(auth(token))).body.bonusBalance;
    const r = await order({ bonusUse: 10 });
    const c = await api().post(`/api/orders/${r.body.order.id}/cancel`).set(auth(token));
    expect(c.body.status).toBe('cancelled');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: 2 } })).stock).toBe(before);
    expect((await api().get('/api/me').set(auth(token))).body.bonusBalance).toBe(bal);
  });

  it('lists only own orders', async () => {
    const mine = await api().get('/api/orders').set(auth(token));
    expect(mine.body.length).toBeGreaterThanOrEqual(4);
    const other = await login();
    expect((await api().get(`/api/orders/${mine.body[0].id}`).set(auth(other.token))).status).toBe(404);
  });
});

describe('reviews & admin', () => {
  it('review goes to moderation; admin approves; CRUD and stats work', async () => {
    const { token } = await login();
    const rv = await api().post('/api/products/5/reviews').set(auth(token)).send({ rating: 5, text: 'Отличный салат, свежий!', emojis: ['🥬'] });
    expect(rv.status).toBe(201);
    expect(rv.body.status).toBe('pending');

    expect((await api().post('/api/admin/login').send({ password: 'nope' })).status).toBe(401);
    expect((await api().get('/api/admin/stats').set(auth(token))).status).toBe(403);
    const adminToken = (await api().post('/api/admin/login').send({ password: 'test-admin' })).body.token;
    const A = auth(adminToken);

    expect((await api().patch(`/api/admin/reviews/${rv.body.id}`).set(A).send({ status: 'approved' })).body.status).toBe('approved');
    const stats = await api().get('/api/admin/stats').set(A);
    expect(stats.body.hourly).toHaveLength(24);
    expect(stats.body.count).toBeGreaterThan(0);

    const created = await api().post('/api/admin/products').set(A).send({ name: 'Манго', cat: 'veg', price: 99, old: 120, stock: 5, emoji: '🥭' });
    expect(created.status).toBe(201);
    expect(created.body.tags).toContain('акция');
    const patched = await api().patch(`/api/admin/products/${created.body.id}`).set(A).send({ old: null, price: 80 });
    expect(patched.body.old).toBeNull();
    expect(patched.body.tags).not.toContain('акция');
    expect((await api().patch(`/api/admin/products/${created.body.id}`).set(A).send({ old: 50 })).status).toBe(400);
    await api().delete(`/api/admin/products/${created.body.id}`).set(A);
    expect((await api().get(`/api/products/${created.body.id}`)).status).toBe(404);

    const orders = await api().get('/api/admin/orders?status=new').set(A);
    const target = orders.body[0];
    const stock = (await prisma.product.findUniqueOrThrow({ where: { id: target.items[0].productId } })).stock;
    const cancelled = await api().patch(`/api/admin/orders/${target.id}`).set(A).send({ status: 'cancelled' });
    expect(cancelled.body.status).toBe('cancelled');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: target.items[0].productId } })).stock).toBe(stock + target.items[0].qty);
    const exp = await api().get('/api/admin/orders/export').set(A);
    expect(exp.headers['content-disposition']).toContain('attachment');
  });
});

describe('liqpay callback signature', () => {
  it('rejects forged payloads', async () => {
    const data = Buffer.from(JSON.stringify({ order_id: 'x', status: 'success', amount: 1 })).toString('base64');
    expect(verifyCallback(data, 'forged')).toBeNull();
    const r = await api().post('/api/payments/liqpay/callback').type('form').send({ data, signature: 'forged' });
    expect(r.status).toBe(400);
  });
});
