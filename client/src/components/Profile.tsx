import { HardDrive, LogOut, Package, QrCode, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { sfx } from '../lib/sound';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { User } from '../types';
import { DELIVERY_LABEL } from './Orders';
import { PhoneAuth } from './PhoneAuth';
import { Field, Overlay, SheetHeader } from './ui';

export function ProfileSheet() {
  const open = useUi(s => s.profileOpen), set = useUi(s => s.set), toast = useUi(s => s.toast);
  const { user, profile, setProfile, setUser, logout, forget } = useSession();
  const [saving, setSaving] = useState(false);
  const close = () => set({ profileOpen: false });
  const d = profile.delivery;
  const save = async () => {
    setSaving(true);
    try { setUser(await api.patch<User>('/me', { name: profile.name, email: profile.email })); sfx.success(); toast({ type: 'ok', msg: 'Профиль сохранён' }); }
    catch (e) { toast({ type: 'err', msg: (e as Error).message }); } finally { setSaving(false); }
  };
  const tiles = [
    ['Отделение НП', d.np.whName ? `${d.np.cityName}, ${d.np.whName}` : '—'],
    ['Способ доставки', DELIVERY_LABEL[d.type]],
    ['Адрес курьера', d.courier.address || '—'],
    ['Оплата', profile.savedCard ?? { card: 'Карта', apple: 'Apple Pay', google: 'Google Pay', cash: 'При получении' }[profile.payMethod]]
  ];
  return (
    <Overlay open={open} onClose={close} label="Профиль" className="md:max-w-lg" z={90}>
      <SheetHeader onClose={close} icon={<UserRound className="w-5 h-5 c-lime" />} title="Профиль" />
      <div className="p-5">
        <div className="rounded-[24px] p-3 flex items-center gap-3 text-xs c-ink2 mb-5 well">
          <HardDrive className="w-4 h-4 shrink-0" />Контакты и адрес доставки запоминаются в этом браузере и подставляются при следующем заказе. Номер карты не сохраняется — только маска.
        </div>
        <div className="space-y-3">
          <Field label="Имя"><input value={profile.name} onChange={e => setProfile({ name: e.target.value })} className="field" placeholder="Ваше имя" /></Field>
          <Field label="E-mail"><input value={profile.email} onChange={e => setProfile({ email: e.target.value })} type="email" className="field" placeholder="you@mail.com" /></Field>
          {user ? (
            <div className="rounded-[24px] well p-3 flex items-center gap-3 text-sm"><ShieldCheck className="w-4 h-4 c-lime" /><span className="flex-1">{user.phone} · подтверждён</span>
              <button onClick={() => { logout(); sfx.click(); toast({ type: 'info', msg: 'Вы вышли из аккаунта' }); }} className="text-xs c-ink3 hover:text-[var(--ink)] flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />Выйти</button></div>
          ) : <PhoneAuth />}
          {user && <button onClick={save} disabled={saving} className="btn-ghost rounded-full px-4 py-2.5 text-sm font-medium">Сохранить в аккаунт</button>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {tiles.map(([l, v]) => <div key={l} className="rounded-[24px] well p-3"><div className="text-[11px] c-ink3 font-medium">{l}</div><div className="font-semibold mt-1 truncate">{v}</div></div>)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => set({ profileOpen: false, ordersOpen: true })} className="btn-ghost rounded-full py-3 font-medium text-sm flex items-center justify-center gap-2"><Package className="w-4 h-4" />Мои заказы</button>
          <button onClick={() => set({ profileOpen: false, loyaltyOpen: true })} className="btn-ghost rounded-full py-3 font-medium text-sm flex items-center justify-center gap-2"><QrCode className="w-4 h-4" />Карта</button>
          <button onClick={() => { forget(); sfx.whoosh(); toast({ type: 'info', msg: 'Сохранённые данные удалены из браузера' }); }} className="col-span-2 rounded-full h-11 text-sm flex items-center justify-center gap-2 c-pink hover-soft"><Trash2 className="w-4 h-4" />Удалить данные из браузера</button>
        </div>
      </div>
    </Overlay>
  );
}
