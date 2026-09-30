import clsx from 'clsx';
import { ArrowRight, ChevronDown, Minus, Plus, Terminal, Volume2, VolumeX } from 'lucide-react';
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
import { searchHay } from './Header';
import { Toggle } from './ui';

const Meter = ({ pct, label, value, note, warn }: { pct: number; label: string; value: React.ReactNode; note: string; warn?: boolean }) => (
  <div>
    <div className="flex items-baseline justify-between"><span className="text-sm c-ink2">{label}</span><span className="font-mono">{value}</span></div>
    <div className="mt-3 h-[3px] rounded-full bg-[var(--track)] overflow-hidden"><div className="h-full rounded-full tr" style={{ width: `${Math.min(100, pct)}%`, background: warn ? 'var(--danger)' : 'var(--ink)' }} /></div>
    <div className={clsx('mt-2 text-xs', warn ? 'c-pink' : 'c-ink3')}>{note}</div>
  </div>
);

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
    if (next[id] && inCart.every(x => next[x])) { sfx.success(); confetti.rain(); toast({ type: 'ok', title: 'Список собран', msg: 'Все позиции в тележке — можно на кассу' }); }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 pt-32 md:pt-40 fade-in">
      <div className="eyebrow">Режим супермаркета</div>
      <h2 className="font-display text-4xl md:text-5xl mt-4">Список покупок</h2>
      <div className="mt-8 inline-flex p-1 rounded-full well" role="tablist">
        {(['plan', 'store'] as const).map(v => <button key={v} role="tab" aria-selected={listView === v} onClick={() => { set({ listView: v }); sfx.click(); }} className={clsx('px-5 h-10 rounded-full text-sm', listView === v ? 'dock-btn on !h-10' : 'c-ink3 hover:text-[var(--ink)]')}>{v === 'plan' ? 'Планирую' : 'В магазине'}</button>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-8 mt-10">
        <Meter pct={pct} warn={pct > 100} label="Бюджет" note={pct > 100 ? `Превышение ${money(spent - budget)}` : `Потрачено ${money(spent)} · осталось ${money(budget - spent)}`}
          value={<label className="flex items-baseline gap-1"><input type="number" min={0} step={50} value={budget} onChange={e => saveBudget(Math.max(0, +e.target.value))} className="w-20 bg-transparent text-right outline-none border-b border-[var(--stroke)] focus:border-[var(--ink)]" aria-label="Бюджет" />₴</label>} />
        <Meter pct={inCart.length ? pickedCount / inCart.length * 100 : 0} label="В тележке" value={`${pickedCount} / ${inCart.length}`} note={store ? 'Отмечайте то, что уже положили' : 'Отметьте товары, чтобы добавить их в список'} />
      </div>

      <div className="sticky top-3 md:top-24 z-30 -mx-5 px-5 py-4 mt-8">
        <div className="flex gap-1 overflow-x-auto no-scrollbar island p-1 !rounded-full w-max max-w-full">
          {data.categories.map(c => (
            <button key={c.id} onClick={() => { setCollapsed(s => ({ ...s, [c.id]: false })); const el = document.getElementById('dept-' + c.id); if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 170, behavior: 'smooth' }); sfx.click(); }} className="dock-btn !h-9 shrink-0 text-xs !flex items-center gap-1.5">
              <span>{c.emoji}</span>{c.name}{lines.some(l => data.products.find(p => p.id === l.productId)?.cat === c.id) && <span className="w-1 h-1 rounded-full bg-[var(--ink)]" />}
            </button>
          ))}
        </div>
      </div>
      {!store && <div className="mb-4 flex items-center gap-3 text-sm c-ink2"><Toggle on={onlyMine} label="Только мой список" onClick={() => { setOnlyMine(v => !v); sfx.click(); }} />Только мой список</div>}

      <div className="space-y-3">
        {data.categories.map(c => {
          const list = products(c.id);
          if (!list.length) return null;
          return (
            <section key={c.id} id={'dept-' + c.id} className="glass rounded-[32px] overflow-hidden">
              <button onClick={() => { setCollapsed(s => ({ ...s, [c.id]: !s[c.id] })); sfx.click(); }} className="w-full flex items-center gap-4 px-6 py-5 text-left" aria-expanded={!collapsed[c.id]}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="flex-1 min-w-0"><span className="block">{c.name}</span><span className="block text-xs c-ink3 mt-0.5">{list.filter(p => qtyOf(lines, p.id)).length} в списке</span></span>
                <ChevronDown className={clsx('w-5 h-5 c-ink3 tr', collapsed[c.id] && '-rotate-90')} strokeWidth={1.5} />
              </button>
              {!collapsed[c.id] && <div className="pb-2">{list.map(p => {
                const q = qtyOf(lines, p.id);
                return (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover-soft">
                    {store
                      ? <input type="checkbox" className="cbx" checked={!!picked[p.id]} onChange={() => pick(p.id)} aria-label={'Взял: ' + p.name} />
                      : <input type="checkbox" className="cbx" checked={q > 0} disabled={p.stock <= 0} onChange={e => { if (q > 0) { removeProduct(p.id); sfx.click(); } else addToCart(p, e.currentTarget); }} aria-label={p.name} />}
                    <span className="text-2xl w-8 text-center">{p.emoji}</span>
                    <button onClick={() => set({ productId: p.id })} className={clsx('flex-1 min-w-0 text-left', store && picked[p.id] && 'strike')}>
                      <span className="block text-sm truncate">{p.name}</span>
                      <span className="block text-xs c-ink3">{p.unit}</span>
                    </button>
                    {q > 0 && (
                      <div className="flex items-center gap-1 shrink-0 rounded-full well p-0.5">
                        <button onClick={() => { decProduct(p.id); sfx.click(); }} className="w-7 h-7 rounded-full hover-soft grid place-items-center" aria-label="Меньше"><Minus className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                        <span className="w-5 text-center font-mono text-sm">{q}</span>
                        <button onClick={() => { const l = lines.find(x => x.productId === p.id)!; const err = change(l.key, 1); if (err) { sfx.error(); toast({ type: 'warn', msg: err }); } else sfx.click(); }} className="w-7 h-7 rounded-full hover-soft grid place-items-center" aria-label="Больше"><Plus className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
                      </div>
                    )}
                    <span className={clsx('w-20 text-right font-mono text-sm shrink-0', !q && 'c-ink3')}>{money(p.price * Math.max(1, q))}</span>
                  </div>
                );
              })}</div>}
            </section>
          );
        })}
        {store && !lines.length && <div className="py-20 text-center"><div className="font-display text-xl">Список пуст</div><p className="c-ink3 text-sm mt-2">Переключитесь в «Планирую» и отметьте товары</p></div>}
      </div>

      {lines.length > 0 && (
        <div className="sticky bottom-24 md:bottom-6 mt-8 z-30 flex justify-center">
          <div className="island flex items-center gap-4 p-1.5 pl-6">
            <div><div className="text-[11px] c-ink3">{lines.reduce((s, l) => s + l.qty, 0)} товаров</div><div className="font-mono">{money(spent)}</div></div>
            <button onClick={() => set({ checkoutOpen: true })} className="btn-neon rounded-full h-11 px-5 flex items-center gap-2 text-sm">Оформить<ArrowRight className="w-4 h-4" strokeWidth={1.75} /></button>
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
  const toggle = () => { const v = !on; setOn(v); sfx.set(v); toast({ type: 'info', msg: v ? 'Звук включён' : 'Звук выключен' }); };
  const link = 'block c-ink3 hover:text-[var(--ink)]';
  return (
    <footer className="relative z-10 mt-16 pb-32 md:pb-10">
      <div className="max-w-6xl mx-auto px-5">
        <div className="glow-line" />
        <div className="py-14 grid gap-10 md:grid-cols-4 text-sm">
          <div className="md:col-span-2">
            <div className="font-display text-xl">neon<span className="c-ink3">.market</span></div>
            <p className="c-ink3 mt-4 max-w-sm leading-relaxed">Свежие продукты с доставкой по Киеву и Новой Почтой по всей Украине. Оплата через LiqPay, кэшбэк бонусами NEON CLUB.</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => set({ ordersOpen: true })} className={link}>Мои заказы</button>
            <button onClick={() => set({ loyaltyOpen: true })} className={link}>Карта NEON CLUB</button>
            <button onClick={() => set({ profileOpen: true })} className={link}>Сохранённые данные</button>
            <a href="#recipes" className={link}>Рецепты</a>
          </div>
          <div className="space-y-4">
            <button onClick={toggle} className="flex items-center gap-3 c-ink3 hover:text-[var(--ink)]" aria-pressed={on}>
              {on ? <Volume2 className="w-4 h-4" strokeWidth={1.75} /> : <VolumeX className="w-4 h-4" strokeWidth={1.75} />}{on ? 'Звук включён' : 'Звук выключен'}
            </button>
            <div className="text-xs c-ink3"><span className="kbd">/</span> поиск · <span className="kbd">esc</span> закрыть</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs c-ink3">
          <span>© {new Date().getFullYear()} NEON MARKET</span>
          <button onClick={() => nav('/admin')} className="w-7 h-7 rounded-full grid place-items-center opacity-40 hover:opacity-100" title="Admin (Ctrl + Shift + A)" aria-label="Панель администратора"><Terminal className="w-3.5 h-3.5" strokeWidth={1.75} /></button>
        </div>
      </div>
    </footer>
  );
}
