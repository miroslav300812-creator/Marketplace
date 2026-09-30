import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, tokens } from '../api';
import type { DeliveryDraft, PayMethod, User } from '../types';

export const emptyDelivery = (): DeliveryDraft => ({
  type: 'np',
  np: { cityRef: '', cityName: '', whType: 'branch', whRef: '', whName: '', whAddress: '' },
  courier: { x: null, y: null, address: '', apt: '', comment: '' },
  storeId: ''
});

type S = {
  user: User | null;
  /** Checkout form data remembered in this browser (auto-fill on the next order). */
  profile: { name: string; email: string; phone: string; delivery: DeliveryDraft; payMethod: PayMethod; rememberCard: boolean; savedCard: string | null };
  favs: number[]; history: string[];
  setUser: (u: User | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  setProfile: (p: Partial<S['profile']>) => void;
  setDelivery: (d: Partial<DeliveryDraft>) => void;
  toggleFav: (id: number) => void;
  pushHistory: (q: string) => void;
  clearHistory: () => void;
  forget: () => void;
};

export const useSession = create<S>()(persist((set, get) => ({
  user: null,
  profile: { name: '', email: '', phone: '', delivery: emptyDelivery(), payMethod: 'card', rememberCard: true, savedCard: null },
  favs: [], history: [],
  setUser: user => set({ user }),
  login(token, user) {
    tokens.customer = token;
    const p = get().profile;
    // Server-side preferences win when this browser has nothing saved yet.
    set({ user, profile: { ...p, name: p.name || user.name, email: p.email || user.email, delivery: p.delivery.type && (p.delivery.np.cityRef || p.delivery.storeId || p.delivery.courier.address) ? p.delivery : (user.prefs.delivery ?? p.delivery), payMethod: user.prefs.payMethod ?? p.payMethod } });
  },
  logout() { tokens.customer = null; set({ user: null }); },
  async refresh() {
    if (!tokens.customer) { set({ user: null }); return; }
    try { set({ user: await api.get<User>('/me') }); } catch { set({ user: null }); }
  },
  setProfile: p => set({ profile: { ...get().profile, ...p } }),
  setDelivery: d => set({ profile: { ...get().profile, delivery: { ...get().profile.delivery, ...d } } }),
  toggleFav: id => set({ favs: get().favs.includes(id) ? get().favs.filter(x => x !== id) : [...get().favs, id] }),
  pushHistory: q => set({ history: [q, ...get().history.filter(h => h.toLowerCase() !== q.toLowerCase())].slice(0, 8) }),
  clearHistory: () => set({ history: [] }),
  forget() { tokens.customer = null; set({ user: null, profile: { name: '', email: '', phone: '', delivery: emptyDelivery(), payMethod: 'card', rememberCard: true, savedCard: null }, history: [] }); }
}), { name: 'nm_session', partialize: s => ({ profile: s.profile, favs: s.favs, history: s.history }) }));
