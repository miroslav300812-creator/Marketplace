import clsx from 'clsx';
import { Heart, Minus, Plus, RotateCcw, SlidersHorizontal, Star, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { Categories } from './Home';
import { Orb, Toggle, useSheetDrag } from './ui';

const TAGS = ['веган', 'акция', 'без сахара', 'био', 'без глютена'];

/** Emulates lazy image decoding: each card shows a shimmer until its "image" is ready. */
function useImageReady(id: number) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 150 + ((id * 97) % 900)); return () => clearTimeout(t); }, [id]);
  return ready;
}

function AddPill({ p }: { p: Product }) {
  const qty = useCart(s => qtyOf(s.lines, p.id)), decProduct = useCart(s => s.decProduct);
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const has = qty > 0;
  // On touch screens there is no hover: a tap on the count lets it flow open, and it settles back after a pause.
  const keepOpen = () => { setOpen(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 2600); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className={clsx('qty-pill', has ? 'has btn-neon' : 'btn-ghost', open && has && 'open')}>
      {!has ? (
        <button onClick={e => { addFromCard(p, e.currentTarget); keepOpen(); }} disabled={p.stock <= 0} className="qp-mini" aria-label={`Добавить «${p.name}» в корзину`}><Plus className="w-[18px] h-[18px]" /></button>
      ) : (
        <>
          <button onClick={keepOpen} className="qp-mini font-mono text-sm" aria-label={`В корзине ${qty}. Изменить количество`}>{qty}</button>
          <div className="qp-full">
            <button onClick={() => { decProduct(p.id); sfx.click(); keepOpen(); }} className="qp-btn" aria-label="Меньше"><Minus className="w-4 h-4" /></button>
            <span className="font-mono text-sm" aria-live="polite">{qty}</span>
            <button onClick={e => { addFromCard(p, e.currentTarget); keepOpen(); }} className="qp-btn" aria-label="Больше"><Plus className="w-4 h-4" /></button>
          </div>
        </>
      )}
    </div>
  );
}

