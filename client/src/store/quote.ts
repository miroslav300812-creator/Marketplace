import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { DeliveryDraft, Quote } from '../types';
import { useCart } from './cart';
import { useSession } from './session';

/** Converts the checkout draft into the API delivery payload, or null if incomplete. */
export function deliveryPayload(d: DeliveryDraft) {
  if (d.type === 'pickup') return d.storeId ? { type: 'pickup', storeId: d.storeId } : null;
  if (d.type === 'np') return d.np.cityRef && d.np.whRef ? { type: 'np', ...d.np } : null;
  const c = d.courier;
  return c.x != null && c.y != null && c.address.trim().length >= 3 ? { type: 'courier', x: c.x, y: c.y, address: c.address, apt: c.apt, comment: c.comment } : null;
}

/** Server-authoritative totals for the current cart, re-fetched (debounced) on every change. */
export function useQuote(withDelivery: boolean) {
  const lines = useCart(s => s.lines), promoCode = useCart(s => s.promoCode), bonusUse = useCart(s => s.bonusUse);
  const delivery = useSession(s => s.profile.delivery), user = useSession(s => s.user);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const payload = lines.length ? JSON.stringify({
    items: lines.map(l => ({ productId: l.productId, qty: l.qty, bundle: l.bundle })),
    promoCode, bonusUse, delivery: withDelivery ? deliveryPayload(delivery) : null
  }) : '';

  useEffect(() => {
    if (!payload) { setQuote(null); setError(null); return; }
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api.post<Quote>('/checkout/quote', JSON.parse(payload))
        .then(q => { if (n === seq.current) { setQuote(q); setError(null); } })
        .catch(e => { if (n === seq.current) setError(e.message); })
        .finally(() => { if (n === seq.current) setLoading(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [payload, user?.id, user?.bonusBalance]);

  return { quote, error, loading };
}
