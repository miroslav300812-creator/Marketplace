import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  ADMIN_PASSWORD: z.string().min(4).default('admin'),
  PUBLIC_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // LiqPay — https://www.liqpay.ua/documentation/api/aquiring/checkout
  LIQPAY_PUBLIC_KEY: z.string().default(''),
  LIQPAY_PRIVATE_KEY: z.string().default(''),
  LIQPAY_SANDBOX: z.enum(['0', '1']).default('1'),

  // Nova Poshta — https://developers.novaposhta.ua
  NOVAPOSHTA_API_KEY: z.string().default(''),
  NOVAPOSHTA_SENDER_CITY_REF: z.string().default('8d5a980d-391c-11dd-90d9-001a92567626'), // Kyiv

  // SMS Fly — https://sms-fly.ua
  SMSFLY_API_KEY: z.string().default(''),
  SMSFLY_SENDER: z.string().default('InfoCenter')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET === 'dev-only-secret-change-me-please') throw new Error('Set JWT_SECRET in production');
  if (env.ADMIN_PASSWORD === 'admin') throw new Error('Set ADMIN_PASSWORD in production');
}

/** Which integrations run against real APIs (keys present) vs. the built-in mocks. */
export const integrations = {
  liqpay: Boolean(env.LIQPAY_PUBLIC_KEY && env.LIQPAY_PRIVATE_KEY),
  novaposhta: Boolean(env.NOVAPOSHTA_API_KEY),
  sms: Boolean(env.SMSFLY_API_KEY)
};
