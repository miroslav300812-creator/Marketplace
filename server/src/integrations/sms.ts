import { env, integrations } from '../env.js';
import { HttpError } from '../lib/errors.js';

export type SmsResult = { ok: true; messageId: string; mock: boolean };

/** SMS Fly API v2 — https://sms-fly.ua/public/api.v2.00.pdf */
async function sendReal(phone: string, text: string): Promise<SmsResult> {
  const res = await fetch('https://sms-fly.ua/api/v2/api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth: { key: env.SMSFLY_API_KEY },
      action: 'SENDMESSAGE',
      data: { recipient: phone.replace(/\D/g, ''), channels: ['sms'], sms: { source: env.SMSFLY_SENDER, ttl: 5, text } }
    })
  });
  const json = await res.json().catch(() => ({})) as { success?: number; data?: { messageID?: string }; error?: { description?: string } };
  if (!json.success) throw new HttpError(502, 'Не удалось отправить SMS: ' + (json.error?.description ?? res.status), 'sms');
  return { ok: true, messageId: json.data?.messageID ?? '', mock: false };
}

async function sendMock(phone: string, text: string): Promise<SmsResult> {
  console.info(`[sms:mock] → ${phone}: ${text}`);
  return { ok: true, messageId: 'MOCK-' + Date.now(), mock: true };
}

export const sms = { send: integrations.sms ? sendReal : sendMock, isMock: !integrations.sms };
