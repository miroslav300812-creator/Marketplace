import clsx from 'clsx';
import { Gift, ShieldCheck, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { formatPhoneInput, phoneValid } from '../lib/format';
import { sfx } from '../lib/sound';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { User } from '../types';
import { Spinner } from './ui';

/** Phone input + 4-digit SMS code (SMS Fly). Logs the customer in on success. */
export function PhoneAuth({ error, restored }: { error?: string; restored?: boolean }) {
  const { profile, setProfile, user, login } = useSession();
  const toast = useUi(s => s.toast);
  const [sent, setSent] = useState(false);
  const [left, setLeft] = useState(0);
  const [code, setCode] = useState(['', '', '', '']);
  const [busy, setBusy] = useState<'' | 'send' | 'verify'>('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const verified = !!user && user.phone.replace(/\D/g, '') === profile.phone.replace(/\D/g, '');

  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(l => l - 1), 1000); return () => clearTimeout(t); }, [left]);

  const verify = async (digits: string[]) => {
    setBusy('verify'); setErr('');
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/sms/verify', { phone: profile.phone, code: digits.join('') });
      login(r.token, r.user); setSent(false); sfx.success();
      const welcome = r.user.bonusHistory.find(h => h.reason.includes('Приветственный'));
      if (welcome && Date.now() - +new Date(welcome.at) < 60_000) { sfx.coins(); toast({ type: 'coin', title: `+${welcome.delta} бонусов`, msg: 'Добро пожаловать в NEON CLUB!' }); }
      else toast({ type: 'ok', title: 'Телефон подтверждён', msg: 'Бонусы синхронизированы с картой NEON CLUB' });
    } catch (e) {
      setErr((e as Error).message); setCode(['', '', '', '']); setShake(true); setTimeout(() => setShake(false), 500); sfx.error();
      refs.current[0]?.focus();
    } finally { setBusy(''); }
  };
  const send = async () => {
    if (!phoneValid(profile.phone)) { setErr('Формат: +380 XX XXX XX XX'); sfx.error(); return; }
    setBusy('send'); setErr('');
    try {
      const r = await api.post<{ resendIn: number; devCode?: string }>('/auth/sms/send', { phone: profile.phone });
      setSent(true); setLeft(r.resendIn); setCode(['', '', '', '']);
      toast({ type: 'info', title: 'SMS Fly', msg: `Код отправлен на ${profile.phone}` });
      if (r.devCode) setTimeout(() => { sfx.click(); toast({ type: 'sms', title: 'SMS · NEON (демо-режим)', msg: `Ваш код подтверждения: ${r.devCode}`, code: r.devCode, ttl: 12000, onUse: () => { const d = r.devCode!.split(''); setCode(d); void verify(d); } }); }, 1200);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (e) { setErr((e as Error).message); sfx.error(); } finally { setBusy(''); }
  };
  const onDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    const next = [...code];
    if (d.length > 1) d.slice(0, 4 - i).split('').forEach((c, j) => { next[i + j] = c; }); else next[i] = d;
    setCode(next);
    if (next.every(Boolean)) { void verify(next); return; }
    if (d) refs.current[Math.min(3, i + Math.max(1, d.length))]?.focus();
  };

  return (
    <div className="rounded-3xl glass p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold c-ink3">Телефон · подтверждение по SMS</span>
        {verified && <span className="text-xs font-bold c-lime flex items-center gap-1"><ShieldCheck className="w-4 h-4" />Подтверждён</span>}
      </div>
      <div className="flex gap-2 mt-2">
        <input value={profile.phone} onChange={e => setProfile({ phone: formatPhoneInput(e.target.value, profile.phone) })} onFocus={() => !profile.phone && setProfile({ phone: '+380 ' })}
          type="tel" inputMode="tel" autoComplete="tel" className={clsx('field font-mono flex-1', (err || error) && !sent && 'err', restored && profile.phone && 'restored')} placeholder="+380 XX XXX XX XX" aria-label="Телефон" />
        {!verified && (
          <button onClick={send} disabled={!!busy || left > 0 || !phoneValid(profile.phone)} className="btn-neon rounded-xl px-4 text-sm min-w-[130px] grid place-items-center">
            {busy === 'send' ? <Spinner dark /> : left > 0 ? `Повтор ${left}с` : sent ? 'Отправить ещё' : 'Получить код'}
          </button>
        )}
      </div>
      {sent && !verified && (
        <div className="mt-4 fade-in">
          <div className="text-sm c-ink2">Введите 4-значный код из SMS</div>
          <div className={clsx('flex items-center gap-2 mt-2', shake && 'shake')}>
            {code.map((c, i) => (
              <input key={i} ref={el => { refs.current[i] = el; }} value={c} onChange={e => onDigit(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Backspace' && !code[i] && i > 0) { refs.current[i - 1]?.focus(); setCode(s => s.map((x, j) => (j === i - 1 ? '' : x))); } }}
                inputMode="numeric" autoComplete="one-time-code" maxLength={4} className={clsx('field !w-14 !h-14 !p-0 text-center font-mono text-2xl font-bold', err && 'err')} aria-label={`Цифра ${i + 1}`} />
            ))}
            {busy === 'verify' && <Spinner className="ml-2" />}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="c-ink3 flex items-center gap-1.5 ml-auto"><Timer className="w-3.5 h-3.5" />{left > 0 ? `Отправить повторно через 0:${String(left).padStart(2, '0')}` : 'Можно запросить новый код'}</span>
          </div>
        </div>
      )}
      {(err || error) && <div className="text-xs c-pink font-semibold mt-2">{err || error}</div>}
      {!verified && <div className="text-[11px] c-ink3 mt-3 flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 c-yellow" />После подтверждения карта NEON CLUB привяжется к номеру (+100 бонусов новым клиентам)</div>}
    </div>
  );
}
