import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, Clock, CreditCard, DatabaseBackup, HandCoins, Lock, MapPin, Smartphone, UserRound, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { money } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { useCart } from '../../store/cart';
import { useCatalog } from '../../store/catalog';
import { deliveryPayload, useQuote } from '../../store/quote';
import { useSession } from '../../store/session';
import { useUi } from '../../store/ui';
import type { Order, Payment, PayMethod } from '../../types';
import { DELIVERY_LABEL } from '../Orders';
import { PhoneAuth } from '../PhoneAuth';
import { CloseBtn, Field, Overlay, Spinner } from '../ui';
import { DeliveryStep } from './Delivery';

const METHODS: [PayMethod, typeof CreditCard, string, string][] = [
  ['card', CreditCard, 'Картой онлайн', 'LiqPay · Visa / Mastercard'],
  ['apple', Smartphone, 'Apple Pay', 'через LiqPay'],
  ['google', Wallet, 'Google Pay', 'через LiqPay'],
  ['cash', HandCoins, 'При получении', 'наличными или картой']
];

/** Posts the signed LiqPay form so the customer lands on LiqPay's hosted checkout. */
function redirectToLiqpay(p: { url: string; data: string; signature: string }) {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = p.url; f.acceptCharset = 'utf-8';
  for (const [k, v] of Object.entries({ data: p.data, signature: p.signature })) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
  document.body.appendChild(f); f.submit();
}

