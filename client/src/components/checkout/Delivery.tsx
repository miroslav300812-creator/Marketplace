import clsx from 'clsx';
import { Bike, Building2, CircleOff, Clock, MapPin, Package, Store as StoreIcon, Truck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { money } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { useSession } from '../../store/session';
import type { Coverage, NpCity, NpWarehouse, Quote, Store } from '../../types';
import { CityMap } from '../CityMap';
import { Field, Spinner } from '../ui';

let storesCache: Store[] | null = null;
export function useStores() {
  const [stores, setStores] = useState<Store[]>(storesCache ?? []);
  useEffect(() => { if (!storesCache) api.get<Store[]>('/delivery/stores').then(s => { storesCache = s; setStores(s); }).catch(() => undefined); }, []);
  return stores;
}

function NovaPoshta({ errors, restored }: { errors: Record<string, string>; restored: boolean }) {
  const np = useSession(s => s.profile.delivery.np), setDelivery = useSession(s => s.setDelivery);
  const setNp = (p: Partial<typeof np>) => setDelivery({ np: { ...np, ...p } });
  const [q, setQ] = useState(np.cityName);
  const [cities, setCities] = useState<NpCity[]>([]);
  const [cityOpen, setCityOpen] = useState(false), [cityLoading, setCityLoading] = useState(false);
  const [whs, setWhs] = useState<NpWarehouse[] | null>(null);
  const [whQ, setWhQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setCityOpen(false); };
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => {
    if (!np.cityRef) { setWhs(null); return; }
    setWhs(null);
    api.get<NpWarehouse[]>(`/delivery/np/warehouses?cityRef=${encodeURIComponent(np.cityRef)}`).then(setWhs).catch(() => setWhs([]));
  }, [np.cityRef]);

  const search = (v: string) => {
    setQ(v); setCityOpen(true); setCityLoading(true);
    const n = ++seq.current;
    setTimeout(() => {
      if (n !== seq.current) return;
      api.get<NpCity[]>(`/delivery/np/cities?q=${encodeURIComponent(v)}`).then(r => { if (n === seq.current) { setCities(r); setCityLoading(false); } }).catch(() => setCityLoading(false));
    }, 200);
  };
  const list = (whs ?? []).filter(w => w.type === np.whType && (!whQ || (w.name + ' ' + w.address).toLowerCase().includes(whQ.toLowerCase())));
  const count = (t: string) => (whs ?? []).filter(w => w.type === t).length;

  return (
    <div className="mt-5 space-y-4">
      <div className="relative" ref={box}>
        <Field label="Город" error={errors.city}>
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 c-ink3" />
            <input value={q} onChange={e => search(e.target.value)} onFocus={() => search(q)} className={clsx('field !pl-9', errors.city && 'err', restored && np.cityRef && 'restored')} placeholder="Начните вводить: Киев, Львов…" autoComplete="off" />
          </div>
        </Field>
        {cityOpen && (
          <div className="absolute z-20 left-0 right-0 mt-1.5 panel rounded-[24px] overflow-hidden shadow-2xl max-h-72 overflow-y-auto thin-scroll">
            {cityLoading ? <div className="p-3 space-y-2">{[0, 1, 2, 3].map(n => <div key={n} className="flex items-center gap-3"><div className="skel w-8 h-8 !rounded-lg" /><div className="flex-1"><div className="skel h-3 w-1/2" /><div className="skel h-2.5 w-1/3 mt-1.5" /></div></div>)}</div>
              : cities.length ? cities.map(c => (
                <button key={c.ref} onClick={() => { setNp({ cityRef: c.ref, cityName: c.name, whRef: '', whName: '', whAddress: '' }); setQ(c.name); setCityOpen(false); sfx.click(); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover-soft">
                  <span className="w-8 h-8 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] c-pink"><Building2 className="w-4 h-4" /></span>
                  <span className="flex-1"><span className="block font-semibold text-sm">{c.name}</span><span className="block text-[11px] c-ink3">{c.region} · {c.size}+ точек</span></span>
                </button>
              )) : <div className="p-4 text-sm c-ink3 text-center">{q.trim().length < 2 ? 'Введите хотя бы 2 буквы' : 'Город не найден'}</div>}
          </div>
        )}
      </div>
      {np.cityRef && (
        <div>
          <div className="flex items-center gap-2">
            <div className="flex p-1 rounded-[16px] well text-xs font-medium shrink-0">
              {(['branch', 'postomat'] as const).map(t => <button key={t} onClick={() => { setNp({ whType: t, whRef: '', whName: '', whAddress: '' }); sfx.click(); }} className={clsx('px-3 py-1.5 rounded-lg', np.whType === t ? 'bg-lime' : 'c-ink2')}>{t === 'branch' ? 'Отделения' : 'Почтоматы'} ({count(t)})</button>)}
            </div>
            <input value={whQ} onChange={e => setWhQ(e.target.value)} className="field !py-2 text-sm flex-1 min-w-0" placeholder="Номер или улица…" aria-label="Поиск отделения" />
          </div>
          <div className="mt-2 rounded-[24px] border hairline max-h-64 overflow-auto thin-scroll" style={errors.wh ? { borderColor: 'var(--pink)' } : undefined}>
            {!whs ? <div className="p-3 space-y-3">{[0, 1, 2, 3].map(n => <div key={n}><div className="skel h-3.5 w-1/3" /><div className="skel h-3 w-2/3 mt-2" /></div>)}</div>
              : list.length ? list.map(w => (
                <button key={w.ref} onClick={() => { setNp({ whRef: w.ref, whName: w.name, whAddress: w.address }); sfx.click(); }} className={clsx('w-full px-4 py-3 flex items-start gap-3 text-left border-b hairline last:border-0', np.whRef === w.ref ? 'bg-[var(--hover)]' : 'hover-soft')}>
                  <span className={clsx('mt-0.5 w-4 h-4 rounded-full border-2 grid place-items-center shrink-0', np.whRef === w.ref ? 'border-[var(--lime)]' : 'border-[var(--stroke-2)]')}>{np.whRef === w.ref && <span className="w-2 h-2 rounded-full bg-[var(--lime)]" />}</span>
                  <span className="flex-1 min-w-0"><span className="block font-semibold text-sm">{w.name}</span><span className="block text-xs c-ink2 truncate">{w.address}</span><span className="block text-[11px] c-ink3">{[w.hours, w.limit].filter(Boolean).join(' · ')}</span></span>
                </button>
              )) : <div className="p-4 text-sm c-ink3 text-center">Ничего не найдено</div>}
          </div>
          {errors.wh && <span className="text-xs c-pink font-semibold mt-1 block">{errors.wh}</span>}
        </div>
      )}
    </div>
  );
}

function Courier({ errors, restored }: { errors: Record<string, string>; restored: boolean }) {
  const c = useSession(s => s.profile.delivery.courier), setDelivery = useSession(s => s.setDelivery);
  const stores = useStores();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [geo, setGeo] = useState(false);
  const setC = (p: Partial<typeof c>) => setDelivery({ courier: { ...useSession.getState().profile.delivery.courier, ...p } });
  const resolve = async (x: number, y: number, keepAddress = false) => {
    setGeo(true);
    try {
      const r = await api.post<{ address: string; coverage: Coverage }>('/delivery/courier/resolve', { x, y });
      setCoverage(r.coverage);
      setC({ x, y, ...(keepAddress ? {} : { address: r.address }) });
      if (!r.coverage.inZone) sfx.error();
    } finally { setGeo(false); }
  };
  useEffect(() => { if (c.x != null && c.y != null) void resolve(c.x, c.y, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mt-5 space-y-3">
      <CityMap stores={stores} mode="courier" pin={c.x != null && c.y != null ? { x: c.x, y: c.y } : null} coverage={coverage} error={!!errors.pin}
        onPin={(x, y) => { sfx.pop(); setC({ x, y }); void resolve(x, y); }} />
      {coverage && (
        <div className="rounded-[24px] p-4 flex items-center gap-4 glass" >
          <span className={clsx('w-11 h-11 rounded-[16px] grid place-items-center', coverage.inZone ? 'c-cyan bg-[var(--hover)]' : 'c-pink bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]')}>{coverage.inZone ? <Bike className="w-5 h-5" /> : <CircleOff className="w-5 h-5" />}</span>
          <div className="flex-1 min-w-0"><div className="font-medium text-sm">{coverage.inZone ? `В зоне доставки · ${coverage.eta}` : 'Вне зоны доставки'}</div><div className="text-xs c-ink3">{coverage.storeName} · {coverage.km} км</div></div>
        </div>
      )}
      {errors.pin && <span className="text-xs c-pink font-semibold block">{errors.pin}</span>}
      <div className="grid sm:grid-cols-[1fr_120px] gap-3">
        <Field label={<span className="flex items-center gap-2">Адрес {geo && <Spinner className="!w-3 !h-3" />}</span>} error={errors.address}>
          <input value={c.address} onChange={e => setC({ address: e.target.value })} className={clsx('field', errors.address && 'err', restored && c.address && 'restored')} placeholder="Определится по пину на карте" />
        </Field>
        <Field label="Кв./офис"><input value={c.apt} onChange={e => setC({ apt: e.target.value })} className="field" placeholder="12" /></Field>
      </div>
      <input value={c.comment} onChange={e => setC({ comment: e.target.value })} className="field text-sm" placeholder="Комментарий курьеру: код домофона, этаж…" aria-label="Комментарий курьеру" />
    </div>
  );
}

function Pickup({ errors }: { errors: Record<string, string> }) {
  const storeId = useSession(s => s.profile.delivery.storeId), setDelivery = useSession(s => s.setDelivery);
  const stores = useStores();
  const pick = (id: string) => { setDelivery({ storeId: id }); sfx.pop(); };
  return (
    <div className="mt-5">
      <CityMap stores={stores} mode="pickup" selectedStore={storeId} onStore={pick} error={!!errors.store} />
      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        {stores.map(s => (
          <button key={s.id} onClick={() => pick(s.id)} className={clsx('rounded-[24px] p-3.5 text-left border tr', storeId === s.id ? 'border-[var(--yellow)] bg-[var(--hover)]' : 'hairline well hover-soft')} aria-pressed={storeId === s.id}>
            <div className="flex items-center gap-2"><StoreIcon className={clsx('w-4 h-4', storeId === s.id ? 'c-yellow' : 'c-lime')} /><span className="font-medium text-sm">{s.name}</span></div>
            <div className="text-xs c-ink2 mt-1">{s.address}</div>
            <div className="flex items-center gap-2 mt-2 text-[11px] c-ink3"><Clock className="w-3 h-3" />{s.hours}
              <span className="ml-auto flex items-center gap-1.5">загрузка<span className="w-12 h-1.5 rounded-full bg-[var(--track)] overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${s.load * 100}%`, background: 'var(--ink)', opacity: .35 + s.load * .65 }} /></span></span>
            </div>
          </button>
        ))}
      </div>
      {errors.store && <span className="text-xs c-pink font-semibold block mt-2">{errors.store}</span>}
    </div>
  );
}

export function DeliveryStep({ errors, restored, quote }: { errors: Record<string, string>; restored: boolean; quote: Quote | null }) {
  const type = useSession(s => s.profile.delivery.type), setDelivery = useSession(s => s.setDelivery);
  const d = quote?.delivery;
  return (
    <div>
      <h4 className="font-display text-lg mb-4">Способ получения</h4>
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {([['np', Package, 'Новая Почта', 'отделение / почтомат'], ['courier', Bike, 'Курьер', '30–60 мин'], ['pickup', StoreIcon, 'Самовывоз', 'бесплатно']] as const).map(([id, Icon, t, sub]) => (
          <button key={id} role="radio" aria-checked={type === id} onClick={() => { setDelivery({ type: id }); sfx.click(); }} className={clsx('rounded-[24px] p-3 text-left border tr', type === id ? 'ring-neon border-transparent bg-[var(--hover)]' : 'hairline well hover-soft')}>
            <Icon className={clsx('w-6 h-6', type === id ? 'c-lime' : 'c-ink2')} />
            <span className="block font-medium text-sm mt-2">{t}</span><span className="block text-[11px] c-ink3">{sub}</span>
          </button>
        ))}
      </div>
      {type === 'np' && <NovaPoshta errors={errors} restored={restored} />}
      {type === 'courier' && <Courier errors={errors} restored={restored} />}
      {type === 'pickup' && <Pickup errors={errors} />}
      {d && d.type === type && (
        <div className="mt-4 rounded-[24px] p-4 flex items-center gap-4 glass">
          <span className="w-11 h-11 rounded-[16px] grid place-items-center bg-[var(--hover)] c-lime"><Truck className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0"><div className="font-medium text-sm">Получение: {d.eta}</div><div className="text-xs c-ink3 truncate">{d.label}</div>{d.cost === 0 && d.baseCost > 0 && <div className="text-[11px] c-lime font-medium">Бесплатно (обычно {money(d.baseCost)})</div>}</div>
          <div className={clsx('font-display text-lg', d.cost === 0 && 'c-lime')}>{d.cost === 0 ? 'FREE' : money(d.cost)}</div>
        </div>
      )}
    </div>
  );
}
