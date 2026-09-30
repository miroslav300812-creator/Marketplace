import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CartDrawer } from '../components/CartDrawer';
import { Catalog } from '../components/Catalog';
import { Checkout } from '../components/checkout/Checkout';
import { Dock, Spotlight } from '../components/Header';
import { Hero, Recipes } from '../components/Home';
import { Checklist, Footer } from '../components/Layout';
import { LoyaltyModal } from '../components/Loyalty';
import { OrdersDrawer, Receipt } from '../components/Orders';
import { PaymentModal } from '../components/PaymentModal';
import { ProductModal } from '../components/ProductModal';
import { ProfileSheet } from '../components/Profile';
import { confetti } from '../lib/confetti';
import { useSession } from '../store/session';
import { useAnyOverlay, useUi } from '../store/ui';
import type { Order } from '../types';

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
      <div className="liquid" aria-hidden><i /><i /><i /><i /></div>
      <div className="grain" aria-hidden />
      <Dock />
      <main className="relative z-10 pb-32 md:pb-10">
        {mode === 'shop' ? <div className="fade-in"><Hero /><Recipes /><Catalog /></div> : <Checklist />}
      </main>
      <Footer />
      <Spotlight />
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
