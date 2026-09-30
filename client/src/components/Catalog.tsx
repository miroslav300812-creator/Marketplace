import clsx from 'clsx';
import { BadgePercent, Coins, Heart, Minus, Plus, RotateCcw, ShoppingCart, SlidersHorizontal, Star, X } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { addFromCard } from '../lib/actions';
import { discountPct, money } from '../lib/format';
import { sfx } from '../lib/sound';
import { qtyOf, useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Product } from '../types';
import { useFilters, type Sort } from './filters';
import { matchProducts } from './Header';
import { Orb, Ribbon, Toggle, useSheetDrag, useTint } from './ui';

const TAGS = ['веган', 'акция', 'без сахара', 'био', 'без глютена'];

/** Emulates lazy image decoding: each card shows a shimmer until its "image" is ready. */
function useImageReady(id: number) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 150 + ((id * 97) % 900)); return () => clearTimeout(t); }, [id]);
  return ready;
}

const ProductCard = memo(function ProductCard({ p, i }: { p: Product; i: number }) {
  const qty = useCart(s => qtyOf(s.lines, p.id)), decProduct = useCart(s => s.decProduct);
  const fav = useSession(s => s.favs.includes(p.id)), toggleFav = useSession(s => s.toggleFav);
  const rate = useSession(s => s.user?.tier.rate ?? 0.03);
  const set = useUi(s => s.set), toast = useUi(s => s.toast);
  const tint = useTint()(p.cat);
  const ready = useImageReady(p.id);
  const open = () => { set({ productId: p.id }); sfx.click(); };
  return (
    <article data-card className="card card-in p-3 sm:p-4 flex flex-col" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <div className="relative">
        <button onClick={open} className="block w-full" aria-label={p.name}><Orb emoji={p.emoji} tint={tint} loaded={ready} className="aspect-square w-full" emoClass="text-[56px] sm:text-7xl" /></button>
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5 pointer-events-none">
          <Ribbon badge={p.badge} />
          {p.old && <span className="ribbon rb-sale">−{discountPct(p)}%</span>}
        </div>
        <button onClick={() => { toggleFav(p.id); sfx.click(); if (!fav) toast({ type: 'info', msg: `«${p.name}» в избранном` }); }} className={clsx('absolute right-2 top-2 w-9 h-9 rounded-xl grid place-items-center bg-black/40 backdrop-blur', fav ? 'c-pink' : 'c-ink2 hover:text-white')} aria-label={fav ? 'Убрать из избранного' : 'В избранное'} aria-pressed={fav}>
          <Heart className={clsx('w-4 h-4', fav && 'fill-current')} />
        </button>
        {p.stock > 0 && p.stock <= 5 && <span className="absolute left-2 bottom-2 text-[10px] font-extrabold px-2 py-1 rounded-full bg-black/60 c-yellow">Осталось {p.stock}</span>}
        {p.stock <= 0 && <span className="absolute inset-0 rounded-[22px] bg-black/60 grid place-items-center font-display font-bold text-sm">Нет в наличии</span>}
      </div>
      <div className="mt-3 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 text-xs c-ink3 h-4">
          {p.rating.n ? <span className="flex items-center gap-1"><span className="star on"><Star className="w-3.5 h-3.5 fill-current" /></span><b className="text-white">{p.rating.avg.toFixed(1)}</b>({p.rating.n})</span> : <span className="c-cyan font-bold">Новинка</span>}
          <span className="ml-auto truncate">{p.country}</span>
        </div>
        <button onClick={open} className="mt-1.5 text-left font-bold leading-snug text-[15px] line-clamp-2 hover:text-[var(--lime)]">{p.name}</button>
        <div className="text-xs c-ink3 mt-1">{p.unit} · {p.kcal} ккал</div>
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2"><span className="font-display font-bold text-xl">{money(p.price)}</span>{p.old && <span className="text-xs line-through c-ink3">{money(p.old)}</span>}</div>
          <div className="text-[11px] font-bold c-lime mt-0.5 flex items-center gap-1"><Coins className="w-3 h-3" />+{Math.max(1, Math.floor(p.price * rate))} бонусов вернётся</div>
          <div className="mt-3">
            {qty === 0 ? (
              <button onClick={e => addFromCard(p, e.currentTarget)} disabled={p.stock <= 0} className="btn-neon w-full rounded-xl py-2.5 text-sm flex items-center justify-center gap-2"><ShoppingCart className="w-4 h-4" strokeWidth={2.4} />В корзину</button>
            ) : (
              <div className="flex items-center justify-between rounded-xl p-1 ring-neon" style={{ background: 'rgba(198,255,61,.08)' }}>
                <button onClick={() => { decProduct(p.id); sfx.click(); }} className="w-9 h-9 rounded-lg grid place-items-center hover:bg-white/10" aria-label="Меньше"><Minus className="w-4 h-4" /></button>
                <span className="font-mono font-bold c-lime">{qty} шт</span>
                <button onClick={e => addFromCard(p, e.currentTarget)} className="w-9 h-9 rounded-lg grid place-items-center bg-lime" aria-label="Больше"><Plus className="w-4 h-4" strokeWidth={2.6} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

function Filters({ products, count }: { products: Product[]; count: number }) {
  const f = useFilters();
  const open = useUi(s => s.filtersOpen), set = useUi(s => s.set);
  const close = () => set({ filtersOpen: false });
  const drag = useSheetDrag(close);
  const countries = useMemo(() => [...new Set(products.map(p => p.country))].sort(), [products]);
  const pct = (v: number) => ((v - f.bounds.min) / Math.max(1, f.bounds.max - f.bounds.min)) * 100;
  const toggleIn = (key: 'countries' | 'tags', v: string) => { f.set({ [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v] }); sfx.click(); };
  return (
    <>
      {open && <div className="fixed inset-0 z-[55] backdrop lg:hidden fade-in" onClick={close} />}
      <aside data-sheet className={clsx(open ? 'block sheet-up' : 'hidden lg:block', 'fixed inset-x-0 bottom-0 z-[60] max-h-[86vh] overflow-auto thin-scroll rounded-t-[28px] panel p-5 safe-bottom lg:sticky lg:top-[92px] lg:z-auto lg:max-h-[calc(100vh-110px)] lg:rounded-3xl lg:self-start')}>
        <div className="lg:hidden flex justify-center -mt-2 mb-3" onPointerDown={drag} style={{ touchAction: 'none' }}><span className="sheet-handle" /></div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 c-lime" />Фильтры</h3>
          <button onClick={() => { f.reset(); sfx.click(); }} className="text-xs font-bold c-ink3 hover:text-white flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Сбросить</button>
        </div>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm font-bold mb-3"><span>Цена</span><span className="font-mono c-lime">{f.min}–{f.max} ₴</span></div>
            <div className="range-dual">
              <div className="track" />
              <div className="fill" style={{ left: `${pct(f.min)}%`, right: `${100 - pct(f.max)}%` }} />
              <input type="range" className="range" min={f.bounds.min} max={f.bounds.max} step={5} value={f.min} onChange={e => f.set({ min: Math.min(+e.target.value, f.max - 10) })} aria-label="Минимальная цена" />
              <input type="range" className="range" min={f.bounds.min} max={f.bounds.max} step={5} value={f.max} onChange={e => f.set({ max: Math.max(+e.target.value, f.min + 10) })} aria-label="Максимальная цена" />
            </div>
            <div className="flex justify-between text-[11px] c-ink3 font-mono mt-1.5"><span>{f.bounds.min} ₴</span><span>{f.bounds.max} ₴</span></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm font-bold flex items-center gap-2"><BadgePercent className="w-4 h-4 c-pink" />Только со скидкой</span><Toggle on={f.sale} label="Только со скидкой" onClick={() => { f.set({ sale: !f.sale }); sfx.click(); }} /></div>
            <div className="flex items-center justify-between"><span className="text-sm font-bold flex items-center gap-2"><Heart className="w-4 h-4 c-pink" />Избранное</span><Toggle on={f.favs} label="Только избранное" onClick={() => { f.set({ favs: !f.favs }); sfx.click(); }} /></div>
          </div>
          <div>
            <div className="text-sm font-bold mb-3">Особенности</div>
            <div className="flex flex-wrap gap-2">{TAGS.map(t => <button key={t} onClick={() => toggleIn('tags', t)} className={clsx('chip rounded-full px-3 py-1.5 text-xs font-bold', f.tags.includes(t) && 'on')} aria-pressed={f.tags.includes(t)}>{t}</button>)}</div>
          </div>
          <div>
            <div className="flex justify-between text-sm font-bold mb-3"><span>Калорийность до</span><span className="font-mono c-lime">{f.kcal >= 900 ? 'любая' : f.kcal + ' ккал'}</span></div>
            <input type="range" min={50} max={900} step={10} value={f.kcal} onChange={e => f.set({ kcal: +e.target.value })} className="range range-single" style={{ ['--p' as string]: `${(f.kcal - 50) / 850 * 100}%` }} aria-label="Калорийность" />
          </div>
          <div>
            <div className="text-sm font-bold mb-3">Страна</div>
            <div className="grid grid-cols-2 gap-2">
              {countries.map(c => <label key={c} className="flex items-center gap-2 text-sm c-ink2 cursor-pointer"><input type="checkbox" className="cbx !w-[18px] !h-[18px] !rounded-md" checked={f.countries.includes(c)} onChange={() => toggleIn('countries', c)} /><span className="truncate">{c}</span></label>)}
            </div>
          </div>
          <button onClick={close} className="lg:hidden btn-neon w-full rounded-2xl py-3.5">Показать {count} товаров</button>
        </div>
      </aside>
    </>
  );
}

export function Catalog() {
  const data = useCatalog(s => s.data), loading = useCatalog(s => s.loading), error = useCatalog(s => s.error), load = useCatalog(s => s.load);
  const f = useFilters();
  const qd = useUi(s => s.qd), set = useUi(s => s.set);
  const favs = useSession(s => s.favs);

  useEffect(() => {
    if (!data?.products.length) return;
    const prices = data.products.map(p => p.price);
    const min = Math.floor(Math.min(...prices) / 10) * 10, max = Math.ceil(Math.max(...prices) / 10) * 10;
    if (min !== f.bounds.min || max !== f.bounds.max) f.setBounds(min, max);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const catName = (id: string) => data?.categories.find(c => c.id === id)?.name ?? '';
  const list = useMemo(() => {
    if (!data) return [];
    const res = matchProducts(data.products, catName, qd).filter(p =>
      (f.cat === 'all' || p.cat === f.cat) && p.price >= f.min && p.price <= f.max && (!f.sale || !!p.old) &&
      (!f.countries.length || f.countries.includes(p.country)) && (f.kcal >= 900 || p.kcal <= f.kcal) &&
      f.tags.every(t => p.tags.includes(t)) && (!f.favs || favs.includes(p.id)));
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      pop: (a, b) => Number(b.badge === 'Хит') - Number(a.badge === 'Хит') || b.rating.n - a.rating.n,
      cheap: (a, b) => a.price - b.price, exp: (a, b) => b.price - a.price,
      disc: (a, b) => discountPct(b) - discountPct(a), rating: (a, b) => b.rating.avg - a.rating.avg, kcal: (a, b) => a.kcal - b.kcal
    };
    return [...res].sort(by[f.sort]);
  }, [data, qd, f, favs]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = (f.min > f.bounds.min || f.max < f.bounds.max ? 1 : 0) + (f.sale ? 1 : 0) + (f.favs ? 1 : 0) + (f.kcal < 900 ? 1 : 0) + f.countries.length + f.tags.length;
  const chip = (label: string, clear: () => void) => <button onClick={clear} className="chip on rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5">{label}<X className="w-3 h-3" /></button>;

  return (
    <section id="catalog" className="max-w-7xl mx-auto px-4 mt-10 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl">Каталог</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm c-ink2">
            <span>{!data ? 'Загрузка…' : `${list.length} из ${data.products.length} товаров`}</span>
            {qd && chip(`«${qd}»`, () => set({ q: '', qd: '' }))}
            {f.cat !== 'all' && chip(catName(f.cat), () => f.set({ cat: 'all' }))}
            {f.favs && chip('Избранное', () => f.set({ favs: false }))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={f.sort} onChange={e => f.set({ sort: e.target.value as Sort })} className="field !py-2.5 !w-auto text-sm font-semibold" aria-label="Сортировка">
            <option value="pop">Популярные</option><option value="cheap">Сначала дешевле</option><option value="exp">Сначала дороже</option>
            <option value="disc">Макс. скидка</option><option value="rating">По рейтингу</option><option value="kcal">Меньше калорий</option>
          </select>
          <button onClick={() => set({ filtersOpen: true })} className="lg:hidden btn-ghost rounded-xl px-3.5 py-2.5 text-sm font-bold flex items-center gap-2 relative">
            <SlidersHorizontal className="w-4 h-4" />Фильтры
            {active > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-lime text-[11px] font-black grid place-items-center">{active}</span>}
          </button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[270px_1fr] gap-6">
        <Filters products={data?.products ?? []} count={list.length} />
        <div>
          {error && !data ? (
            <div className="glass rounded-3xl py-14 text-center"><div className="text-5xl mb-3">📡</div><div className="font-bold">Не удалось загрузить каталог</div><p className="c-ink2 text-sm mt-1">{error}</p><button onClick={load} className="btn-neon rounded-xl px-5 py-3 mt-4">Повторить</button></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {(!data || loading) && !data?.products.length && Array.from({ length: 8 }, (_, n) => (
                <div key={n} className="card p-3 sm:p-4"><div className="skel aspect-square !rounded-[22px]" /><div className="skel h-3 w-16 mt-4" /><div className="skel h-4 w-full mt-2.5" /><div className="skel h-4 w-2/3 mt-2" /><div className="skel h-6 w-20 mt-4" /><div className="skel h-10 w-full mt-3 !rounded-xl" /></div>
              ))}
              {list.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}
            </div>
          )}
          {data && !list.length && (
            <div className="glass rounded-3xl py-16 text-center">
              <div className="text-6xl mb-3">🛸</div><div className="font-display font-bold text-xl">Ничего не нашлось</div>
              <p className="c-ink2 mt-2">Попробуйте изменить запрос или фильтры</p>
              <button onClick={() => { set({ q: '', qd: '' }); f.reset(); f.set({ cat: 'all' }); }} className="btn-neon rounded-xl px-5 py-3 mt-5">Сбросить всё</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
