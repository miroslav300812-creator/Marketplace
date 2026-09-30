import clsx from 'clsx';
import { Barcode, ChefHat, CornerDownLeft, Heart, History, House, ListChecks, Monitor, Moon, Package, QrCode, Search, ShoppingBag, Sun, UserRound, UserRoundCog, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '../lib/format';
import { countTo } from '../lib/motion';
import { sfx } from '../lib/sound';
import { applyTheme, readTheme, type Theme } from '../lib/theme';
import { qtyOf, useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Product } from '../types';
import { useFilters } from './filters';
import { Tile } from './ui';

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

/* ------------------------------------------------------------------ */
/* Spotlight search                                                    */
/* ------------------------------------------------------------------ */
export function Spotlight() {
  const open = useUi(s => s.searchOpen), q = useUi(s => s.q), qd = useUi(s => s.qd), set = useUi(s => s.set);
  const data = useCatalog(s => s.data);
  const history = useSession(s => s.history), pushHistory = useSession(s => s.pushHistory), clearHistory = useSession(s => s.clearHistory);
  const [idx, setIdx] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef(0);
  const catName = (id: string) => data?.categories.find(c => c.id === id)?.name ?? '';
  const all = useMemo(() => (data && qd ? matchProducts(data.products, catName, qd) : []), [data, qd]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = all.slice(0, 7);

  useEffect(() => { if (open) { setIdx(-1); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  if (!open) return null;

  const close = () => set({ searchOpen: false });
  const onInput = (v: string) => {
    set({ q: v });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { set({ qd: v.trim() }); setIdx(-1); }, 150);
  };
  const commit = (term: string) => {
    const t = term.trim();
    clearTimeout(timer.current);
    set({ q: t, qd: t, mode: 'shop', searchOpen: false });
    if (t) pushHistory(t);
    requestAnimationFrame(() => { const el = document.getElementById('catalog'); if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); });
  };
  const openProduct = (p: Product) => { set({ searchOpen: false, productId: p.id }); sfx.click(); };

  return (
    <>
      <div className="fixed inset-0 z-[150] backdrop fade-in" onClick={close} />
      <div className="fixed inset-x-0 top-0 z-[155] flex justify-center px-3 pt-[max(12px,8vh)] pointer-events-none">
        <div role="dialog" aria-label="Поиск" className="drop-down panel pointer-events-auto w-full max-w-2xl rounded-[32px] overflow-hidden">
          <div className="flex items-center gap-3 px-6 h-[68px]">
            <Search className="w-5 h-5 c-ink3 shrink-0" strokeWidth={1.75} />
            <input ref={input} data-search type="search" value={q} onChange={e => onInput(e.target.value)} autoComplete="off" aria-label="Поиск товаров"
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => (i + 1) % Math.max(1, results.length)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => (i - 1 + results.length) % Math.max(1, results.length)); }
                else if (e.key === 'Enter') { e.preventDefault(); if (idx >= 0 && results[idx]) openProduct(results[idx]); else commit(q); }
                else if (e.key === 'Escape') close();
              }}
              className="flex-1 bg-transparent outline-none text-lg placeholder:text-[var(--ink-3)] [&::-webkit-search-cancel-button]:hidden" placeholder="Продукты, категории, штрихкод" />
            {q ? <button onClick={() => { set({ q: '', qd: '' }); input.current?.focus(); }} className="w-8 h-8 rounded-full hover-soft grid place-items-center c-ink3" aria-label="Очистить"><X className="w-4 h-4" /></button>
              : <span className="kbd hidden sm:inline">esc</span>}
          </div>
          <div className="glow-line" />
          {!qd ? (
            <div className="p-6 space-y-6">
              {history.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3"><span className="eyebrow flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Недавние</span><button onClick={clearHistory} className="text-xs c-ink3 hover:text-[var(--ink)]">Очистить</button></div>
                  <div className="flex flex-wrap gap-1.5">{history.map(h => <button key={h} onClick={() => commit(h)} className="chip rounded-full px-3.5 py-1.5 text-sm">{h}</button>)}</div>
                </div>
              )}
              <div>
                <div className="eyebrow mb-3">Часто ищут</div>
                <div className="flex flex-wrap gap-1.5">{POPULAR.map(h => <button key={h} onClick={() => commit(h)} className="chip rounded-full px-3.5 py-1.5 text-sm">{h}</button>)}</div>
              </div>
              <div className="text-xs c-ink3 flex items-center gap-2"><Barcode className="w-4 h-4" />Работает и по штрихкоду — например <button className="font-mono c-ink2 hover:text-[var(--ink)]" onClick={() => onInput('4820000017')}>4820000017</button></div>
            </div>
          ) : (
            <div>
              <div className="max-h-[56vh] overflow-auto thin-scroll p-2">
                {results.map((p, i) => (
                  <button key={p.id} onClick={() => openProduct(p)} onMouseEnter={() => setIdx(i)} className={clsx('w-full flex items-center gap-4 px-4 py-3 rounded-[22px] text-left', idx === i && 'bg-[var(--hover)]')}>
                    <Tile emoji={p.emoji} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate"><Hl text={p.name} q={qd} /></span>
                      <span className="block text-xs c-ink3 truncate mt-0.5"><Hl text={catName(p.cat)} q={qd} />{p.tags.length > 0 && <> · <Hl text={p.tags.join(', ')} q={qd} /></>} · <span className="font-mono"><Hl text={p.barcode} q={qd} /></span></span>
                    </span>
                    <span className="text-right shrink-0 font-mono text-sm">{money(p.price)}{p.old && <span className="block text-[11px] line-through c-ink3">{money(p.old)}</span>}</span>
                  </button>
                ))}
                {!results.length && <div className="px-4 py-12 text-center c-ink3">Ничего не найдено по «{qd}»</div>}
              </div>
              {results.length > 0 && (
                <button onClick={() => commit(q)} className="w-full px-6 py-4 text-sm c-ink2 hover:text-[var(--ink)] flex items-center justify-between border-t hairline">
                  <span>Все результаты · {all.length}</span><CornerDownLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* HUD — bonus balance                                                 */
/* ------------------------------------------------------------------ */
export function Hud({ compact }: { compact?: boolean }) {
  const user = useSession(s => s.user);
  const set = useUi(s => s.set);
  const balance = user?.bonusBalance ?? 0;
  const [shown, setShown] = useState(balance);
  const [flash, setFlash] = useState(false);
  const prev = useRef(balance);
  useEffect(() => {
    if (prev.current === balance) return;
    setFlash(true);
    const tw = countTo(prev.current, balance, setShown);
    prev.current = balance;
    const t = setTimeout(() => setFlash(false), 1400);
    return () => { tw.kill(); clearTimeout(t); setShown(balance); };
  }, [balance]);
  const pct = user ? (user.nextTier ? Math.min(100, (user.lifetimeSpend - user.tier.min) / (user.nextTier.min - user.tier.min) * 100) : 100) : 0;
  return (
    <button data-hud onClick={() => { set({ loyaltyOpen: true }); sfx.whoosh(); }} className={clsx('hud dock-btn !px-2.5 gap-2 !flex items-center', compact && 'island !h-11')} aria-label="Карта лояльности NEON CLUB">
      <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--track)" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="59.7" strokeDashoffset={59.7 * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)' }} />
      </svg>
      <span className={clsx('font-mono text-[15px] tr text-[var(--ink)]', flash && 'neon-text')}>{user ? money(shown).replace(' ₴', '') : 'Войти'}</span>
    </button>
  );
}

export function CartTarget() {
  const count = useCart(s => s.lines.reduce((a, l) => a + l.qty, 0));
  return (
    <span data-cart-target className="relative grid place-items-center w-5 h-5">
      <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />
      {count > 0 && <span data-count className="dot-count !-top-2.5 !-right-3">{count}</span>}
    </span>
  );
}

const THEMES: [Theme, typeof Sun, string][] = [['system', Monitor, 'Авто'], ['dark', Moon, 'Обсидиан'], ['light', Sun, 'Алебастр']];

function ProfileMenu({ onClose }: { onClose: () => void }) {
  const set = useUi(s => s.set);
  const user = useSession(s => s.user), favs = useSession(s => s.favs);
  const setFilter = useFilters(s => s.set);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const items = [
    { icon: UserRoundCog, label: 'Мои данные', on: () => set({ profileOpen: true }) },
    { icon: Package, label: 'Мои заказы', on: () => set({ ordersOpen: true }) },
    { icon: QrCode, label: 'Карта NEON CLUB', on: () => set({ loyaltyOpen: true }) },
    { icon: Heart, label: `Избранное · ${favs.length}`, on: () => { setFilter({ favs: true }); set({ mode: 'shop' }); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); } }
  ];
  return (
    <div className="drop-down panel absolute right-0 top-full mt-3 w-72 rounded-[28px] p-2">
      <div className="px-4 pt-3 pb-3">
        <div className="truncate">{user?.name || 'Гость'}</div>
        <div className="text-xs c-ink3 mt-0.5">{user?.phone ?? 'Вход по номеру при заказе'}</div>
      </div>
      {items.map(i => (
        <button key={i.label} onClick={() => { onClose(); i.on(); sfx.click(); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-[18px] hover-soft text-sm c-ink2 hover:text-[var(--ink)]"><i.icon className="w-4 h-4" strokeWidth={1.75} />{i.label}</button>
      ))}
      <div className="m-2 mt-3 p-1 rounded-full well flex" role="radiogroup" aria-label="Тема оформления">
        {THEMES.map(([t, Icon, label]) => (
          <button key={t} role="radio" aria-checked={theme === t} onClick={() => { setTheme(t); applyTheme(t); sfx.click(); }} className={clsx('flex-1 h-9 rounded-full flex items-center justify-center gap-1.5 text-xs', theme === t ? 'dock-btn on !h-9 !min-w-0 !flex !px-2' : 'c-ink3 hover:text-[var(--ink)]')}>
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Floating island                                                     */
/* ------------------------------------------------------------------ */
export function Dock() {
  const { mode, set } = useUi();
  const user = useSession(s => s.user);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const toShop = () => { set({ mode: 'shop' }); scrollTo({ top: 0, behavior: 'smooth' }); sfx.click(); };
  const toRecipes = () => { set({ mode: 'shop' }); setTimeout(() => document.getElementById('recipes')?.scrollIntoView({ behavior: 'smooth' }), 60); sfx.click(); };
  const toList = () => { set({ mode: mode === 'list' ? 'shop' : 'list' }); scrollTo({ top: 0 }); sfx.whoosh(); };
  const search = () => { set({ searchOpen: true }); sfx.click(); };
  const cart = () => { set({ cartOpen: true }); sfx.click(); };

  return (
    <>
      {/* desktop island */}
      <div className="hidden md:flex fixed top-4 inset-x-0 z-40 justify-center pointer-events-none" style={{ paddingTop: 'var(--sat)' }}>
        <nav className="island pointer-events-auto flex items-center gap-1 p-1.5" aria-label="Основная навигация">
          <a href="/" onClick={e => { e.preventDefault(); toShop(); }} className="dock-btn !px-4 font-display text-[15px] text-[var(--ink)] whitespace-nowrap" aria-label="NEON MARKET — на главную"><span>neon<span className="c-ink3">.market</span></span></a>
          <span className="w-px h-5 bg-[var(--stroke)] mx-1" />
          <button onClick={toShop} className={clsx('dock-btn text-sm', mode === 'shop' && 'on')}>Каталог</button>
          <button onClick={toRecipes} className="dock-btn text-sm">Рецепты</button>
          <button onClick={toList} className={clsx('dock-btn text-sm', mode === 'list' && 'on')}>Список</button>
          <button onClick={search} className="dock-btn !px-3.5 gap-2 !flex items-center text-sm ml-1 w-56 !justify-start well" aria-label="Поиск (клавиша /)">
            <Search className="w-4 h-4" strokeWidth={1.75} /><span className="c-ink3 flex-1 text-left">Поиск</span><span className="kbd">/</span>
          </button>
          <span className="w-px h-5 bg-[var(--stroke)] mx-1" />
          <Hud />
          <div ref={menuRef} className="relative">
            <button onClick={() => setMenu(m => !m)} className={clsx('dock-btn', menu && 'on')} aria-label="Профиль" aria-expanded={menu}>
              <UserRound className="w-5 h-5" strokeWidth={1.75} />
              {user && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[var(--ink)] shadow-[0_0_8px_var(--ink)]" />}
            </button>
            {menu && <ProfileMenu onClose={() => setMenu(false)} />}
          </div>
          <button onClick={cart} className="dock-btn btn-neon !text-[var(--on-accent)] !px-4" aria-label="Корзина"><CartTarget /></button>
        </nav>
      </div>

      {/* phone: floating brand + balance on top, dock at the bottom */}
      <div className="md:hidden fixed top-3 inset-x-3 z-40 flex items-center justify-between pointer-events-none" style={{ paddingTop: 'var(--sat)' }}>
        <button onClick={toShop} className="island pointer-events-auto h-11 px-4 font-display text-[15px] whitespace-nowrap">neon<span className="c-ink3">.market</span></button>
        <div className="pointer-events-auto"><Hud compact /></div>
      </div>
      <nav className="md:hidden fixed bottom-3 inset-x-0 z-40 flex justify-center pointer-events-none" style={{ paddingBottom: 'var(--sab)' }} aria-label="Навигация">
        <div className="island pointer-events-auto flex items-center gap-1 p-1.5">
          <button onClick={toShop} className={clsx('dock-btn !w-12', mode === 'shop' && 'on')} aria-label="Главная"><House className="w-5 h-5" strokeWidth={1.75} /></button>
          <button onClick={search} className="dock-btn !w-12" aria-label="Поиск"><Search className="w-5 h-5" strokeWidth={1.75} /></button>
          <button onClick={cart} className="dock-btn btn-neon !text-[var(--on-accent)] !w-14" aria-label="Корзина"><CartTarget /></button>
          <button onClick={toRecipes} className="dock-btn !w-12" aria-label="Рецепты"><ChefHat className="w-5 h-5" strokeWidth={1.75} /></button>
          <button onClick={toList} className={clsx('dock-btn !w-12', mode === 'list' && 'on')} aria-label="Режим списка"><ListChecks className="w-5 h-5" strokeWidth={1.75} /></button>
          <button onClick={() => { set({ profileOpen: true }); sfx.click(); }} className="dock-btn !w-12" aria-label="Профиль"><UserRound className="w-5 h-5" strokeWidth={1.75} /></button>
        </div>
      </nav>
    </>
  );
}

export const useQtyInCart = (id: number) => useCart(s => qtyOf(s.lines, id));
