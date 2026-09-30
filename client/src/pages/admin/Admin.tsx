import clsx from 'clsx';
import { Activity, Banknote, Boxes, Check, ChevronsRight, ClipboardList, Coins, Download, LayoutDashboard, LogOut, MessageSquareText, Plus, Receipt, ShoppingBag, Store, Terminal, Trash2, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, tokens } from '../../api';
import { STATUS_LABEL } from '../../components/Orders';
import { Spinner, Stars } from '../../components/ui';
import { dt, fmt, money, timeAgo } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { useCatalog } from '../../store/catalog';
import { useUi } from '../../store/ui';
import type { Order, Product, Review } from '../../types';

type Stats = {
  count: number; revenue: number; avg: number; bonusSpent: number; bonusEarned: number;
  hourly: { h: number; rev: number; n: number }[]; top: { productId: number; name: string; emoji: string; qty: number; rev: number }[];
  byStatus: { status: string; n: number }[]; lowStock: Product[]; pendingReviews: number;
};
const STATUS_COLORS: Record<string, string> = { awaiting_payment: 'var(--ice)', new: 'var(--ink-3)', picking: 'var(--ink-2)', transit: 'var(--ink-2)', done: 'var(--ink)', cancelled: 'var(--danger)' };
const FLOW = ['new', 'picking', 'transit', 'done'];
const toastErr = (e: unknown) => { sfx.error(); useUi.getState().toast({ type: 'err', msg: (e as Error).message }); };

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { tokens.admin = (await api.post<{ token: string }>('/admin/login', { password: pw })).token; sfx.success(); onDone(); }
    catch (e) { setErr((e as Error).message); sfx.error(); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={e => { e.preventDefault(); void submit(); }} className="panel rounded-[30px] p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-5"><span className="w-10 h-10 rounded-[16px] grid place-items-center bg-lime"><Terminal className="w-5 h-5" /></span><div><div className="font-display">NEON Admin</div><div className="text-xs c-ink3">Вход для персонала</div></div></div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} className={clsx('field', err && 'err')} placeholder="Пароль администратора" autoFocus autoComplete="current-password" aria-label="Пароль" />
        {err && <div className="text-xs c-pink font-semibold mt-2">{err}</div>}
        <button disabled={busy || !pw} className="btn-neon w-full rounded-full py-3 mt-4 grid place-items-center">{busy ? <Spinner dark /> : 'Войти'}</button>
        <Link to="/" className="block text-center text-xs c-ink3 hover:text-[var(--ink)] mt-4">← В магазин</Link>
      </form>
    </div>
  );
}

