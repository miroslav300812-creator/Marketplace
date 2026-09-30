import clsx from 'clsx';
import { BadgeCheck, Ban, CreditCard, Download, Navigation, Package, PackageOpen, Printer, Receipt as ReceiptIcon, Repeat, Sparkles, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Barcode } from '../lib/codes';
import { dt, fmt, money } from '../lib/format';
import { sfx } from '../lib/sound';
import { useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Order, Payment } from '../types';
import { PhoneAuth } from './PhoneAuth';
import { Overlay, SheetHeader } from './ui';

export const STATUSES = [
  { id: 'new', label: 'Новый', icon: Sparkles, color: '#22e3ff' },
  { id: 'picking', label: 'Собирается', icon: PackageOpen, color: '#fcee0a' },
  { id: 'transit', label: 'В пути', icon: Truck, color: '#b49bff' },
  { id: 'done', label: 'Выдан', icon: BadgeCheck, color: '#c6ff3d' }
] as const;
export const STATUS_LABEL: Record<string, string> = { awaiting_payment: 'Ожидает оплаты', cancelled: 'Отменён', new: 'Новый', picking: 'Собирается', transit: 'В пути', done: 'Выдан' };
export const DELIVERY_LABEL = { np: 'Новая Почта', courier: 'Курьер NEON', pickup: 'Самовывоз' };

