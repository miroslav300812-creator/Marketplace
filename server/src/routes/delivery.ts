import { Router } from 'express';
import { z } from 'zod';
import { novaPoshta } from '../integrations/novaposhta.js';
import { STORES, coverage, reverseGeocode } from '../integrations/stores.js';
import { ah } from '../lib/errors.js';

export const delivery = Router();

delivery.get('/delivery/np/cities', ah(async (req, res) => {
  const q = z.string().max(60).default('').parse(req.query.q ?? '');
  res.json(await novaPoshta.searchCities(q));
}));
delivery.get('/delivery/np/warehouses', ah(async (req, res) => {
  const cityRef = z.string().min(1).max(64).parse(req.query.cityRef);
  res.json(await novaPoshta.warehouses(cityRef));
}));
delivery.get('/delivery/stores', (_req, res) => { res.json(STORES); });
delivery.post('/delivery/courier/resolve', ah(async (req, res) => {
  const { x, y } = z.object({ x: z.number().min(0).max(800), y: z.number().min(0).max(500) }).parse(req.body);
  res.json({ address: reverseGeocode(x, y), coverage: coverage(x, y) });
}));