function Chart({ hourly }: { hourly: Stats['hourly'] }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const W = 720, H = 230, L = 52, B = 26, T = 12, R = 8;
  const maxRaw = Math.max(...hourly.map(h => h.rev), 100);
  const mag = Math.pow(10, Math.floor(Math.log10(maxRaw)));
  const step = mag * (maxRaw / mag > 5 ? 2 : 1), max = Math.ceil(maxRaw / step) * step;
  const bw = (W - L - R) / 24, ph = H - T - B;
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const t = (e.target as Element).closest('[data-i]');
    if (!t) { setHover(null); return; }
    const box = e.currentTarget.getBoundingClientRect();
    setHover({ i: +t.getAttribute('data-i')!, x: Math.min(box.width - 70, Math.max(70, e.clientX - box.left)), y: e.clientY - box.top });
  };
  const hv = hover ? hourly[hover.i] : null;
  return (
    <div className="relative mt-4" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Выручка по часам за сегодня">
        {[0, 1, 2, 3, 4].map(i => { const v = max * i / 4, y = T + ph - ph * i / 4; return <g key={i}><line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--ink)" strokeOpacity={i ? 0.06 : 0.16} /><text x={L - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-3)" fontFamily="Geist Mono, monospace">{v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : Math.round(v)}</text></g>; })}
        {hourly.map((h, i) => {
          const x = L + i * bw + 1, w = bw - 2, bh = h.rev ? Math.max(3, ph * h.rev / max) : 0, y = T + ph - bh, r = Math.min(4, w / 2, bh);
          const active = hover?.i === i;
          return (
            <g key={i}>
              {bh > 0 && <path d={`M${x} ${T + ph} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${T + ph} Z`} fill="var(--ink)" opacity={hover && !active ? 0.3 : active ? 1 : 0.75} />}
              <rect data-i={i} x={L + i * bw} y={T} width={bw} height={ph} fill="transparent" />
              {i % 3 === 0 && <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-3)" fontFamily="Geist Mono, monospace">{String(h.h).padStart(2, '0')}</text>}
            </g>
          );
        })}
      </svg>
      {hover && hv && (
        <div className="absolute pointer-events-none -translate-x-1/2 -translate-y-full panel rounded-[16px] px-3 py-2 text-xs shadow-2xl whitespace-nowrap" style={{ left: hover.x, top: hover.y - 12 }}>
          <div className="font-mono c-ink3">{String(hv.h).padStart(2, '0')}:00–{String(hv.h).padStart(2, '0')}:59</div>
          <div className="font-medium">{money(hv.rev)}</div><div className="c-ink3">{hv.n} заказ(ов)</div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const integrations = useCatalog(x => x.data?.config.integrations);
  useEffect(() => { api.admin.get<Stats>('/admin/stats').then(setS).catch(toastErr); }, []);
  const kpis: [string, string, typeof Banknote, string][] = s ? [['Выручка сегодня', money(s.revenue), Banknote, 'c-lime'], ['Средний чек', money(s.avg), Receipt, 'c-cyan'], ['Заказов сегодня', String(s.count), ShoppingBag, 'c-violet'], ['Списано бонусов', fmt(s.bonusSpent), Coins, 'c-yellow']] : [];
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(s ? kpis : Array.from({ length: 4 }, () => null)).map((k, i) => (
          <div key={i} className="glass rounded-[30px] p-4">
            {k ? <><div className="flex items-center justify-between text-xs c-ink3 font-medium"><span>{k[0]}</span>{(() => { const I = k[2]; return <I className={clsx('w-4 h-4', k[3])} />; })()}</div><div className="font-display text-2xl sm:text-3xl mt-2">{k[1]}</div></> : <><div className="skel h-3 w-1/2" /><div className="skel h-8 w-2/3 mt-3" /></>}
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 mt-4">
        <div className="glass rounded-[30px] p-5">
          <div className="flex items-center justify-between"><div><div className="font-medium">Выручка по часам, ₴</div><div className="text-xs c-ink3">Сегодня · наведите на столбец</div></div>{s && <div className="text-xs c-ink3 font-mono">начислено бонусов: +{fmt(s.bonusEarned)}</div>}</div>
          {s ? <Chart hourly={s.hourly} /> : <div className="skel w-full aspect-[720/230] mt-4" />}
        </div>
        <div className="glass rounded-[30px] p-5">
          <div className="font-medium">Топ товаров сегодня</div>
          <div className="mt-4 space-y-3">
            {s?.top.map(t => <div key={t.productId}><div className="flex items-center gap-2 text-sm"><span>{t.emoji}</span><span className="flex-1 truncate">{t.name}</span><span className="font-mono text-xs c-ink2">{money(t.rev)}</span></div><div className="h-1.5 rounded-full bg-[var(--track)] mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${t.rev / (s.top[0]?.rev || 1) * 100}%` }} /></div></div>)}
            {s && !s.top.length && <div className="text-sm c-ink3">Сегодня продаж ещё не было</div>}
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="glass rounded-[30px] p-5">
          <div className="font-medium mb-3">Заказы по статусам</div>
          {s?.byStatus.map(b => <div key={b.status} className="flex items-center gap-3 py-2 border-b hairline last:border-0 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[b.status] }} /><span className="flex-1">{STATUS_LABEL[b.status]}</span><span className="font-mono font-medium">{b.n}</span></div>)}
        </div>
        <div className="glass rounded-[30px] p-5">
          <div className="font-medium mb-3 flex items-center gap-2"><TriangleAlert className="w-4 h-4 c-yellow" />Заканчиваются</div>
          {s?.lowStock.map(p => <div key={p.id} className="flex items-center gap-3 py-2 border-b hairline last:border-0 text-sm"><span>{p.emoji}</span><span className="flex-1 truncate">{p.name}</span><span className={clsx('font-mono font-medium', p.stock ? 'c-yellow' : 'c-pink')}>{p.stock} шт</span></div>)}
          {s && !s.lowStock.length && <div className="text-sm c-ink3">Все позиции в достатке</div>}
        </div>
        <div className="glass rounded-[30px] p-5">
          <div className="font-medium mb-3 flex items-center gap-2"><Activity className="w-4 h-4 c-cyan" />Интеграции</div>
          {([['LiqPay', integrations?.liqpay], ['Новая Почта', integrations?.novaposhta], ['SMS Fly', integrations?.sms]] as const).map(([n, on]) => (
            <div key={n} className="flex items-center gap-3 py-2 border-b hairline last:border-0 text-sm"><span className={clsx('pulse-dot', !on && '!bg-[var(--yellow)]')} /><span className="flex-1">{n}</span><span className={clsx('text-xs font-medium', on ? 'c-lime' : 'c-yellow')}>{on ? 'подключено' : 'мок (нет ключа)'}</span></div>
          ))}
          {s && <div className="mt-3 text-xs c-ink3">Отзывов на модерации: {s.pendingReviews}</div>}
        </div>
      </div>
    </div>
  );
}

const emptyForm = { name: '', cat: 'veg', price: '', old: '', stock: '20', emoji: '🍏', badge: '', tags: '', country: 'Украина', kcal: '100', unit: '1 шт' };

function Products() {
  const cats = useCatalog(s => s.data?.categories ?? []), reload = useCatalog(s => s.load);
  const toast = useUi(s => s.toast);
  const [list, setList] = useState<Product[] | null>(null);
  const [form, setForm] = useState(emptyForm), [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<number | null>(null);
  const load = useCallback(() => api.admin.get<Product[]>('/admin/products').then(setList).catch(toastErr), []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setErr('');
    try {
      await api.admin.post('/admin/products', { name: form.name, cat: form.cat, price: +form.price, old: form.old ? +form.old : null, stock: +form.stock || 0, emoji: form.emoji || '🛒', badge: form.badge, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), country: form.country, kcal: +form.kcal || 0, unit: form.unit });
      toast({ type: 'ok', msg: `Товар «${form.name}» добавлен` }); sfx.success(); setForm(emptyForm); void load(); void reload();
    } catch (e) { setErr((e as Error).message); sfx.error(); }
  };
  const patch = async (p: Product, body: Partial<Record<'price' | 'old' | 'stock' | 'badge', unknown>>) => {
    try { const u = await api.admin.patch<Product>(`/admin/products/${p.id}`, body); setList(l => l?.map(x => (x.id === p.id ? u : x)) ?? null); sfx.click(); void reload(); }
    catch (e) { toastErr(e); void load(); }
  };
  const del = async (p: Product) => {
    if (confirm !== p.id) { setConfirm(p.id); setTimeout(() => setConfirm(c => (c === p.id ? null : c)), 3000); return; }
    try { await api.admin.del(`/admin/products/${p.id}`); setList(l => l?.filter(x => x.id !== p.id) ?? null); sfx.whoosh(); toast({ type: 'warn', msg: `«${p.name}» снят с продажи` }); void reload(); } catch (e) { toastErr(e); }
  };
  const F = (k: keyof typeof emptyForm, props: Record<string, unknown> = {}) => <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="field" {...props} />;

  return (
    <div>
      <div className="glass rounded-[30px] p-5">
        <div className="font-medium mb-4 flex items-center gap-2"><Plus className="w-5 h-5 c-lime" />Новый товар</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {F('emoji', { className: 'field text-center text-xl', maxLength: 4, 'aria-label': 'Эмодзи' })}
          <div className="md:col-span-2">{F('name', { placeholder: 'Название' })}</div>
          <select value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} className="field">{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          {F('price', { type: 'number', min: 1, placeholder: 'Цена ₴' })}
          {F('old', { type: 'number', min: 0, placeholder: 'Старая цена' })}
          {F('stock', { type: 'number', min: 0, placeholder: 'Склад' })}
          {F('unit', { placeholder: '1 шт' })}
          {F('country', { placeholder: 'Страна' })}
          {F('kcal', { type: 'number', min: 0, placeholder: 'ккал' })}
          <select value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} className="field"><option value="">Без бейджа</option><option>Хит</option><option>Sale</option><option>New</option></select>
          {F('tags', { placeholder: 'теги: веган, био' })}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={add} disabled={!form.name || !form.price} className="btn-neon rounded-full px-5 py-3 flex items-center gap-2"><Plus className="w-4 h-4" />Добавить</button>
          {err && <span className="text-sm c-pink font-semibold">{err}</span>}
        </div>
      </div>
      <div className="glass rounded-[30px] mt-4 overflow-x-auto thin-scroll">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="text-xs c-ink3 text-left"><tr className="border-b hairline"><th className="p-3 pl-5">Товар</th><th className="p-3">Цена ₴</th><th className="p-3">Старая ₴</th><th className="p-3">Склад</th><th className="p-3">Бейдж</th><th className="p-3">Рейтинг</th><th className="p-3 pr-5 text-right">Действия</th></tr></thead>
          <tbody>
            {!list && [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={7} className="p-3 px-5"><div className="skel h-8" /></td></tr>)}
            {list?.map(p => (
              <tr key={p.id} className="border-b hairline last:border-0 hover-soft">
                <td className="p-3 pl-5"><div className="flex items-center gap-3"><span className="text-2xl">{p.emoji}</span><div className="min-w-0"><div className="font-semibold truncate max-w-[220px]">{p.name}</div><div className="text-[11px] c-ink3 font-mono">{p.barcode}</div></div></div></td>
                <td className="p-3"><input type="number" min={1} defaultValue={p.price} onBlur={e => +e.target.value !== p.price && void patch(p, { price: +e.target.value })} className="field !py-1.5 !px-2 !w-24 font-mono !rounded-lg" aria-label="Цена" /></td>
                <td className="p-3"><input type="number" min={0} defaultValue={p.old ?? ''} key={`old-${p.old}`} onBlur={e => { const v = e.target.value ? +e.target.value : null; if (v !== p.old) void patch(p, { old: v }); }} className="field !py-1.5 !px-2 !w-24 font-mono !rounded-lg" placeholder="—" aria-label="Старая цена" /></td>
                <td className="p-3"><input type="number" min={0} defaultValue={p.stock} onBlur={e => +e.target.value !== p.stock && void patch(p, { stock: +e.target.value })} className={clsx('field !py-1.5 !px-2 !w-20 font-mono !rounded-lg', p.stock <= 5 && '!border-[var(--yellow)]')} aria-label="Склад" /></td>
                <td className="p-3"><select value={p.badge} onChange={e => void patch(p, { badge: e.target.value })} className="field !py-1.5 !px-2 !w-28 !rounded-lg text-xs" aria-label="Бейдж"><option value="">—</option><option>Хит</option><option>Sale</option><option>New</option></select></td>
                <td className="p-3 text-xs c-ink2">{p.rating.n ? `${p.rating.avg.toFixed(1)} (${p.rating.n})` : '—'}</td>
                <td className="p-3 pr-5 text-right"><button onClick={() => del(p)} className={clsx('rounded-full px-3 py-1.5 text-xs font-medium tr', confirm === p.id ? 'bg-[var(--pink)] text-[var(--ink)]' : 'btn-ghost c-pink')}>{confirm === p.id ? 'Точно снять?' : 'Удалить'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Orders() {
  const [list, setList] = useState<Order[] | null>(null);
  const [q, setQ] = useState(''), [status, setStatus] = useState('all');
  const qs = `status=${status}&q=${encodeURIComponent(q.trim())}`;
  useEffect(() => { const t = setTimeout(() => { api.admin.get<Order[]>(`/admin/orders?${qs}`).then(setList).catch(toastErr); }, 200); return () => clearTimeout(t); }, [qs]);
  const setOrderStatus = async (o: Order, s: string) => {
    try { const u = await api.admin.patch<Order>(`/admin/orders/${o.id}`, { status: s }); setList(l => l?.map(x => (x.id === o.id ? u : x)) ?? null); sfx.click(); } catch (e) { toastErr(e); }
  };
  const exportJson = async () => {
    try {
      const res = await fetch(`/api/admin/orders/export?${qs}`, { headers: { Authorization: `Bearer ${tokens.admin}` } });
      if (!res.ok) throw new ApiError(res.status, 'Не удалось выгрузить');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = `neon-orders-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      sfx.success();
    } catch (e) { toastErr(e); }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} className="field !w-auto flex-1 min-w-[200px]" placeholder="Поиск: номер, имя, телефон" />
        <select value={status} onChange={e => setStatus(e.target.value)} className="field !w-auto"><option value="all">Все статусы</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button onClick={exportJson} className="btn-yellow rounded-full px-4 py-3 text-sm flex items-center gap-2"><Download className="w-4 h-4" />Экспорт JSON</button>
      </div>
      <div className="mt-4 space-y-2">
        {!list && [0, 1, 2, 3].map(n => <div key={n} className="glass rounded-[24px] p-4 flex gap-4"><div className="skel h-10 w-28" /><div className="skel h-10 flex-1" /><div className="skel h-10 w-32" /></div>)}
        {list?.map(o => {
          const idx = FLOW.indexOf(o.status);
          const locked = o.status === 'cancelled' || o.status === 'awaiting_payment';
          return (
            <div key={o.id} className="glass rounded-[24px] p-4 grid md:grid-cols-[160px_1fr_auto] gap-3 items-center">
              <div><div className="font-mono font-medium">{o.id}</div><div className="text-[11px] c-ink3">{dt(o.createdAt)}</div></div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{o.customer.name} · {o.customer.phone}</div>
                <div className="text-xs c-ink3 truncate">{o.items.map(i => `${i.emoji}×${i.qty}`).join(' ')} · {o.delivery.label}</div>
                <div className="text-xs mt-0.5"><span className="font-mono font-medium">{money(o.total)}</span>{o.bonusSpent > 0 && <span className="c-yellow"> · бонусы −{o.bonusSpent}</span>}<span className="c-ink3"> · {{ paid: 'оплачен', cod: 'при получении', pending: 'ждёт оплаты', failed: 'оплата не прошла', refunded: 'возврат' }[o.paymentStatus]}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex gap-1">{FLOW.map((s, i) => <span key={s} className="w-2.5 h-2.5 rounded-full" style={{ background: idx >= i ? 'var(--ink)' : 'var(--track)' }} />)}</div>
                <select value={o.status} disabled={o.status === 'cancelled'} onChange={e => void setOrderStatus(o, e.target.value)} className="field !py-2 !w-auto text-xs font-medium" style={{ color: STATUS_COLORS[o.status] }} aria-label="Статус">
                  {o.status === 'awaiting_payment' && <option value="awaiting_payment">Ожидает оплаты</option>}
                  {[...FLOW, 'cancelled'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <button onClick={() => void setOrderStatus(o, FLOW[idx + 1])} disabled={locked || o.status === 'done'} className="btn-neon rounded-full w-10 h-10 grid place-items-center" title="Следующий статус" aria-label="Следующий статус"><ChevronsRight className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {list && !list.length && <div className="text-center c-ink3 py-10">Заказов не найдено</div>}
      </div>
    </div>
  );
}

function Reviews({ onCount }: { onCount: (n: number) => void }) {
  const [list, setList] = useState<Review[] | null>(null);
  const load = useCallback(() => api.admin.get<Review[]>('/admin/reviews').then(l => { setList(l); onCount(l.filter(r => r.status === 'pending').length); }).catch(toastErr), [onCount]);
  useEffect(() => { void load(); }, [load]);
  const approve = async (r: Review) => { try { await api.admin.patch(`/admin/reviews/${r.id}`, { status: 'approved' }); sfx.success(); void load(); } catch (e) { toastErr(e); } };
  const del = async (r: Review) => { try { await api.admin.del(`/admin/reviews/${r.id}`); sfx.whoosh(); void load(); } catch (e) { toastErr(e); } };
  const pending = list?.filter(r => r.status === 'pending') ?? [];
  return (
    <div>
      <div className="font-medium mb-3 flex items-center gap-2">На модерации <span className="text-xs font-semibold px-2 rounded-full bg-lime">{pending.length}</span></div>
      <div className="grid md:grid-cols-2 gap-3">
        {pending.map(r => (
          <div key={r.id} className={clsx('glass rounded-[24px] p-4', r.flagged && '!border-[var(--pink)]')}>
            <div className="flex items-center gap-2 text-sm"><span className="text-xl">{r.product?.emoji}</span><span className="font-medium truncate">{r.product?.name}</span><span className="ml-auto"><Stars value={r.rating} size="w-3 h-3" /></span></div>
            <p className="text-sm c-ink2 mt-2">{r.text}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs c-ink3"><span>{r.author}</span><span>{timeAgo(r.createdAt)}</span><span>{r.emojis.join(' ')}</span>{r.verified && <span className="c-lime">✓ покупатель</span>}{r.flagged && <span className="c-pink font-medium">⚠ подозрение на спам</span>}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => approve(r)} className="btn-neon rounded-full px-4 py-2 text-xs flex items-center gap-1.5"><Check className="w-3.5 h-3.5" />Одобрить</button>
              <button onClick={() => del(r)} className="btn-ghost rounded-full px-4 py-2 text-xs font-medium c-pink flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Удалить</button>
            </div>
          </div>
        ))}
      </div>
      {list && !pending.length && <div className="glass rounded-[24px] p-8 text-center c-ink3">Очередь модерации пуста ✨</div>}
      <div className="font-medium mt-8 mb-3">Опубликованные (последние 20)</div>
      <div className="glass rounded-[24px] divide-y divide-[var(--stroke)]">
        {list?.filter(r => r.status === 'approved').slice(0, 20).map(r => (
          <div key={r.id} className="p-3 flex items-center gap-3 text-sm">
            <span>{r.product?.emoji}</span><span className="flex-1 min-w-0 truncate c-ink2">{r.author}: {r.text}</span><Stars value={r.rating} size="w-3 h-3" />
            <button onClick={() => del(r)} className="c-ink3 hover:text-[var(--pink)]" aria-label="Удалить отзыв"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [['dash', LayoutDashboard, 'Дашборд'], ['products', Boxes, 'Товары'], ['orders', ClipboardList, 'Заказы'], ['reviews', MessageSquareText, 'Отзывы']] as const;

export default function Admin() {
  const [authed, setAuthed] = useState(!!tokens.admin);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('dash');
  const [pending, setPending] = useState(0);
  useEffect(() => { if (authed) api.admin.get<Stats>('/admin/stats').then(s => setPending(s.pendingReviews)).catch(e => { if ((e as ApiError).status === 401) setAuthed(false); }); }, [authed]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <div className="min-h-screen relative"><div className="liquid" aria-hidden><i /><i /><i /><i /></div>
      <div className="sticky top-0 z-20 glass !border-x-0 !border-t-0 !rounded-none">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="w-10 h-10 rounded-[16px] grid place-items-center bg-lime"><Terminal className="w-5 h-5" strokeWidth={2.4} /></span>
          <div className="flex-1"><div className="font-display">NEON Admin</div><div className="text-[11px] c-ink3">Ctrl + Shift + A — назад в магазин</div></div>
          <Link to="/" className="btn-ghost rounded-full px-3 py-2 text-xs font-medium flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /><span className="hidden sm:inline">Магазин</span></Link>
          <button onClick={() => { tokens.admin = null; setAuthed(false); }} className="btn-ghost rounded-full px-3 py-2 text-xs font-medium flex items-center gap-1.5" aria-label="Выйти"><LogOut className="w-3.5 h-3.5" /></button>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map(([id, Icon, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); sfx.click(); }} className={clsx('shrink-0 px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px', tab === id ? 'border-[var(--lime)] c-lime' : 'border-transparent c-ink2 hover:text-[var(--ink)]')}>
              <Icon className="w-4 h-4" />{label}{id === 'reviews' && pending > 0 && <span className="text-[10px] font-semibold px-1.5 rounded-full bg-lime">{pending}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'dash' && <Dashboard />}
        {tab === 'products' && <Products />}
        {tab === 'orders' && <Orders />}
        {tab === 'reviews' && <Reviews onCount={setPending} />}
      </div>
    </div>
  );
}
