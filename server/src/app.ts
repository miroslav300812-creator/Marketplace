import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import { env, integrations } from './env.js';
import { errorHandler, notFound } from './lib/errors.js';
import { admin } from './routes/admin.js';
import { auth } from './routes/auth.js';
import { catalog } from './routes/catalog.js';
import { delivery } from './routes/delivery.js';
import { me } from './routes/me.js';
import { orders } from './routes/orders.js';
import { payments } from './routes/payments.js';
import { reviews } from './routes/reviews.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map(s => s.trim()) }));
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' })); // LiqPay callback is form-encoded

  const api = express.Router();
  api.get('/health', (_req, res) => { res.json({ ok: true, integrations }); });
  for (const r of [catalog, auth, me, delivery, orders, payments, reviews, admin]) api.use(r);
  api.use((_req, _res, next) => next(notFound('Маршрут API не найден')));
  app.use('/api', api);

  // In production the API also serves the built React app.
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
