import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from '../types';
import { useCatalog } from './catalog';

type S = {
  lines: CartLine[]; promoCode: string | null; bonusUse: number; picked: Record<number, boolean>;
  /** Returns an error message when stock does not allow the change. */
  add: (productId: number, qty?: number, bundle?: string | null) => string | null;
  change: (key: string, delta: number) => string | null;
  decProduct: (productId: number) => void;
  removeProduct: (productId: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setPromo: (c: string | null) => void;
  setBonus: (n: number) => void;
  togglePicked: (id: number) => void;
};

export const qtyOf = (lines: CartLine[], productId: number) => lines.filter(l => l.productId === productId).reduce((s, l) => s + l.qty, 0);

export const useCart = create<S>()(persist((set, get) => ({
  lines: [], promoCode: null, bonusUse: 0, picked: {},
  add(productId, qty = 1, bundle = null) {
    const p = useCatalog.getState().byId.get(productId);
    if (!p) return 'Товар недоступен';
    if (p.stock <= 0) return `«${p.name}» закончился`;
    if (qtyOf(get().lines, productId) + qty > p.stock) return `В наличии только ${p.stock} шт.`;
    const key = productId + (bundle ? ':' + bundle : '');
    const lines = get().lines;
    const has = lines.find(l => l.key === key);
    set({ lines: has ? lines.map(l => l.key === key ? { ...l, qty: l.qty + qty } : l) : [...lines, { key, productId, qty, bundle }] });
    return null;
  },
  change(key, delta) {
    const line = get().lines.find(l => l.key === key); if (!line) return null;
    if (delta > 0) {
      const p = useCatalog.getState().byId.get(line.productId);
      if (p && qtyOf(get().lines, line.productId) + delta > p.stock) return `В наличии только ${p.stock} шт.`;
    }
    const q = line.qty + delta;
    set({ lines: q <= 0 ? get().lines.filter(l => l.key !== key) : get().lines.map(l => l.key === key ? { ...l, qty: q } : l) });
    return null;
  },
  decProduct(productId) {
    const line = get().lines.find(l => l.productId === productId && !l.bundle) ?? get().lines.find(l => l.productId === productId);
    if (line) get().change(line.key, -1);
  },
  removeProduct(productId) { const picked = { ...get().picked }; delete picked[productId]; set({ lines: get().lines.filter(l => l.productId !== productId), picked }); },
  remove(key) { set({ lines: get().lines.filter(l => l.key !== key) }); },
  clear() { set({ lines: [], promoCode: null, bonusUse: 0, picked: {} }); },
  setPromo(c) { set({ promoCode: c }); },
  setBonus(n) { set({ bonusUse: Math.max(0, Math.round(n)) }); },
  togglePicked(id) { set({ picked: { ...get().picked, [id]: !get().picked[id] } }); }
}), { name: 'nm_cart' }));