export function Checkout() {
  const open = useUi(s => s.checkoutOpen), set = useUi(s => s.set), toast = useUi(s => s.toast);
  const { user, profile, setProfile, refresh } = useSession();
  const { lines, promoCode, bonusUse, clear } = useCart();
  const patchStock = useCatalog(s => s.patchStock);
  const { quote, error, loading } = useQuote(true);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [restored, setRestored] = useState(false);
  const close = () => set({ checkoutOpen: false });

  useEffect(() => {
    if (!open) return;
    setStep(1); setErrors({});
    if (profile.name || profile.phone) { setRestored(true); sfx.success(); const t = setTimeout(() => setRestored(false), 3200); return () => clearTimeout(t); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !lines.length) close(); }, [open, lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (profile.name.trim().length < 2) e.name = 'Укажите имя и фамилию';
      if (profile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) e.email = 'Некорректный e-mail';
      if (!user) e.phone = 'Подтвердите номер кодом из SMS';
    }
    if (s === 2) {
      const d = profile.delivery;
      if (d.type === 'np') { if (!d.np.cityRef) e.city = 'Выберите город'; else if (!d.np.whRef) e.wh = 'Выберите отделение или почтомат'; }
      if (d.type === 'courier') { if (d.courier.x == null) e.pin = 'Отметьте точку доставки на карте'; if (d.courier.address.trim().length < 3) e.address = 'Укажите адрес'; }
      if (d.type === 'pickup' && !d.storeId) e.store = 'Выберите супермаркет';
      if (!e.pin && error) e.pin = error;
    }
    setErrors(e);
    return !Object.keys(e).length;
  };
  const go = (s: number) => {
    if (s < step) { setStep(s); sfx.click(); return; }
    for (let i = step; i < s; i++) if (!validate(i)) { setStep(i); sfx.error(); return; }
    setStep(s); sfx.click();
  };

  const place = async () => {
    const delivery = deliveryPayload(profile.delivery);
    if (!delivery || !validate(1) || !validate(2)) { sfx.error(); return; }
    setPlacing(true);
    try {
      const r = await api.post<{ order: Order; payment: Payment }>('/orders', {
        items: lines.map(l => ({ productId: l.productId, qty: l.qty, bundle: l.bundle })),
        promoCode, bonusUse, delivery, payMethod: profile.payMethod, customer: { name: profile.name, email: profile.email }
      });
      patchStock(r.order.items);
      clear();
      void api.patch('/me', { name: profile.name, email: profile.email, prefs: { delivery: profile.delivery, payMethod: profile.payMethod } }).catch(() => undefined);
      void refresh();
      set({ checkoutOpen: false });
      if (r.payment?.provider === 'liqpay') { redirectToLiqpay(r.payment); return; }
      if (r.payment?.provider === 'mock') { set({ pay: { order: r.order, payment: r.payment } }); return; }
      if (r.order.bonusSpent) sfx.coins();
      set({ receipt: r.order });
    } catch (e) {
      sfx.error(); toast({ type: 'err', title: 'Не удалось оформить заказ', msg: (e as Error).message });
    } finally { setPlacing(false); }
  };
  const next = () => { if (step < 3) { if (validate(step)) { setStep(step + 1); sfx.click(); } else sfx.error(); } else void place(); };
  const d = quote?.delivery;

  return (
    <Overlay open={open} onClose={close} label="Оформление заказа" z={100} className="md:max-w-6xl !h-[96vh] md:!h-auto flex flex-col" closeOnBackdrop={false}>
      <div className="px-5 md:px-8 pt-5 pb-4 border-b hairline">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display font-bold text-xl">Оформление заказа</h3>
          <div className="flex items-center gap-2">
            {restored && <span className="fade-in flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full c-cyan" style={{ background: 'rgba(34,227,255,.1)', boxShadow: '0 0 0 1px rgba(34,227,255,.5),0 0 20px -4px rgba(34,227,255,.7)' }}><DatabaseBackup className="w-3.5 h-3.5" />Данные восстановлены</span>}
            <CloseBtn onClick={close} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['Контакты', 'Доставка', 'Оплата'].map((s, i) => (
            <button key={s} onClick={() => go(i + 1)} className="text-left" aria-current={step === i + 1 ? 'step' : undefined}>
              <div className={clsx('h-1.5 rounded-full tr', step > i + 1 ? 'bg-[var(--lime)]' : step === i + 1 ? 'bg-[var(--lime)] shadow-[0_0_14px_rgba(198,255,61,.8)]' : 'bg-white/10')} />
              <div className={clsx('mt-2 text-xs font-bold flex items-center gap-1.5', step >= i + 1 ? 'text-white' : 'c-ink3')}>
                <span className={clsx('w-5 h-5 rounded-full grid place-items-center text-[10px]', step > i + 1 ? 'bg-lime' : 'border border-white/20')}>{step > i + 1 ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}</span>{s}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto thin-scroll">
        <div className="grid md:grid-cols-[1fr_360px]">
          <div className="p-5 md:p-8 min-w-0">
            {step === 1 && (
              <div className="fade-in">
                <h4 className="font-display font-bold text-lg mb-4">Контактные данные</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Имя и фамилия" error={errors.name}><input value={profile.name} onChange={e => setProfile({ name: e.target.value })} className={clsx('field', errors.name && 'err', restored && profile.name && 'restored')} placeholder="Тарас Шевченко" autoComplete="name" /></Field>
                  <Field label="E-mail для чека (необязательно)" error={errors.email}><input value={profile.email} onChange={e => setProfile({ email: e.target.value })} type="email" className={clsx('field', errors.email && 'err', restored && profile.email && 'restored')} placeholder="you@mail.com" autoComplete="email" /></Field>
                </div>
                <div className="mt-4"><PhoneAuth error={errors.phone} restored={restored} /></div>
              </div>
            )}
            {step === 2 && <div className="fade-in"><DeliveryStep errors={errors} restored={restored} quote={quote} /></div>}
            {step === 3 && (
              <div className="fade-in">
                <h4 className="font-display font-bold text-lg mb-4">Способ оплаты</h4>
                <div className="grid sm:grid-cols-2 gap-2" role="radiogroup">
                  {METHODS.map(([id, Icon, t, sub]) => (
                    <button key={id} role="radio" aria-checked={profile.payMethod === id} onClick={() => { setProfile({ payMethod: id }); sfx.click(); }} className={clsx('rounded-2xl p-4 text-left border flex items-center gap-3 tr', profile.payMethod === id ? 'ring-neon border-transparent bg-[rgba(198,255,61,.08)]' : 'hairline bg-black/20 hover:bg-white/5')}>
                      <span className={clsx('w-11 h-11 rounded-xl grid place-items-center', profile.payMethod === id ? 'bg-lime' : 'bg-white/5 c-ink2')}><Icon className="w-5 h-5" /></span>
                      <span><span className="block font-bold text-sm">{t}</span><span className="block text-[11px] c-ink3">{sub}</span></span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl p-4 bg-black/20 border hairline text-sm space-y-2 c-ink2">
                  <div className="flex items-center gap-2"><UserRound className="w-4 h-4 c-lime" />{profile.name} · {user?.phone}</div>
                  <div className="flex items-start gap-2"><MapPin className="w-4 h-4 c-lime mt-0.5 shrink-0" />{DELIVERY_LABEL[profile.delivery.type]}: {d?.label ?? '—'}</div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 c-lime" />Ожидаемое время: {d?.eta ?? '—'}</div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] c-ink3"><Lock className="w-3.5 h-3.5" />Оплата проходит на стороне LiqPay (3-D Secure). Данные карты не попадают на наш сервер.</div>
              </div>
            )}
          </div>

          <aside className="p-5 md:p-6 border-t md:border-t-0 md:border-l hairline" style={{ background: 'rgba(4,8,22,.45)' }}>
            <div className="font-bold text-sm mb-3 flex items-center justify-between"><span>Ваш заказ</span><span className="c-ink3 font-mono text-xs">{lines.reduce((s, l) => s + l.qty, 0)} шт.</span></div>
            <div className="space-y-2 max-h-48 overflow-auto thin-scroll pr-1">
              {quote?.lines.map((l, i) => <div key={i} className="flex items-center gap-2.5 text-sm"><span className="text-xl">{l.emoji}</span><span className="flex-1 min-w-0 truncate c-ink2">{l.name} × {l.qty}</span><span className="font-mono text-xs">{money(l.sum - l.disc)}</span></div>)}
            </div>
            <div className="glow-line my-4" />
            {quote ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between c-ink2"><span>Товары</span><span className="font-mono">{money(quote.subtotal)}</span></div>
                {quote.bundleDiscount > 0 && <div className="flex justify-between c-yellow"><span>Скидка наборов</span><span className="font-mono">−{money(quote.bundleDiscount)}</span></div>}
                {quote.promoDiscount > 0 && <div className="flex justify-between c-lime"><span>Промокод {quote.promo?.code}</span><span className="font-mono">−{money(quote.promoDiscount)}</span></div>}
                {quote.bonusApplied > 0 && <div className="flex justify-between c-yellow"><span>Бонусы</span><span className="font-mono">−{money(quote.bonusApplied)}</span></div>}
                <div className="flex justify-between c-ink2"><span>Доставка</span><span className={clsx('font-mono', d?.cost === 0 && 'c-lime')}>{!d ? '—' : d.cost === 0 ? 'бесплатно' : money(d.cost)}</span></div>
              </div>
            ) : <div className="space-y-2">{[0, 1, 2].map(n => <div key={n} className="skel h-4" />)}</div>}
            {error && step > 1 && <div className="text-xs c-pink font-semibold mt-2">{error}</div>}
            <div className="flex items-end justify-between mt-4">
              <div><div className="text-xs c-ink3 flex items-center gap-2">К оплате {loading && <Spinner className="!w-3 !h-3" />}</div><div className="font-display font-bold text-3xl">{quote ? money(quote.total) : '…'}</div></div>
              {quote && <div className="text-right text-xs font-bold c-lime">+{quote.bonusEarn} бонусов</div>}
            </div>
            <div className="mt-5 flex gap-2">
              {step > 1 && <button onClick={() => { setStep(step - 1); sfx.click(); }} className="btn-ghost rounded-2xl w-14 grid place-items-center" aria-label="Назад"><ArrowLeft className="w-5 h-5" /></button>}
              <button onClick={next} disabled={placing || (step === 3 && (!quote || !d || loading))} className="btn-neon flex-1 rounded-2xl py-4 flex items-center justify-center gap-2">
                {placing ? <Spinner dark /> : <>{step < 3 ? 'Далее' : profile.payMethod === 'cash' ? `Подтвердить · ${money(quote?.total ?? 0)}` : `Оплатить ${money(quote?.total ?? 0)}`}<ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </Overlay>
  );
}