export function OrdersDrawer() {
  const open = useUi(s => s.ordersOpen), set = useUi(s => s.set), toast = useUi(s => s.toast);
  const user = useSession(s => s.user), refresh = useSession(s => s.refresh);
  const add = useCart(s => s.add);
  const byId = useCatalog(s => s.byId);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const close = () => set({ ordersOpen: false });

  useEffect(() => {
    if (!open || !user) return;
    setOrders(null);
    api.get<Order[]>('/orders').then(setOrders).catch(e => { toast({ type: 'err', msg: e.message }); setOrders([]); });
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const repeat = (o: Order) => {
    let n = 0;
    for (const i of o.items) if (i.productId && byId.get(i.productId) && !add(i.productId, i.qty)) n++;
    if (n) { sfx.pop(); toast({ type: 'ok', msg: `${n} позиций добавлено в корзину` }); set({ ordersOpen: false, cartOpen: true }); }
    else { sfx.error(); toast({ type: 'warn', msg: 'Этих товаров сейчас нет в наличии' }); }
  };
  const pay = async (o: Order) => { const r = await api.get<{ order: Order; payment: Payment }>(`/orders/${o.id}`); set({ ordersOpen: false, pay: { order: r.order, payment: r.payment } }); };
  const cancel = async (o: Order) => {
    try { const c = await api.post<Order>(`/orders/${o.id}/cancel`); setOrders(os => os?.map(x => (x.id === o.id ? c : x)) ?? null); void refresh(); sfx.whoosh(); toast({ type: 'info', msg: `Заказ ${o.id} отменён` }); }
    catch (e) { toast({ type: 'err', msg: (e as Error).message }); }
  };

  return (
    <Overlay open={open} onClose={close} label="Мои заказы" variant="drawer" z={90} className="md:w-[480px]">
      <SheetHeader onClose={close} icon={<Package className="w-5 h-5 c-lime" />} title="Мои заказы" />
      <div className="flex-1 overflow-auto thin-scroll p-5 space-y-3">
        {!user && <div><p className="c-ink2 text-sm mb-4">Войдите по номеру телефона, чтобы увидеть свои заказы.</p><PhoneAuth /></div>}
        {user && !orders && [0, 1, 2].map(n => <div key={n} className="glass rounded-3xl p-4"><div className="flex justify-between"><div className="skel h-4 w-28" /><div className="skel h-4 w-16" /></div><div className="skel h-2 w-full mt-5" /><div className="flex gap-2 mt-4"><div className="skel w-10 h-10" /><div className="skel w-10 h-10" /><div className="skel w-10 h-10" /></div></div>)}
        {orders?.map(o => {
          const idx = STATUSES.findIndex(s => s.id === o.status);
          return (
            <div key={o.id} className="glass rounded-3xl p-4 card-in">
              <div className="flex items-center justify-between">
                <div><div className="font-mono font-bold">{o.id}</div><div className="text-xs c-ink3">{dt(o.createdAt)}</div></div>
                <div className="text-right"><div className="font-display font-bold">{money(o.total)}</div><div className="text-[11px] font-bold" style={{ color: STATUSES[idx]?.color ?? (o.status === 'cancelled' ? 'var(--pink)' : 'var(--yellow)') }}>{STATUS_LABEL[o.status]}</div></div>
              </div>
              {idx >= 0 && (
                <div className="mt-4 grid grid-cols-4 gap-1">
                  {STATUSES.map((s, i) => (
                    <div key={s.id}>
                      <div className="h-1.5 rounded-full tr" style={{ background: idx >= i ? s.color : 'rgba(255,255,255,.1)', boxShadow: idx === i ? `0 0 12px ${s.color}` : 'none' }} />
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: idx >= i ? s.color : 'var(--ink-3)' }}><s.icon className="w-3 h-3" /><span className="truncate">{s.label}</span></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">{o.items.map((i, k) => <span key={k} className="w-9 h-9 rounded-lg bg-black/25 grid place-items-center text-lg relative" title={i.name}>{i.emoji}<span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-[var(--lime)] text-black rounded px-1">{i.qty}</span></span>)}</div>
              <div className="text-xs c-ink3 mt-3 truncate">{DELIVERY_LABEL[o.delivery.type]}: {o.delivery.label}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {o.status === 'awaiting_payment' && <button onClick={() => pay(o)} className="btn-neon rounded-xl px-3 py-2 text-xs flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />Оплатить</button>}
                <button onClick={() => set({ receipt: o, ordersOpen: false })} className="btn-ghost rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5"><ReceiptIcon className="w-3.5 h-3.5" />Чек</button>
                <button onClick={() => repeat(o)} className="btn-ghost rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" />Повторить</button>
                {['awaiting_payment', 'new'].includes(o.status) && <button onClick={() => cancel(o)} className="btn-ghost rounded-xl px-3 py-2 text-xs font-bold c-pink flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" />Отменить</button>}
              </div>
            </div>
          );
        })}
        {orders && !orders.length && <div className="text-center py-16"><div className="text-6xl mb-3">📦</div><div className="font-bold">Заказов пока нет</div><p className="c-ink2 text-sm mt-1">Оформите первый — статусы будут обновляться здесь</p></div>}
      </div>
    </Overlay>
  );
}

function receiptText(o: Order) {
  const L = ['NEON MARKET', '-'.repeat(38), `Чек ${o.id}   ${dt(o.createdAt)}`, '-'.repeat(38)];
  o.items.forEach(i => L.push(i.name, `  ${i.qty} x ${i.price} = ${fmt(i.qty * i.price)} ₴`));
  L.push('-'.repeat(38), `Сумма: ${money(o.subtotal)}`);
  if (o.bundleDiscount) L.push(`Скидка наборов: −${money(o.bundleDiscount)}`);
  if (o.promoDiscount) L.push(`Промокод ${o.promoCode}: −${money(o.promoDiscount)}`);
  if (o.bonusSpent) L.push(`Бонусы: −${money(o.bonusSpent)}`);
  L.push(`Доставка (${DELIVERY_LABEL[o.delivery.type]}): ${money(o.delivery.cost)}`, `ИТОГО: ${money(o.total)}`, `Бонусы к начислению: +${o.bonusEarned}`, '-'.repeat(38));
  L.push(o.paymentStatus === 'paid' ? `Оплата LiqPay · ${o.paymentMask ?? o.paymentMethod} · TX ${o.paymentTx}` : 'Оплата при получении', 'Спасибо за покупку!');
  return L.join('\n');
}

export function Receipt() {
  const o = useUi(s => s.receipt), set = useUi(s => s.set);
  if (!o) return null;
  const close = () => set({ receipt: null });
  const row = (l: string, v: string, cls = '') => <div className={clsx('flex justify-between', cls)}><span>{l}</span><span>{v}</span></div>;
  return (
    <Overlay open onClose={close} label="Чек" z={120} className="md:max-w-[420px] !bg-transparent !border-0 !shadow-none !backdrop-blur-none p-4">
      <div className="text-center mb-4"><div className="font-display font-black text-2xl">{o.paymentStatus === 'pending' ? 'Заказ создан' : 'Заказ оформлен! 🎉'}</div><div className="c-ink2 text-sm mt-1">{DELIVERY_LABEL[o.delivery.type]} · {o.delivery.eta || 'скоро'}</div></div>
      <div id="receipt-print" className="receipt rounded-t-2xl px-5 pt-6 pb-6 text-[12px] leading-relaxed">
        <div className="text-center"><div className="font-bold text-base tracking-widest">NEON·MARKET</div><div className="text-[10px] text-[#666]">Кассовый чек (электронная копия)</div></div>
        <div className="dash my-3" />
        {row(`Чек ${o.id}`, dt(o.createdAt))}
        <div className="dash my-3" />
        {o.items.map((i, k) => <div key={k} className="mb-1.5"><div>{i.emoji} {i.name}</div>{row(`  ${i.qty} × ${fmt(i.price)}`, fmt(i.qty * i.price) + ' ₴', 'text-[#555]')}</div>)}
        <div className="dash my-3" />
        {row('Сумма', money(o.subtotal))}
        {o.bundleDiscount > 0 && row('Скидка наборов', '−' + money(o.bundleDiscount))}
        {o.promoDiscount > 0 && row(`Промокод ${o.promoCode}`, '−' + money(o.promoDiscount))}
        {o.bonusSpent > 0 && row('Оплачено бонусами', '−' + money(o.bonusSpent))}
        {row('Доставка', money(o.delivery.cost))}
        <div className="dash my-3" />
        {row('ИТОГО', money(o.total), 'font-bold text-base')}
        {row(o.bonusCredited ? 'Начислено бонусов' : 'Бонусы к начислению', '+' + o.bonusEarned, 'text-[#2d7a00] font-bold')}
        <div className="dash my-3" />
        <div className="text-[11px] text-[#555]">
          <div>{o.paymentStatus === 'paid' ? `Оплата: LiqPay · ${o.paymentMask ?? o.paymentMethod}` : o.paymentStatus === 'cod' ? 'Оплата при получении' : `Статус оплаты: ${o.paymentStatus}`}</div>
          {o.paymentTx && <div>TX: {o.paymentTx}</div>}
          <div className="mt-1">Получатель: {o.customer.name}, {o.customer.phone}</div>
          <div>{o.delivery.label}</div>
        </div>
        <div className="mt-4 px-4"><Barcode code={o.id.replace(/\D/g, '').padEnd(12, '0')} h={40} color="#1b1b1b" /></div>
      </div>
      <div className="h-3" />
      <div className="grid grid-cols-3 gap-2 mt-4">
        <button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([receiptText(o)], { type: 'text/plain;charset=utf-8' })); a.download = `receipt-${o.id}.txt`; a.click(); sfx.click(); }} className="btn-ghost rounded-xl py-3 text-xs font-bold flex flex-col items-center gap-1"><Download className="w-4 h-4" />Скачать</button>
        <button onClick={() => print()} className="btn-ghost rounded-xl py-3 text-xs font-bold flex flex-col items-center gap-1"><Printer className="w-4 h-4" />Печать</button>
        <button onClick={() => set({ receipt: null, ordersOpen: true })} className="btn-ghost rounded-xl py-3 text-xs font-bold flex flex-col items-center gap-1"><Navigation className="w-4 h-4" />Отследить</button>
      </div>
      <button onClick={close} className="btn-neon w-full rounded-2xl py-3.5 mt-2">Продолжить покупки</button>
    </Overlay>
  );
}
