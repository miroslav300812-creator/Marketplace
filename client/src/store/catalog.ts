import { create } from 'zustand';
import { api } from '../api';
import type { Catalog, Product } from '../types';

type S = {
  data: Catalog | null; error: string | null; loading: boolean;
  byId: Map<number, Product>;
  load: () => Promise<void>;
  patchStock: (items: { productId: number | null; qty: number }[]) => void;
};

export const useCatalog = create<S>((set, get) => ({
  data: null, error: null, loading: false, byId: new Map(),
  async load() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<Catalog>('/catalog');
      set({ data, byId: new Map(data.products.map(p => [p.id, p])), loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  /** Mirrors a successful order's stock reservation without refetching the catalogue. */
  patchStock(items) {
    const d = get().data; if (!d) return;
    const products = d.products.map(p => {
      const q = items.filter(i => i.productId === p.id).reduce((s, i) => s + i.qty, 0);
      return q ? { ...p, stock: Math.max(0, p.stock - q) } : p;
    });
    set({ data: { ...d, products }, byId: new Map(products.map(p => [p.id, p])) });
  }
}));
