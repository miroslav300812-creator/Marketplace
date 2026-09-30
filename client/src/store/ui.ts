import { create } from 'zustand';
import { uid } from '../lib/format';
import type { Order, Payment } from '../types';

export type Toast = { id: string; type: 'ok' | 'info' | 'warn' | 'err' | 'sms' | 'coin'; title?: string; msg: string; code?: string; onUse?: () => void; ttl?: number };

type S = {
  mode: 'shop' | 'list'; listView: 'plan' | 'store';
  q: string; qd: string;
  cartOpen: boolean; productId: number | null; loyaltyOpen: boolean; checkoutOpen: boolean;
  ordersOpen: boolean; profileOpen: boolean; filtersOpen: boolean;
  pay: { order: Order; payment: Payment } | null; receipt: Order | null;
  toasts: Toast[];
  set: (p: Partial<S>) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
};

const savedMode = (() => { try { return localStorage.getItem('nm_mode') === 'list' ? 'list' : 'shop'; } catch { return 'shop'; } })();

export const useUi = create<S>((set, get) => ({
  mode: savedMode, listView: 'plan', q: '', qd: '',
  cartOpen: false, productId: null, loyaltyOpen: false, checkoutOpen: false, ordersOpen: false, profileOpen: false, filtersOpen: false,
  pay: null, receipt: null, toasts: [],
  set: p => { set(p); if (p.mode) { try { localStorage.setItem('nm_mode', p.mode); } catch { /* ignore */ } } },
  toast: t => {
    const item = { ...t, id: uid() };
    set({ toasts: [...get().toasts.slice(-3), item] });
    setTimeout(() => get().dismiss(item.id), t.ttl ?? 3400);
  },
  dismiss: id => set({ toasts: get().toasts.filter(t => t.id !== id) })
}));

/** True while any overlay is open (used to lock page scroll). */
export const useAnyOverlay = () => useUi(s => s.cartOpen || s.productId !== null || s.loyaltyOpen || s.checkoutOpen || s.ordersOpen || s.profileOpen || s.filtersOpen || !!s.pay || !!s.receipt);
