import clsx from 'clsx';
import { ArrowRight, BadgePercent, Coins, Minus, Plus, ShoppingCart, TicketPercent, Trash2, Truck, X } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { api } from '../api';
import { confetti } from '../lib/confetti';
import { fmt, money } from '../lib/format';
import { sfx } from '../lib/sound';
import { useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useQuote } from '../store/quote';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { CartLine, Quote } from '../types';
import { Overlay, SheetHeader, Spinner, useTint } from './ui';

/** Swipe a row left on touch screens to remove it. */
function useRowSwipe(onRemove: () => void) {
  return (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,input,a')) return;
    const row = e.currentTarget.querySelector<HTMLElement>('[data-row]'); if (!row) return;
    const x0 = e.clientX, y0 = e.clientY; let dx = 0, active = false;
    const cleanup = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    const move = (ev: globalThis.PointerEvent) => {
      const mx = ev.clientX - x0, my = ev.clientY - y0;
      if (!active) { if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) active = true; else if (Math.abs(my) > 10) { cleanup(); return; } }
      if (active) { dx = Math.min(0, mx); row.style.transition = 'none'; row.style.transform = `translateX(${dx}px)`; }
    };
    const up = () => {
      cleanup(); row.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1)';
      if (dx < -110) { row.style.transform = 'translateX(-110%)'; sfx.whoosh(); setTimeout(onRemove, 260); } else row.style.transform = '';
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
}

