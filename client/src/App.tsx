import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { Toasts } from './components/Toasts';
import Shop from './pages/Shop';
import { useCatalog } from './store/catalog';
import { useSession } from './store/session';
import { useUi } from './store/ui';

const Admin = lazy(() => import('./pages/admin/Admin'));

export default function App() {
  const load = useCatalog(s => s.load), refresh = useSession(s => s.refresh);
  const nav = useNavigate();

  useEffect(() => { void load(); void refresh(); }, [load, refresh]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); nav(location.pathname.startsWith('/admin') ? '/' : '/admin'); return; }
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        const el = [...document.querySelectorAll<HTMLInputElement>('[data-search]')].find(x => x.offsetParent);
        if (el) { e.preventDefault(); el.focus(); }
        return;
      }
      if (e.key !== 'Escape') return;
      const s = useUi.getState();
      const order: (keyof typeof s)[] = ['receipt', 'productId', 'loyaltyOpen', 'ordersOpen', 'profileOpen', 'checkoutOpen', 'cartOpen', 'filtersOpen'];
      for (const k of order) if (s[k]) { s.set({ [k]: k === 'receipt' ? null : k === 'productId' ? null : false }); return; }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [nav]);

  return (
    <>
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={<div className="min-h-screen grid place-items-center c-ink3">Загрузка…</div>}><Admin /></Suspense>} />
        <Route path="*" element={<Shop />} />
      </Routes>
      <Toasts />
    </>
  );
}
