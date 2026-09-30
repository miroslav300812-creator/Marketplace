import { create } from 'zustand';

export type Sort = 'pop' | 'cheap' | 'exp' | 'disc' | 'rating' | 'kcal';
type F = { cat: string; min: number; max: number; sale: boolean; favs: boolean; countries: string[]; tags: string[]; kcal: number; sort: Sort };
type S = F & { bounds: { min: number; max: number }; set: (p: Partial<F>) => void; setBounds: (min: number, max: number) => void; reset: () => void };

export const useFilters = create<S>((set, get) => ({
  cat: 'all', min: 0, max: 1000, sale: false, favs: false, countries: [], tags: [], kcal: 900, sort: 'pop',
  bounds: { min: 0, max: 1000 },
  set: p => set(p),
  setBounds: (min, max) => set({ bounds: { min, max }, min, max }),
  reset: () => { const b = get().bounds; set({ min: b.min, max: b.max, sale: false, favs: false, countries: [], tags: [], kcal: 900 }); }
}));
