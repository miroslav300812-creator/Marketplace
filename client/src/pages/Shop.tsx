import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CartDrawer } from '../components/CartDrawer';
import { Catalog } from '../components/Catalog';
import { Checkout } from '../components/checkout/Checkout';
import { Header } from '../components/Header';
import { Categories, Hero, Recipes } from '../components/Home';
import { Checklist, Footer, MobileNav } from '../components/Layout';
import { LoyaltyModal } from '../components/Loyalty';
import { OrdersDrawer, Receipt } from '../components/Orders';
import { PaymentModal } from '../components/PaymentModal';
import { ProductModal } from '../components/ProductModal';
import { ProfileSheet } from '../components/Profile';
import { confetti } from '../lib/confetti';
import { useSession } from '../store/session';
import { useAnyOverlay, useUi } from '../store/ui';
import type { Order } from '../types';

const TICKER = [
  ['⚡ Доставка за ', '30 минут', ' в радиусе 3 км', 'c-lime'], ['🎟️ Промокод ', 'EXTRA20', ' — −20% на всё', 'c-yellow'],
  ['🚚 ', 'FREE_DELIVERY', ' — бесплатная доставка', 'c-cyan'], ['💎 Кэшбэк до ', '10%', ' бонусами NEON CLUB', 'c-lime'],
  ['🍔 Соберите блюдо в 1 свайп — скидка до ', '15%', '', 'c-pink'], ['🎁 ', 'NEON100', ' — −100 ₴ от 500 ₴', 'c-yellow']
];

export default function Shop() {
  const mode = useUi(s => s.mode), set = useUi(s => s.set);
  const overlay = useAnyOverlay();
  const loc = useLocation(), nav = useNavigate();
  const refresh = useSession(s => s.refresh);

  useEffect(() => { document.body.classList.toggle('lock', overlay); }, [overlay]);

  // Return from LiqPay hosted checkout: /orders?paid=NM-XXXX
  useEffect(() => {
    if (loc.pathname !== '/orders') return;
    const id = new URLSearchParams(loc.search).get('paid');
    nav('/', { replace: true });
    if (!id) { set({ ordersOpen: true }); return; }
    void refresh();
    api.get<{ order: Order }>(`/orders/${id}`).then(r => {
      if (r.order.paymentStatus === 'paid') { set({ receipt: r.order }); confetti.rain(); }
      else set({ ordersOpen: true });
    }).catch(() => set({ ordersOpen: true }));
  }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="aurora" aria-hidden><span /><span /><span /></div>
      <div className="gridbg" aria-hidden />
      <div className="relative z-10 overflow-hidden border-b hairline bg-black/30 text-[12px] font-semibold" aria-hidden>
        <div className="marquee py-1.5 c-ink2">
          {[0, 1].map(n => <div key={n} className="flex gap-12 pr-12 whitespace-nowrap">{TICKER.map(([a, b, c, cls]) => <span key={b}>{a}<b className={cls}>{b}</b>{c}</span>)}</div>)}
        </div>
      </div>
      <Header />
      <main className="relative z-10 pb-28 md:pb-10">
        {mode === 'shop' ? <div className="fade-in"><Hero /><Categories /><Recipes /><Catalog /></div> : <Checklist />}
      </main>
      <Footer />
      <MobileNav />
      <CartDrawer />
      <ProductModal />
      <LoyaltyModal />
      <Checkout />
      <PaymentModal />
      <Receipt />
      <OrdersDrawer />
      <ProfileSheet />
    </>
  );
}
