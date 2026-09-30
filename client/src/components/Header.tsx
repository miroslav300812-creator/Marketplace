import clsx from 'clsx';
import { ArrowRight, Barcode, Check, Coins, Flame, Heart, History, LayoutGrid, ListChecks, Package, QrCode, Search, ShoppingCart, UserRound, UserRoundCog, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { countTo } from '../lib/motion';
import { fmt, money } from '../lib/format';
import { sfx } from '../lib/sound';
import { qtyOf, useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Product } from '../types';
import { useFilters } from './filters';

const POPULAR = ['авокадо', 'сыр', 'без сахара', 'веган', 'акция', 'кофе', 'лосось'];

export function searchHay(p: Product, catName: string) {
  return `${p.name} ${catName} ${p.tags.join(' ')} ${p.barcode} ${p.country} ${p.badge}`.toLowerCase();
}
export function matchProducts(products: Product[], catName: (id: string) => string, q: string) {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return products;
  return products.filter(p => { const h = searchHay(p, catName(p.cat)); return toks.every(t => h.includes(t)); })
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(toks[0])) - Number(a.name.toLowerCase().startsWith(toks[0])));
}

/** Highlights query tokens inside plain text without using innerHTML. */
export function Hl({ text, q }: { text: string; q: string }) {
  const toks = q.split(/\s+/).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!toks.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${toks.join('|')})`, 'gi'));
  return <>{parts.map((p, i) => i % 2 ? <mark key={i} className="hl">{p}</mark> : p)}</>;
}

function SearchBox() {
  const data = useCatalog(s => s.data);
  const { q, qd, set } = useUi();
  const history = useSession(s => s.history), pushHistory = useSession(s => s.pushHistory), clearHistory = useSession(s => s.clearHistory);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  const catName = (id: string) => data?.categories.find(c => c.id === id)?.name ?? '';
  const all = useMemo(() => (data && qd ? matchProducts(data.products, catName, qd) : []), [data, qd]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = all.slice(0, 7);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onInput = (v: string) => {
    set({ q: v }); setOpen(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { set({ qd: v.trim() }); setIdx(-1); }, 150);
  };
  const commit = (term: string) => {
    const t = term.trim();
    clearTimeout(timer.current);
    set({ q: t, qd: t, mode: 'shop' }); setOpen(false);
    if (t) pushHistory(t);
    requestAnimationFrame(() => { const el = document.getElementById('catalog'); if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); });
  };
  const openProduct = (p: Product) => { setOpen(false); set({ productId: p.id }); sfx.click(); };

  return (
    <div ref={box} className="relative order-last w-full md:order-none md:w-auto md:flex-1 md:max-w-xl">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 c-ink3 pointer-events-none" />
        <input data-search type="search" value={q} onChange={e => onInput(e.target.value)} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx(i => (i + 1) % Math.max(1, results.length)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => (i - 1 + results.length) % Math.max(1, results.length)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (idx >= 0 && results[idx]) openProduct(results[idx]); else commit(q); }
            else if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); }
          }}
          className="field !rounded-2xl !pl-10 !pr-20" placeholder="Поиск: авокадо, веган, 4820…" autoComplete="off" aria-label="Поиск товаров" />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {q && <button onClick={() => { set({ q: '', qd: '' }); setIdx(-1); }} className="w-7 h-7 grid place-items-center rounded-lg c-ink3 hover:text-white" aria-label="Очистить"><X className="w-4 h-4" /></button>}
          <span className="kbd hidden md:inline">/</span>
        </div>
      </div>
      {open && (
        <div className="fade-in absolute left-0 right-0 top-full mt-2 panel rounded-2xl shadow-2xl overflow-hidden z-50">
          {!qd ? (
            <div className="p-4 space-y-4">
              {history.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-widest font-bold c-ink3 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Недавние</span>
                    <button onClick={clearHistory} className="text-xs c-ink3 hover:text-white">Очистить</button>
                  </div>
                  <div className="flex flex-wrap gap-2">{history.map(h => <button key={h} onClick={() => commit(h)} className="chip rounded-full px-3 py-1.5 text-sm">{h}</button>)}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] uppercase tracking-widest font-bold c-ink3 mb-2 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 c-pink" />Часто ищут</div>
                <div className="flex flex-wrap gap-2">{POPULAR.map(h => <button key={h} onClick={() => commit(h)} className="chip rounded-full px-3 py-1.5 text-sm">{h}</button>)}</div>
              </div>
              <div className="text-xs c-ink3 flex items-center gap-2"><Barcode className="w-4 h-4" />Поиск по штрихкоду: введите цифры, например <button className="c-lime font-mono" onClick={() => onInput('4820000017')}>4820000017</button></div>
            </div>
          ) : (
            <div>
              <div className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-widest font-bold c-ink3">Найдено: {all.length}</div>
              <div className="max-h-[60vh] overflow-auto thin-scroll pb-2">
                {results.map((p, i) => (
                  <button key={p.id} onClick={() => openProduct(p)} onMouseEnter={() => setIdx(i)} className={clsx('w-full flex items-center gap-3 px-4 py-2.5 text-left', idx === i ? 'bg-white/10' : 'hover:bg-white/5')}>
                    <span className="w-10 h-10 rounded-xl grid place-items-center text-2xl shrink-0" style={{ background: `radial-gradient(circle at 50% 80%, ${data?.categories.find(c => c.id === p.cat)?.tint}, #111a3a 70%)` }}>{p.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate"><Hl text={p.name} q={qd} /></span>
                      <span className="block text-xs c-ink3 truncate"><Hl text={catName(p.cat)} q={qd} />{p.tags.length > 0 && <> · <Hl text={p.tags.join(', ')} q={qd} /></>} · <span className="font-mono"><Hl text={p.barcode} q={qd} /></span></span>
                    </span>
                    <span className="text-right shrink-0"><span className="block font-bold c-lime">{money(p.price)}</span>{p.old && <span className="block text-xs line-through c-ink3">{money(p.old)}</span>}</span>
                  </button>
                ))}
                {!results.length && <div className="px-4 py-8 text-center c-ink2"><div className="text-4xl mb-2">🛸</div>Ничего не найдено по «{qd}»</div>}
              </div>
              {results.length > 0 && <button onClick={() => commit(q)} className="w-full px-4 py-3 border-t hairline text-sm font-bold c-lime flex items-center justify-center gap-2 hover:bg-white/5">Показать все результаты <ArrowRight className="w-4 h-4" /></button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Hud() {
  const user = useSession(s => s.user), tiers = useCatalog(s => s.data?.tiers);
  const set = useUi(s => s.set);
  const balance = user?.bonusBalance ?? 0;
  const [shown, setShown] = useState(balance);
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('');
  const prev = useRef(balance);
  useEffect(() => {
    if (prev.current === balance) return;
    setFlash(balance > prev.current ? 'up' : 'down');
    const tw = countTo(prev.current, balance, setShown);
    prev.current = balance;
    const t = setTimeout(() => setFlash(''), 1300);
    return () => { tw.kill(); clearTimeout(t); setShown(balance); };
  }, [balance]);
  const tier = user?.tier ?? tiers?.[0];
  const pct = user ? (user.nextTier ? Math.min(100, (user.lifetimeSpend - user.tier.min) / (user.nextTier.min - user.tier.min) * 100) : 100) : 0;

  return (
    <button data-hud onClick={() => { set({ loyaltyOpen: true }); sfx.whoosh(); }} className="hud glass rounded-2xl pl-1.5 pr-3 py-1.5 flex items-center gap-2.5" aria-label="Карта лояльности">
      <span className="scan" />
      <span className="relative w-9 h-9 grid place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 w-9 h-9 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15" fill="none" stroke={tier?.color ?? '#d9a066'} strokeWidth="3" strokeLinecap="round" strokeDasharray="94.25" strokeDashoffset={94.25 * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)' }} />
        </svg>
        <Coins className="w-4 h-4 c-yellow" />
      </span>
      <span className="text-left leading-tight relative">
        <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[.18em] c-ink3 font-extrabold"><span className="pulse-dot" />{user ? tier?.name : 'Гость'}</span>
        <span className={clsx('font-mono font-bold text-[17px] tr', flash === 'up' ? 'neon-text' : flash === 'down' && 'c-pink')}>{user ? fmt(shown) : 'Войти'}</span>
      </span>
    </button>
  );
}

export function CartTarget({ big }: { big?: boolean }) {
  const count = useCart(s => s.lines.reduce((a, l) => a + l.qty, 0));
  return (
    <span data-cart-target className="relative grid place-items-center">
      <ShoppingCart className={big ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={2.4} />
      {count > 0 && <span data-count className="absolute -top-4 -right-4 min-w-[22px] h-[22px] px-1 rounded-full bg-[#060a18] text-[var(--lime)] border-2 border-[var(--lime)] text-[11px] font-black grid place-items-center">{count}</span>}
    </span>
  );
}

export function Header() {
  const { mode, set, toast } = useUi();
  const user = useSession(s => s.user), favs = useSession(s => s.favs);
  const setFilter = useFilters(s => s.set);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const toggleMode = () => {
    const next = mode === 'shop' ? 'list' : 'shop';
    set({ mode: next }); sfx.whoosh(); scrollTo({ top: 0, behavior: 'smooth' });
    toast({ type: 'info', msg: next === 'list' ? 'Режим супермаркета: компактный чек-лист' : 'Обычный режим каталога' });
  };

  return (
    <header className="sticky top-0 z-40 border-b hairline" style={{ background: 'rgba(6,10,24,.72)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <a href="/" onClick={e => { e.preventDefault(); set({ mode: 'shop' }); scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5 shrink-0" aria-label="NEON MARKET — на главную">
          <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: 'linear-gradient(135deg,#c6ff3d,#22e3ff)', boxShadow: '0 0 24px -4px rgba(198,255,61,.8)' }}>
            <span className="font-display font-black text-[#060a18] text-lg">N</span>
          </span>
          <span className="hidden sm:block leading-none">
            <span className="font-display font-black text-[15px] tracking-wide">NEON<span className="c-lime">·</span>MARKET</span>
            <span className="block text-[10px] c-ink3 font-bold tracking-[.2em] mt-1">FOOD FROM THE FUTURE</span>
          </span>
        </a>
        <SearchBox />
        <div className="flex items-center gap-2 ml-auto">
          <Hud />
          <button onClick={toggleMode} className={clsx('hidden sm:flex items-center gap-2 rounded-2xl px-3 h-12 btn-ghost', mode === 'list' && 'ring-neon !text-[var(--lime)]')} title={mode === 'list' ? 'Вернуться в каталог' : 'Режим супермаркета'}>
            {mode === 'shop' ? <ListChecks className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
            <span className="hidden lg:inline text-sm font-bold">{mode === 'list' ? 'Каталог' : 'Супермаркет'}</span>
          </button>
          <div ref={menuRef} className="relative hidden md:block">
            <button onClick={() => setMenu(m => !m)} className="w-12 h-12 rounded-2xl btn-ghost grid place-items-center relative" aria-label="Профиль" aria-expanded={menu}>
              <UserRound className="w-5 h-5" />
              {user && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-lime grid place-items-center"><Check className="w-3 h-3" strokeWidth={3} /></span>}
            </button>
            {menu && (
              <div className="fade-in absolute right-0 top-full mt-2 w-64 panel rounded-2xl p-2 shadow-2xl">
                <div className="px-3 py-2.5 border-b hairline mb-1">
                  <div className="font-bold truncate">{user?.name || 'Гость'}</div>
                  <div className="text-xs c-ink3">{user?.phone ?? 'Телефон подтверждается при заказе'}</div>
                </div>
                {[
                  { icon: UserRoundCog, label: 'Мои данные', on: () => set({ profileOpen: true }) },
                  { icon: Package, label: 'Мои заказы', on: () => set({ ordersOpen: true }) },
                  { icon: QrCode, label: 'Карта NEON CLUB', on: () => set({ loyaltyOpen: true }) },
                  { icon: Heart, label: `Избранное (${favs.length})`, on: () => { setFilter({ favs: true }); set({ mode: 'shop' }); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); } }
                ].map(i => (
                  <button key={i.label} onClick={() => { setMenu(false); i.on(); sfx.click(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-sm"><i.icon className="w-4 h-4" />{i.label}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { set({ cartOpen: true }); sfx.click(); }} className="hidden md:grid w-12 h-12 rounded-2xl btn-neon place-items-center" aria-label="Корзина"><CartTarget /></button>
        </div>
      </div>
    </header>
  );
}

export const useQtyInCart = (id: number) => useCart(s => qtyOf(s.lines, id));