function Line({ l, disc }: { l: CartLine; disc: number }) {
  const p = useCatalog(s => s.byId.get(l.productId));
  const recipe = useCatalog(s => s.data?.recipes.find(r => r.id === l.bundle));
  const { change, remove } = useCart();
  const toast = useUi(s => s.toast);
  const tint = useTint();
  const swipe = useRowSwipe(() => remove(l.key));
  if (!p) return null;
  const sum = p.price * l.qty;
  const step = (d: number) => { const err = change(l.key, d); if (err) { sfx.error(); toast({ type: 'warn', msg: err }); } else sfx.click(); };
  return (
    <div className="relative drag-row overflow-hidden rounded-2xl" onPointerDown={swipe}>
      <div className="absolute inset-0 swipe-del-bg flex items-center justify-end pr-5 c-pink rounded-2xl"><Trash2 className="w-5 h-5" /></div>
      <div data-row className="relative rounded-2xl p-3 flex gap-3 items-center border hairline" style={{ background: '#0d1535' }}>
        <span className="w-14 h-14 rounded-xl grid place-items-center text-3xl shrink-0" style={{ background: `radial-gradient(circle at 50% 85%, ${tint(p.cat)}, #111a3a 70%)` }}>{p.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{p.name}</div>
          <div className="text-[11px] c-ink3">{p.unit} · {money(p.price)}</div>
          {recipe && <div className="text-[10px] font-bold c-yellow mt-0.5 truncate">{recipe.emoji} набор «{recipe.title}» −{Math.round(recipe.discount * 100)}%</div>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="text-right leading-tight"><div className="font-mono font-bold text-sm">{money(sum - disc)}</div>{disc > 0 && <div className="text-[10px] line-through c-ink3">{money(sum)}</div>}</div>
          <div className="flex items-center gap-1">
            <button onClick={() => { remove(l.key); sfx.whoosh(); }} className="hidden md:grid w-7 h-7 rounded-md place-items-center c-ink3 hover:text-[var(--pink)]" aria-label="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>
            <div className="flex items-center gap-1 rounded-lg bg-black/30 p-0.5">
              <button onClick={() => step(-1)} className="w-7 h-7 rounded-md grid place-items-center hover:bg-white/10" aria-label="Меньше"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-5 text-center text-sm font-bold font-mono">{l.qty}</span>
              <button onClick={() => step(1)} className="w-7 h-7 rounded-md grid place-items-center hover:bg-white/10" aria-label="Больше"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const open = useUi(s => s.cartOpen), set = useUi(s => s.set), toast = useUi(s => s.toast);
  const { lines, setPromo, bonusUse, setBonus, clear } = useCart();
  const user = useSession(s => s.user), delivery = useSession(s => s.profile.delivery.type);
  const cfg = useCatalog(s => s.data?.config);
  const { quote, loading, error } = useQuote(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoErr, setPromoErr] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const promoBox = useRef<HTMLDivElement>(null);
  const close = () => set({ cartOpen: false });

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoErr(''); setChecking(true);
    try {
      const q = await api.post<Quote>('/checkout/quote', { items: lines.map(l => ({ productId: l.productId, qty: l.qty, bundle: l.bundle })), promoCode: code });
      if (q.promoError || !q.promo) throw new Error(q.promoError ?? 'Промокод не найден');
      setPromo(q.promo.code); setPromoInput(''); sfx.success();
      confetti.at(promoBox.current, { count: 140, spread: 80, power: 15 });
      toast({ type: 'ok', title: `Промокод ${q.promo.code} активирован`, msg: q.promo.label });
    } catch (e) {
      setPromoErr((e as Error).message); setShake(true); setTimeout(() => setShake(false), 500); sfx.error();
    } finally { setChecking(false); }
  };
  const freeFrom = delivery === 'np' ? cfg?.npFreeFrom ?? 2000 : cfg?.courierFreeFrom ?? 1000;
  const goods = quote?.goods ?? 0;
  const bonusMax = quote?.bonusMax ?? 0, bonusApplied = quote?.bonusApplied ?? 0;
  const discByKey = new Map<string, number>();
  if (quote) lines.forEach((l, i) => discByKey.set(l.key, quote.lines[i]?.disc ?? 0));

  return (
    <Overlay open={open} onClose={close} label="Корзина" variant="drawer" z={70}>
      <SheetHeader onClose={close} icon={<ShoppingCart className="w-5 h-5 c-lime" />} title={<>Корзина <span className="text-sm c-ink3 font-mono">({lines.reduce((s, l) => s + l.qty, 0)})</span></>}
        extra={lines.length > 0 && <button onClick={() => { clear(); sfx.whoosh(); }} className="text-xs c-ink3 hover:text-[var(--pink)] px-2 py-1 font-bold">Очистить</button>} />
      {!lines.length ? (
        <div className="flex-1 grid place-items-center p-10 text-center">
          <div>
            <div className="text-7xl mb-4 float">🛒</div>
            <div className="font-display font-bold text-lg">Корзина пуста</div>
            <p className="c-ink2 text-sm mt-2">Добавьте товары или соберите блюдо в 1 свайп</p>
            <button onClick={() => { close(); setTimeout(() => document.getElementById('recipes')?.scrollIntoView({ behavior: 'smooth' }), 50); }} className="btn-neon rounded-xl px-5 py-3 mt-5">К рецептам</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto thin-scroll">
            <div className="px-5 pt-4">
              <div className="rounded-2xl bg-black/25 border hairline p-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Truck className="w-4 h-4 c-cyan" />
                  {goods < freeFrom ? <span>До бесплатной доставки ({delivery === 'np' ? 'Новая Почта' : 'курьер'}) — {money(freeFrom - goods)}</span> : <span className="c-lime">Бесплатная доставка разблокирована! 🎉</span>}
                </div>
                <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full rounded-full tr" style={{ background: 'linear-gradient(90deg,var(--cyan),var(--lime))', width: `${Math.min(100, goods / freeFrom * 100)}%` }} /></div>
              </div>
              <div className="text-[11px] c-ink3 mt-2 text-center md:hidden">← свайпните строку влево, чтобы удалить</div>
            </div>
            <div className="px-5 py-3 space-y-2">{lines.map(l => <Line key={l.key} l={l} disc={discByKey.get(l.key) ?? 0} />)}</div>

            <div className="px-5 py-2" ref={promoBox}>
              {quote?.promo ? (
                <div className="rounded-2xl p-3 flex items-center gap-3 ring-neon" style={{ background: 'rgba(198,255,61,.08)' }}>
                  <span className="w-9 h-9 rounded-xl bg-lime grid place-items-center"><BadgePercent className="w-5 h-5" /></span>
                  <div className="flex-1"><div className="font-mono font-bold c-lime text-sm">{quote.promo.code}</div><div className="text-xs c-ink2">{quote.promo.label}</div></div>
                  <button onClick={() => { setPromo(null); sfx.click(); }} className="c-ink3 hover:text-white" aria-label="Убрать промокод"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div>
                  <div className={clsx('flex gap-2', shake && 'shake')}>
                    <div className="relative flex-1">
                      <TicketPercent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 c-ink3" />
                      <input value={promoInput} onChange={e => { setPromoInput(e.target.value); setPromoErr(''); }} onKeyDown={e => { if (e.key === 'Enter') void applyPromo(); }} className={clsx('field !pl-9 font-mono uppercase', promoErr && 'err')} placeholder="ПРОМОКОД" aria-label="Промокод" />
                    </div>
                    <button onClick={() => void applyPromo()} disabled={checking || !promoInput.trim()} className="btn-neon rounded-xl px-4 min-w-[110px] grid place-items-center">{checking ? <Spinner dark /> : 'Применить'}</button>
                  </div>
                  {promoErr && <div className="text-xs c-pink mt-1.5 font-semibold">{promoErr}</div>}
                </div>
              )}
            </div>

            <div className="px-5 py-3">
              <div className="rounded-2xl bg-black/25 border hairline p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold flex items-center gap-2"><Coins className="w-4 h-4 c-yellow" />Списать бонусы</span>
                  <span className="font-mono text-xs c-ink3">{user ? `Баланс: ${fmt(user.bonusBalance)}` : 'после входа'}</span>
                </div>
                {user ? (
                  <>
                    <div className="flex items-center gap-3 mt-3">
                      <input type="range" min={0} max={bonusMax} step={1} value={Math.min(bonusUse, bonusMax)} disabled={!bonusMax} onChange={e => setBonus(+e.target.value)} onPointerUp={() => bonusUse > 0 && sfx.coin()}
                        className="range range-single yellow flex-1" style={{ ['--p' as string]: `${bonusMax ? Math.min(bonusUse, bonusMax) / bonusMax * 100 : 0}%` }} aria-label="Количество бонусов" />
                      <span className="font-mono font-bold c-yellow w-16 text-right">−{fmt(bonusApplied)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-1.5">
                        {[['0', 0], ['½', Math.floor(bonusMax / 2)], ['MAX', bonusMax]].map(([l, v]) => <button key={l} onClick={() => { setBonus(v as number); if (v) sfx.coin(); }} className="text-[10px] font-bold px-2 py-1 rounded-md btn-ghost">{l}</button>)}
                      </div>
                      <span className="text-[10px] c-ink3">1 бонус = 1 ₴ · до {Math.round((cfg?.bonusMaxShare ?? 0.5) * 100)}% чека</span>
                    </div>
                  </>
                ) : <p className="text-xs c-ink3 mt-2">Подтвердите телефон при оформлении — бонусы подтянутся с карты NEON CLUB (+100 новым клиентам).</p>}
              </div>
            </div>
          </div>

          <div className="border-t hairline px-5 pt-4 pb-5 safe-bottom" style={{ background: 'rgba(4,8,22,.6)' }}>
            {error && <div className="text-xs c-pink font-semibold mb-2">{error}</div>}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between c-ink2"><span>Товары</span><span className="font-mono">{quote ? money(quote.subtotal) : '…'}</span></div>
              {!!quote?.bundleDiscount && <div className="flex justify-between c-yellow"><span>Скидка наборов</span><span className="font-mono">−{money(quote.bundleDiscount)}</span></div>}
              {!!quote?.promoDiscount && <div className="flex justify-between c-lime"><span>Промокод {quote.promo?.code}</span><span className="font-mono">−{money(quote.promoDiscount)}</span></div>}
              {!!bonusApplied && <div className="flex justify-between c-yellow"><span>Бонусы</span><span className="font-mono">−{money(bonusApplied)}</span></div>}
              <div className="flex justify-between c-ink2"><span>Доставка</span><span className="font-mono">{quote?.promo?.type === 'delivery' ? <span className="c-lime">бесплатно</span> : 'при оформлении'}</span></div>
            </div>
            <div className="flex items-end justify-between mt-3">
              <div><div className="text-xs c-ink3 flex items-center gap-2">Итого {loading && <Spinner className="!w-3 !h-3" />}</div><div className="font-display font-bold text-2xl">{quote ? money(quote.total) : '…'}</div></div>
              {quote && <div className="text-right text-xs"><div className="c-lime font-bold">+{quote.bonusEarn} бонусов</div></div>}
            </div>
            <button onClick={() => { close(); set({ checkoutOpen: true }); }} disabled={!quote} className="btn-neon w-full rounded-2xl py-4 mt-4 text-base flex items-center justify-center gap-2">Оформить заказ<ArrowRight className="w-5 h-5" /></button>
          </div>
        </>
      )}
    </Overlay>
  );
}
