import clsx from 'clsx';
import { ArrowRight, ChefHat, ChevronDown, House, ListChecks, Minus, Plus, ShoppingBasket, Terminal, UserRound, Volume2, VolumeX, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addToCart } from '../lib/actions';
import { confetti } from '../lib/confetti';
import { money } from '../lib/format';
import { sfx } from '../lib/sound';
import { qtyOf, useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useQuote } from '../store/quote';
import { useUi } from '../store/ui';
import { CartTarget, searchHay } from './Header';
import { Toggle } from './ui';

export function Checklist() {
  const data = useCatalog(s => s.data);
  const { lines, picked, change, removeProduct, togglePicked, decProduct } = useCart();
  const { listView, set, qd, toast } = useUi();
  const { quote } = useQuote(false);
  const [budget, setBudget] = useState(() => { try { return Number(localStorage.getItem('nm_budget')) || 1500; } catch { return 1500; } });
  const [onlyMine, setOnlyMine] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  if (!data) return null;

  const spent = quote?.goods ?? 0;
  const pct = budget > 0 ? spent / budget * 100 : 0;
  const inCart = [...new Set(lines.map(l => l.productId))];
  const pickedCount = inCart.filter(id => picked[id]).length;
  const store = listView === 'store';
  const products = (cat: string) => data.products.filter(p => p.cat === cat && (!qd || searchHay(p, '').includes(qd.toLowerCase())) && (!(onlyMine || store) || qtyOf(lines, p.id) > 0));
  const saveBudget = (v: number) => { setBudget(v); try { localStorage.setItem('nm_budget', String(v)); } catch { /* ignore */ } };
  const pick = (id: number) => {
    const next = { ...picked, [id]: !picked[id] };
    togglePicked(id);
    if (next[id]) sfx.pop(); else sfx.click();
    if (next[id] && inCart.every(x => next[x])) { sfx.success(); confetti.rain(); toast({ type: 'ok', title: 'Список собран!', msg: 'Все позиции в тележке — можно на кассу 🛒' }); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 fade-in">
      <div className="glass-2 rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold c-lime tracking-[.2em] uppercase mb-1.5 flex items-center gap-2"><ListChecks className="w-4 h-4" />Grocery Checklist Mode</div>
            <h2 className="font-display font-bold text-2xl">Режим супермаркета</h2>
          </div>
          <div className="flex p-1 rounded-2xl bg-black/30 border hairline text-sm font-bold" role="tablist">
            {(['plan', 'store'] as const).map(v => <button key={v} role="tab" aria-selected={listView === v} onClick={() => { set({ listView: v }); sfx.click(); }} className={clsx('px-4 py-2 rounded-xl', listView === v ? 'bg-lime' : 'c-ink2')}>{v === 'plan' ? '📝 Планирую' : '🛒 В магазине'}</button>)}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <div className="rounded-2xl bg-black/25 border hairline p-4">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="flex items-center gap-2"><Wallet className="w-4 h-4 c-yellow" />Бюджет</span>
              <label className="flex items-center gap-1 font-mono"><input type="number" min={0} step={50} value={budget} onChange={e => saveBudget(Math.max(0, +e.target.value))} className="w-20 bg-transparent border-b border-white/20 text-right outline-none focus:border-[var(--lime)]" aria-label="Бюджет" />₴</label>
            </div>
            <div className="mt-3 h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full tr" style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? 'var(--pink)' : pct > 85 ? 'var(--yellow)' : 'linear-gradient(90deg,var(--lime),var(--cyan))' }} /></div>
            <div className="mt-2 flex justify-between text-xs font-semibold"><span className="c-ink2">Потрачено {money(spent)}</span><span className={pct > 100 ? 'c-pink' : 'c-lime'}>{pct > 100 ? `Превышение ${money(spent - budget)}` : `Осталось ${money(budget - spent)}`}</span></div>
          </div>
          <div className="rounded-2xl bg-black/25 border hairline p-4">
            <div className="flex items-center justify-between text-sm font-bold"><span className="flex items-center gap-2"><ShoppingBasket className="w-4 h-4 c-cyan" />В тележке</span><span className="font-mono">{pickedCount} / {inCart.length}</span></div>
            <div className="mt-3 h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full tr" style={{ width: `${inCart.length ? pickedCount / inCart.length * 100 : 0}%`, background: 'var(--cyan)' }} /></div>
            <div className="mt-2 text-xs c-ink2 font-semibold">{store ? 'Отмечайте товары, которые уже положили в тележку' : 'Отметьте товары, чтобы добавить их в список'}</div>
          </div>
        </div>
      </div>

      <div className="sticky top-[128px] md:top-[73px] z-30 -mx-4 px-4 py-3 mt-4" style={{ background: 'linear-gradient(180deg, rgba(6,10,24,.95) 70%, transparent)' }}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {data.categories.map(c => (
            <button key={c.id} onClick={() => { setCollapsed(s => ({ ...s, [c.id]: false })); const el = document.getElementById('dept-' + c.id); if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 190, behavior: 'smooth' }); sfx.click(); }} className="chip shrink-0 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5">
              <span>{c.emoji}</span>{c.name}{lines.some(l => data.products.find(p => p.id === l.productId)?.cat === c.id) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--lime)]" />}
            </button>
          ))}
        </div>
        {!store && <div className="mt-3 flex items-center gap-2 text-xs font-bold c-ink2"><span className="scale-75 -ml-1.5"><Toggle on={onlyMine} label="Только мой список" onClick={() => { setOnlyMine(v => !v); sfx.click(); }} /></span>Показывать только мой список</div>}
      </div>

      <div className="space-y-3">
        {data.categories.map(c => {
          const list = products(c.id);
          if (!list.length) return null;
          const deptSpent = lines.filter(l => list.some(p => p.id === l.productId)).reduce((s, l) => s + (data.products.find(p => p.id === l.productId)?.price ?? 0) * l.qty, 0);
          return (
            <section key={c.id} id={'dept-' + c.id} className="glass rounded-3xl overflow-hidden">
              <button onClick={() => { setCollapsed(s => ({ ...s, [c.id]: !s[c.id] })); sfx.click(); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5" aria-expanded={!collapsed[c.id]}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="flex-1 min-w-0"><span className="block font-bold">{c.name}</span><span className="block text-xs c-ink3">{list.filter(p => qtyOf(lines, p.id)).length} в списке · {money(deptSpent)}</span></span>
                <ChevronDown className={clsx('w-5 h-5 c-ink3 tr', collapsed[c.id] && '-rotate-90')} />
              </button>
              {!collapsed[c.id] && list.map(p => {
                const q = qtyOf(lines, p.id);
                return (
                  <div key={p.id} className={clsx('flex items-center gap-3 px-4 py-2.5 border-t hairline', q > 0 && 'bg-[rgba(198,255,61,.04)]')}>
                    {store
                      ? <input type="checkbox" className="cbx" checked={!!picked[p.id]} onChange={() => pick(p.id)} aria-label={'Взял: ' + p.name} />
                      : <input type="checkbox" className="cbx" checked={q > 0} disabled={p.stock <= 0} onChange={e => { if (q > 0) { removeProduct(p.id); sfx.click(); } else addToCart(p, e.currentTarget); }} aria-label={p.name} />}
                    <span className="text-2xl w-8 text-center">{p.emoji}</span>
                    <button onClick={() => set({ productId: p.id })} className={clsx('flex-1 min-w-0 text-left', store && picked[p.id] && 'strike')}>
                      <span className="block text-sm font-semibold truncate">{p.name}</span>
                      <span className="block text-[11px] c-ink3">{p.unit} · {money(p.price)}{p.old ? ' · акция' : ''}</span>
                    </button>
                    {q > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { decProduct(p.id); sfx.click(); }} className="w-7 h-7 rounded-lg btn-ghost grid place-items-center" aria-label="Меньше"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center font-mono text-sm font-bold">{q}</span>
                        <button onClick={() => { const l = lines.find(x => x.productId === p.id)!; const err = change(l.key, 1); if (err) { sfx.error(); toast({ type: 'warn', msg: err }); } else sfx.click(); }} className="w-7 h-7 rounded-lg btn-ghost grid place-items-center" aria-label="Больше"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    <span className={clsx('w-16 text-right font-mono text-sm font-bold shrink-0', q ? 'c-lime' : 'c-ink3')}>{money(p.price * Math.max(1, q))}</span>
                  </div>
                );
              })}
            </section>
          );
        })}
        {store && !lines.length && <div className="glass rounded-3xl py-14 text-center"><div className="text-5xl mb-3">📝</div><div className="font-bold">Список пуст</div><p className="c-ink2 text-sm mt-1">Переключитесь в «Планирую» и отметьте товары</p></div>}
      </div>

      {lines.length > 0 && (
        <div className="sticky bottom-24 md:bottom-4 mt-5 z-30">
          <div className="panel rounded-2xl p-3 pl-5 flex items-center gap-3 shadow-2xl">
            <div className="flex-1 min-w-0"><div className="text-xs c-ink3 font-semibold">{lines.reduce((s, l) => s + l.qty, 0)} товаров{quote ? ` · бонусы +${quote.bonusEarn}` : ''}</div><div className="font-display font-bold text-lg">{money(spent)}</div></div>
            <button onClick={() => set({ checkoutOpen: true })} className="btn-neon rounded-xl px-5 py-3 flex items-center gap-2">Оформить<ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const set = useUi(s => s.set), toast = useUi(s => s.toast);
  const nav = useNavigate();
  const [on, setOn] = useState(sfx.enabled);
  const toggle = () => { const v = !on; setOn(v); sfx.set(v); toast({ type: 'info', msg: v ? 'Звук и вибро включены' : 'Звук выключен' }); };
  return (
    <footer className="relative z-10 border-t hairline mt-10 pb-28 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-display font-black text-xl">NEON<span className="c-lime">·</span>MARKET</div>
          <p className="c-ink2 text-sm mt-3 max-w-sm">Свежие продукты с доставкой по Киеву и Новой Почтой по всей Украине. Оплата через LiqPay, кэшбэк бонусами NEON CLUB.</p>
        </div>
        <div className="text-sm space-y-2.5 c-ink2">
          <div className="font-bold text-white mb-3">Покупателям</div>
          <button onClick={() => set({ ordersOpen: true })} className="block hover:text-white">Мои заказы</button>
          <button onClick={() => set({ loyaltyOpen: true })} className="block hover:text-white">Карта NEON CLUB</button>
          <button onClick={() => set({ profileOpen: true })} className="block hover:text-white">Сохранённые данные</button>
          <a href="#recipes" className="block hover:text-white">Рецепты</a>
        </div>
        <div className="text-sm space-y-3">
          <div className="font-bold mb-3">Настройки</div>
          <button onClick={toggle} className="btn-ghost rounded-xl px-4 py-2.5 flex items-center gap-2.5 font-semibold w-full" aria-pressed={on}>
            {on ? <Volume2 className="w-4 h-4 c-lime" /> : <VolumeX className="w-4 h-4 c-ink3" />}
            {on ? 'Звук и вибро: вкл' : 'Звук и вибро: выкл'}
            <span className={clsx('toggle ml-auto scale-75 -mr-2', on && 'on')} />
          </button>
          <div className="text-xs c-ink3">Горячие клавиши: <span className="kbd">/</span> поиск · <span className="kbd">Esc</span> закрыть</div>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs c-ink3">
          <span>© {new Date().getFullYear()} NEON MARKET</span>
          <button onClick={() => nav('/admin')} className="w-6 h-6 rounded-full grid place-items-center opacity-30 hover:opacity-100 hover:text-[var(--lime)]" title="Admin (Ctrl + Shift + A)" aria-label="Панель администратора"><Terminal className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </footer>
  );
}

export function MobileNav() {
  const { mode, set } = useUi();
  const { quote } = useQuote(false);
  const count = useCart(s => s.lines.length);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom" style={{ background: 'rgba(6,10,24,.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid var(--stroke)' }}>
      <div className="grid grid-cols-5 text-[10px] font-bold">
        <button onClick={() => { set({ mode: 'shop' }); scrollTo({ top: 0, behavior: 'smooth' }); sfx.click(); }} className={clsx('flex flex-col items-center gap-1 py-2.5', mode === 'shop' ? 'c-lime' : 'c-ink3')}><House className="w-5 h-5" />Главная</button>
        <button onClick={() => { set({ mode: 'shop' }); setTimeout(() => document.getElementById('recipes')?.scrollIntoView({ behavior: 'smooth' }), 50); sfx.click(); }} className="flex flex-col items-center gap-1 py-2.5 c-ink3"><ChefHat className="w-5 h-5" />Рецепты</button>
        <button onClick={() => { set({ cartOpen: true }); sfx.click(); }} className="flex flex-col items-center -mt-5" aria-label="Корзина">
          <span className="w-14 h-14 rounded-2xl btn-neon grid place-items-center"><CartTarget big /></span>
          <span className="mt-1 c-lime">{count && quote ? money(quote.total) : 'Корзина'}</span>
        </button>
        <button onClick={() => { set({ mode: mode === 'list' ? 'shop' : 'list' }); sfx.whoosh(); scrollTo({ top: 0 }); }} className={clsx('flex flex-col items-center gap-1 py-2.5', mode === 'list' ? 'c-lime' : 'c-ink3')}><ListChecks className="w-5 h-5" />Список</button>
        <button onClick={() => { set({ profileOpen: true }); sfx.click(); }} className="flex flex-col items-center gap-1 py-2.5 c-ink3"><UserRound className="w-5 h-5" />Профиль</button>
      </div>
    </nav>
  );
}
