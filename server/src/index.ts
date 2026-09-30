import { createApp } from './app.js';
import { env, integrations } from './env.js';

createApp().listen(env.PORT, () => {
  const mode = (on: boolean) => (on ? 'LIVE' : 'mock');
  console.log(`NEON MARKET API → http://localhost:${env.PORT}/api`);
  console.log(`  LiqPay: ${mode(integrations.liqpay)} · Nova Poshta: ${mode(integrations.novaposhta)} · SMS Fly: ${mode(integrations.sms)}`);
});