const ProductCard = memo(function ProductCard({ p, i }: { p: Product; i: number }) {
  const fav = useSession(s => s.favs.includes(p.id)), toggleFav = useSession(s => s.toggleFav);
  const rate = useSession(s => s.user?.tier.rate ?? 0.03);
  const set = useUi(s => s.set), toast = useUi(s => s.toast);
  const ready = useImageReady(p.id);
  const open = () => { set({ productId: p.id }); sfx.click(); };
  return (
    <article data-card className="card glass-i card-in p-3 sm:p-4 flex flex-col" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
      <div className="relative">
        <button onClick={open} className="block w-full" aria-label={p.name}><Orb emoji={p.emoji} loaded={ready} className="aspect-square w-full" emoClass="text-[64px] sm:text-[84px]" /></button>
        <div className="absolute left-1 top-1 flex flex-col items-start gap-1 pointer-events-none">
          {p.old ? <span className="ribbon rb-sale">−{discountPct(p)}%</span> : p.badge && <span className="ribbon">{p.badge}</span>}
        </div>
        <button onClick={() => { toggleFav(p.id); sfx.click(); if (!fav) toast({ type: 'info', msg: `«${p.name}» в избранном` }); }}
          className={clsx('fav-btn absolute right-1 top-1 w-9 h-9 rounded-full grid place-items-center hover-soft', fav ? 'on text-[var(--ink)]' : 'c-ink3')} aria-label={fav ? 'Убрать из избранного' : 'В избранное'} aria-pressed={fav}>
          <Heart className={clsx('w-4 h-4', fav && 'fill-current')} strokeWidth={1.75} />
        </button>
        {p.stock <= 0 && <span className="absolute inset-x-0 bottom-2 text-center text-xs c-ink3">Нет в наличии</span>}
      </div>
      <div className="mt-2 px-1 flex-1 flex flex-col">
        <button onClick={open} className="text-left text-[15px] leading-snug line-clamp-2 hover:opacity-70">{p.name}</button>
        <div className="text-xs c-ink3 mt-1 flex items-center gap-1.5">
          <span>{p.unit}</span>
          {p.rating.n > 0 && <><span>·</span><span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" strokeWidth={0} />{p.rating.avg.toFixed(1)}</span></>}
          {p.stock > 0 && p.stock <= 5 && <><span>·</span><span className="c-ink2">осталось {p.stock}</span></>}
        </div>
        <div className="mt-auto pt-4 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[17px] leading-none">{money(p.price)}</div>
            <div className="text-[11px] mt-1.5 flex items-center gap-1.5">{p.old && <span className="line-through c-ink3">{money(p.old)}</span>}<span className="c-yellow">+{Math.max(1, Math.floor(p.price * rate))} б.</span></div>
          </div>
          <AddPill p={p} />
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
      <aside data-sheet className={clsx(open ? 'block sheet-up panel' : 'hidden lg:block', 'fixed inset-x-2 bottom-2 z-[60] max-h-[86vh] overflow-auto thin-scroll rounded-[32px] p-6 lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none lg:backdrop-blur-none lg:sticky lg:top-28 lg:z-auto lg:max-h-[calc(100vh-130px)] lg:self-start')}>
        <div className="lg:hidden flex justify-center -mt-3 mb-4" onPointerDown={drag} style={{ touchAction: 'none' }}><span className="sheet-handle" /></div>
        <div className="flex items-center justify-between mb-7">
          <h3 className="eyebrow">Фильтры</h3>
          <button onClick={() => { f.reset(); sfx.click(); }} className="text-xs c-ink3 hover:text-[var(--ink)] flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />Сбросить</button>
        </div>
        <div className="space-y-8">
          <div>
            <div className="flex justify-between text-sm mb-4"><span className="c-ink2">Цена</span><span className="font-mono">{f.min}–{f.max} ₴</span></div>
            <div className="range-dual">
              <div className="track" />
              <div className="fill" style={{ left: `${pct(f.min)}%`, right: `${100 - pct(f.max)}%` }} />
              <input type="range" className="range" min={f.bounds.min} max={f.bounds.max} step={5} value={f.min} onChange={e => f.set({ min: Math.min(+e.target.value, f.max - 10) })} aria-label="Минимальная цена" />
              <input type="range" className="range" min={f.bounds.min} max={f.bounds.max} step={5} value={f.max} onChange={e => f.set({ max: Math.max(+e.target.value, f.min + 10) })} aria-label="Максимальная цена" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm"><span className="c-ink2">Со скидкой</span><Toggle on={f.sale} label="Только со скидкой" onClick={() => { f.set({ sale: !f.sale }); sfx.click(); }} /></div>
            <div className="flex items-center justify-between text-sm"><span className="c-ink2">Избранное</span><Toggle on={f.favs} label="Только избранное" onClick={() => { f.set({ favs: !f.favs }); sfx.click(); }} /></div>
          </div>
          <div>
            <div className="text-sm c-ink2 mb-3">Особенности</div>
            <div className="flex flex-wrap gap-1.5">{TAGS.map(t => <button key={t} onClick={() => toggleIn('tags', t)} className={clsx('chip rounded-full px-3 h-8 text-xs well', f.tags.includes(t) && 'on')} aria-pressed={f.tags.includes(t)}>{t}</button>)}</div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-4"><span className="c-ink2">Калорийность до</span><span className="font-mono">{f.kcal >= 900 ? 'любая' : f.kcal + ' ккал'}</span></div>
            <input type="range" min={50} max={900} step={10} value={f.kcal} onChange={e => f.set({ kcal: +e.target.value })} className="range range-single" style={{ ['--p' as string]: `${(f.kcal - 50) / 850 * 100}%` }} aria-label="Калорийность" />
          </div>
          <div>
            <div className="text-sm c-ink2 mb-3">Страна</div>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
              {countries.map(c => <label key={c} className="flex items-center gap-2.5 text-sm c-ink2 cursor-pointer hover:text-[var(--ink)]"><input type="checkbox" className="cbx !w-[18px] !h-[18px] !rounded-[6px]" checked={f.countries.includes(c)} onChange={() => toggleIn('countries', c)} /><span className="truncate">{c}</span></label>)}
            </div>
          </div>
          <button onClick={close} className="lg:hidden btn-neon w-full rounded-full h-12">Показать {count}</button>
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
  const chip = (label: string, clear: () => void) => <button onClick={clear} className="chip on rounded-full pl-3 pr-2 h-8 text-xs flex items-center gap-1.5">{label}<X className="w-3 h-3" /></button>;

  return (
    <section id="catalog" className="max-w-6xl mx-auto px-5 pt-8 pb-16 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="eyebrow">Каталог</div>
          <h2 className="font-display text-4xl md:text-5xl mt-4">Всё свежее</h2>
        </div>
        <div className="flex items-center gap-2">
          <select value={f.sort} onChange={e => f.set({ sort: e.target.value as Sort })} className="field !py-2.5 !w-auto !rounded-full text-sm" aria-label="Сортировка">
            <option value="pop">Популярные</option><option value="cheap">Дешевле</option><option value="exp">Дороже</option>
            <option value="disc">Скидка</option><option value="rating">Рейтинг</option><option value="kcal">Меньше калорий</option>
          </select>
          <button onClick={() => set({ filtersOpen: true })} className="lg:hidden btn-ghost rounded-full h-11 px-4 text-sm flex items-center gap-2 relative">
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />Фильтры{active > 0 && <span className="dot-count !static">{active}</span>}
          </button>
        </div>
      </div>
      <Categories />
      <div className="mt-3 mb-8 flex flex-wrap items-center gap-2 text-sm c-ink3 min-h-8">
        <span>{!data ? 'Загрузка…' : `${list.length} из ${data.products.length}`}</span>
        {qd && chip(`«${qd}»`, () => set({ q: '', qd: '' }))}
        {f.favs && chip('Избранное', () => f.set({ favs: false }))}
      </div>
      <div className="grid lg:grid-cols-[220px_1fr] gap-10">
        <Filters products={data?.products ?? []} count={list.length} />
        <div>
          {error && !data ? (
            <div className="glass rounded-[36px] py-16 text-center"><div className="font-display text-xl">Не удалось загрузить каталог</div><p className="c-ink3 text-sm mt-2">{error}</p><button onClick={load} className="btn-neon rounded-full px-6 h-11 mt-6">Повторить</button></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {(!data || loading) && !data?.products.length && Array.from({ length: 8 }, (_, n) => (
                <div key={n} className="card p-4"><div className="skel aspect-square !rounded-full scale-75" /><div className="skel h-4 w-4/5 mt-3" /><div className="skel h-3 w-1/3 mt-2" /><div className="flex justify-between items-end mt-6"><div className="skel h-5 w-16" /><div className="skel w-10 h-10 !rounded-full" /></div></div>
              ))}
              {list.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}
            </div>
          )}
          {data && !list.length && (
            <div className="py-24 text-center">
              <div className="font-display text-2xl">Ничего не нашлось</div>
              <p className="c-ink3 mt-2">Попробуйте изменить запрос или фильтры</p>
              <button onClick={() => { set({ q: '', qd: '' }); f.reset(); f.set({ cat: 'all' }); }} className="btn-ghost rounded-full px-6 h-11 mt-6">Сбросить всё</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
