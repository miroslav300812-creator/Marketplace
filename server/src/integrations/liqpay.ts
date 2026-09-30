import crypto from 'node:crypto';
import { env, integrations } from '../env.js';

/** LiqPay Checkout: https://www.liqpay.ua/documentation/api/aquiring/checkout/doc */
export const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

const sign = (data: string) => crypto.createHash('sha1').update(env.LIQPAY_PRIVATE_KEY + data + env.LIQPAY_PRIVATE_KEY).digest('base64');

export function buildCheckout(p: { orderId: string; amount: number; description: string; paytypes?: string }) {
  const payload = {
    version: 3,
    public_key: env.LIQPAY_PUBLIC_KEY,
    action: 'pay',
    amount: p.amount,
    currency: 'UAH',
    description: p.description,
    order_id: p.orderId,
    language: 'uk',
    result_url: `${env.PUBLIC_URL}/orders?paid=${encodeURIComponent(p.orderId)}`,
    server_url: `${env.API_URL}/api/payments/liqpay/callback`,
    ...(p.paytypes ? { paytypes: p.paytypes } : {}),
    ...(env.LIQPAY_SANDBOX === '1' ? { sandbox: 1 } : {})
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  return { url: LIQPAY_CHECKOUT_URL, data, signature: sign(data) };
}

export type LiqpayCallback = { order_id: string; status: string; amount: number; transaction_id?: number; sender_card_mask2?: string; paytype?: string };

/** Verifies the server_url callback signature and decodes its payload. Returns null when forged. */
export function verifyCallback(data: string, signature: string): LiqpayCallback | null {
  const expected = sign(data);
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as LiqpayCallback;
}

export const liqpayEnabled = integrations.liqpay;
export const SUCCESS_STATUSES = new Set(['success', 'sandbox']);
