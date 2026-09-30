import { useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useUi } from '../store/ui';
import type { Product, Recipe } from '../types';
import { money } from './format';
import { flyToCart } from './motion';
import { sfx } from './sound';

const toast = (...a: Parameters<ReturnType<typeof useUi.getState>['toast']>) => useUi.getState().toast(...a);

/** Adds a product with the flight animation; returns false when stock does not allow it. */
export function addToCart(p: Product, src?: Element | null, qty = 1) {
  const err = useCart.getState().add(p.id, qty);
  if (err) { sfx.error(); toast({ type: 'warn', msg: err }); return false; }
  sfx.pop();
  flyToCart(src, p.emoji);
  return true;
}

/** Sourced from a card: flies from the card's 3D orb rather than the button. */
export const addFromCard = (p: Product, btn: HTMLElement) => addToCart(p, btn.closest('[data-card]')?.querySelector('.orb') ?? btn);

export function recipeCalc(r: Recipe) {
  const { byId } = useCatalog.getState();
  const lines = useCart.getState().lines;
  let sum = 0, missing = 0;
  for (const it of r.items) {
    const p = byId.get(it.productId); if (!p) { missing++; continue; }
    sum += p.price * it.qty;
    const inCart = lines.filter(l => l.productId === p.id).reduce((s, l) => s + l.qty, 0);
    if (p.stock - inCart < it.qty) missing++;
  }
  const disc = Math.round(sum * r.discount);
  return { sum, disc, final: sum - disc, missing };
}

export function addRecipe(r: Recipe, src: Element | null) {
  const { byId } = useCatalog.getState();
  let added = 0; const missing: string[] = [];
  for (const it of r.items) {
    const p = byId.get(it.productId);
    const err = p ? useCart.getState().add(p.id, it.qty, r.id) : 'нет';
    if (err || !p) { missing.push(p?.name ?? '—'); continue; }
    flyToCart(src, p.emoji, added * 0.12);
    added++;
  }
  if (added) {
    sfx.pop(); setTimeout(() => sfx.success(), added * 120 + 800);
    toast({ type: 'ok', title: `«${r.title}» собран в 1 клик`, msg: `${added} ингредиентов · скидка набора −${Math.round(r.discount * 100)}% (≈ ${money(recipeCalc(r).disc)})` });
  }
  if (missing.length) { toast({ type: 'warn', title: 'Не хватает на складе', msg: missing.join(', ') }); if (!added) sfx.error(); }
}
