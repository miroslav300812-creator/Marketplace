import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { sms } from '../integrations/sms.js';
import { signCustomer } from '../lib/auth.js';
import { ean13 } from '../lib/barcode.js';
import { ah, badRequest, tooMany } from '../lib/errors.js';
import { normalizePhone } from '../lib/phone.js';
import { userDto } from '../lib/serialize.js';

export const auth = Router();

const WELCOME_BONUS = 100;
const CODE_TTL_MS = 5 * 60_000;
const RESEND_MS = 60_000;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const hash = (phone: string, code: string) => crypto.createHmac('sha256', env.JWT_SECRET).update(phone + ':' + code).digest('hex');

auth.post('/auth/sms/send', ah(async (req, res) => {
  const { phone: raw } = z.object({ phone: z.string() }).parse(req.body);
  const phone = normalizePhone(raw);
  if (!phone) throw badRequest('Формат: +380 XX XXX XX XX', 'bad_phone');

  const recent = await prisma.smsCode.findMany({ where: { phone, createdAt: { gt: new Date(Date.now() - 3600_000) } }, orderBy: { createdAt: 'desc' } });
  const last = recent[0];
  if (last && Date.now() - +last.createdAt < RESEND_MS) {
    throw tooMany(`Повторная отправка через ${Math.ceil((RESEND_MS - (Date.now() - +last.createdAt)) / 1000)} с`);
  }
  if (recent.length >= MAX_PER_HOUR) throw tooMany('Слишком много запросов. Попробуйте через час');

  const code = String(crypto.randomInt(1000, 10000));
  await prisma.smsCode.create({ data: { phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) } });
  const result = await sms.send(phone, `NEON MARKET: код подтверждения ${code}. Никому его не сообщайте.`);
  // In mock mode no real SMS leaves the server, so the code is returned for the demo UI.
  res.json({ ok: true, resendIn: RESEND_MS / 1000, ...(result.mock ? { devCode: code } : {}) });
}));

auth.post('/auth/sms/verify', ah(async (req, res) => {
  const body = z.object({ phone: z.string(), code: z.string().regex(/^\d{4}$/, '4 цифры') }).parse(req.body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw badRequest('Формат: +380 XX XXX XX XX', 'bad_phone');

  const rec = await prisma.smsCode.findFirst({ where: { phone, used: false }, orderBy: { createdAt: 'desc' } });
  if (!rec) throw badRequest('Сначала запросите код', 'no_code');
  if (rec.expiresAt < new Date()) throw badRequest('Срок действия кода истёк', 'code_expired');
  if (rec.attempts >= MAX_ATTEMPTS) throw tooMany('Слишком много попыток. Запросите новый код');
  const ok = crypto.timingSafeEqual(Buffer.from(rec.codeHash), Buffer.from(hash(phone, body.code)));
  if (!ok) {
    await prisma.smsCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    throw badRequest('Неверный код, попробуйте ещё раз', 'bad_code');
  }
  await prisma.smsCode.update({ where: { id: rec.id }, data: { used: true } });

  const user = await prisma.$transaction(async tx => {
    let u = await tx.user.findUnique({ where: { phone } });
    if (!u) u = await tx.user.create({ data: { phone, loyaltyCard: ean13('482099' + String(crypto.randomInt(0, 1e6)).padStart(6, '0')) } });
    if (!u.welcomeGiven) {
      u = await tx.user.update({ where: { id: u.id }, data: { welcomeGiven: true, bonusBalance: { increment: WELCOME_BONUS } } });
      await tx.bonusTx.create({ data: { userId: u.id, delta: WELCOME_BONUS, reason: 'Приветственный бонус NEON CLUB' } });
    }
    return u;
  });
  const history = await prisma.bonusTx.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ token: signCustomer(user.id), user: userDto(user, history) });
}));
