import clsx from 'clsx';
import { Barcode as BarcodeIcon, Copy, Gem, KeyRound, QrCode, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState, type PointerEvent } from 'react';
import { api } from '../api';
import { Barcode, QrMatrix } from '../lib/codes';
import { fmt, money, timeAgo, uid } from '../lib/format';
import { sfx } from '../lib/sound';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import { PhoneAuth } from './PhoneAuth';
import { Overlay, SheetHeader, Spinner } from './ui';

function HoloCard() {
  const user = useSession(s => s.user)!;
  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.classList.remove('auto');
    el.style.setProperty('--ry', (px - 0.5) * 26 + 'deg'); el.style.setProperty('--rx', (0.5 - py) * 22 + 'deg');
    el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
  };
  const reset = (e: PointerEvent<HTMLDivElement>) => { const el = e.currentTarget; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.add('auto'); };
  return (
    <div className="holo-wrap">
      <div className="holo auto p-6 flex flex-col justify-between select-none" style={{ touchAction: 'none' }} onPointerMove={tilt} onPointerLeave={reset}>
        <div className="relative flex items-start justify-between">
          <div className="eyebrow !text-[var(--ink-2)]">neon club</div>
          <div className="text-right text-xs c-ink2">{user.tier.name} · {Math.round(user.tier.rate * 100)}%</div>
        </div>
        <div className="relative">
          <div className="font-display text-[56px] leading-none tracking-tight">{fmt(user.bonusBalance)}</div>
          <div className="text-xs c-ink3 mt-2">бонусов · 1 бонус = 1 ₴</div>
        </div>
        <div className="relative flex items-end justify-between text-xs c-ink2">
          <span className="font-mono tracking-[.14em]">{user.loyaltyCard.replace(/(\d{4})(\d{4})(\d{5})/, '$1 $2 $3')}</span>
          <span className="truncate max-w-[45%]">{user.name}</span>
        </div>
      </div>
    </div>
  );
}

export function LoyaltyModal() {
  const open = useUi(s => s.loyaltyOpen), set = useUi(s => s.set), toast = useUi(s => s.toast);
  const user = useSession(s => s.user), refresh = useSession(s => s.refresh);
  const [tab, setTab] = useState<'qr' | 'bar'>('qr');
  const [seed, setSeed] = useState(uid()), [left, setLeft] = useState(30);
  const [otp, setOtp] = useState(''), [otpLeft, setOtpLeft] = useState(0), [otpKey, setOtpKey] = useState(0), [otpBusy, setOtpBusy] = useState(false);
  const [syncing, setSyncing] = useState(false), [synced, setSynced] = useState<number | null>(null);
  const close = () => set({ loyaltyOpen: false });

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      setLeft(l => { if (l <= 1) { setSeed(uid()); return 30; } return l - 1; });
      setOtpLeft(l => { if (l === 1) setOtp(''); return Math.max(0, l - 1); });
    }, 1000);
    return () => clearInterval(t);
  }, [open]);

  const genOtp = async () => {
    setOtpBusy(true);
    try { const r = await api.post<{ otp: string; ttl: number }>('/me/loyalty/otp'); setOtp(r.otp); setOtpLeft(r.ttl); setOtpKey(k => k + 1); sfx.coin(); }
    catch (e) { toast({ type: 'err', msg: (e as Error).message }); } finally { setOtpBusy(false); }
  };
  const sync = async () => { setSyncing(true); await refresh(); setSyncing(false); setSynced(Date.now()); toast({ type: 'info', msg: 'Баланс синхронизирован' }); };

  return (
    <Overlay open={open} onClose={close} label="Карта лояльности" className="md:max-w-[460px]" z={90}>
      <SheetHeader onClose={close} icon={<Gem className="w-5 h-5 c-lime" />} title="NEON CLUB" />
      <div className="p-5">
        {!user ? (
          <div>
            <p className="c-ink2 text-sm mb-4">Подтвердите номер телефона — карта NEON CLUB создастся автоматически, а на счёт упадут <b className="c-lime">100 приветственных бонусов</b>.</p>
            <PhoneAuth />
          </div>
        ) : (
          <>
            <HoloCard />
            <div className="text-center text-[11px] c-ink3 mt-2">Наведите или проведите пальцем по карте ✨</div>
            <div className="mt-5 flex p-1 rounded-full well" role="tablist">
              <button role="tab" aria-selected={tab === 'qr'} onClick={() => { setTab('qr'); sfx.click(); }} className={clsx('flex-1 h-9 rounded-full flex items-center justify-center gap-2 text-sm', tab === 'qr' ? 'dock-btn on !h-9 !flex' : 'c-ink3')}><QrCode className="w-4 h-4" />QR</button>
              <button role="tab" aria-selected={tab === 'bar'} onClick={() => { setTab('bar'); sfx.click(); }} className={clsx('flex-1 h-9 rounded-full flex items-center justify-center gap-2 text-sm', tab === 'bar' ? 'dock-btn on !h-9 !flex' : 'c-ink3')}><BarcodeIcon className="w-4 h-4" />Штрихкод</button>
            </div>
            <div className="mt-3 rounded-[30px] glass p-5">
              {tab === 'qr' ? (
                <div className="flex items-center gap-5">
                  <span className="rounded-[20px] bg-white p-1.5 shrink-0 shadow-[var(--hl-soft)]"><QrMatrix seed={seed + user.loyaltyCard} className="w-28 h-28 text-[#0b0c0e] block" /></span>
                  <div>
                    <div className="text-sm">Динамический код</div>
                    <div className="text-xs c-ink3 mt-1">Обновляется каждые 30 секунд</div>
                    <div className="mt-4 flex items-center gap-2 text-xs c-ink2">
                      <svg viewBox="0 0 36 36" className="w-6 h-6 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--track)" strokeWidth="3" /><circle cx="18" cy="18" r="15" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeDasharray="94.25" strokeDashoffset={94.25 * (1 - left / 30)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
                      <span className="font-mono">0:{String(left).padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>
              ) : <div className="rounded-[20px] bg-white px-4 py-3"><Barcode code={user.loyaltyCard} h={64} color="#0b0c0e" className="w-full block" /></div>}
            </div>
            <div className="mt-4 rounded-[30px] glass p-4">
              <div className="font-medium text-sm flex items-center gap-2"><KeyRound className="w-4 h-4 c-yellow" />Одноразовый код для кассы</div>
              <div className="text-xs c-ink3 mt-0.5">Назовите кассиру, если нет сканера</div>
              {otp && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex gap-1.5">{otp.split('').map((d, k) => <span key={k + '-' + otpKey} className="otp-digit otp-roll" style={{ animationDelay: `${k * 60}ms` }}>{d}</span>)}</div>
                  <div className="ml-auto text-right">
                    <div className={clsx('font-mono text-sm font-medium', otpLeft <= 10 ? 'c-pink' : 'c-lime')}>{otpLeft} c</div>
                    <button onClick={() => { void navigator.clipboard?.writeText(otp); toast({ type: 'info', msg: 'Код скопирован' }); }} className="text-[11px] c-ink3 hover:text-[var(--ink)] flex items-center gap-1"><Copy className="w-3 h-3" />копия</button>
                  </div>
                </div>
              )}
              <button onClick={genOtp} disabled={otpBusy} className="btn-neon w-full rounded-full h-11 mt-3 flex items-center justify-center gap-2 text-sm">{otpBusy ? <Spinner dark /> : <><Zap className="w-4 h-4" />{otp ? 'Сгенерировать новый' : 'Сгенерировать код'}</>}</button>
            </div>
            <div className="mt-4 rounded-[30px] glass p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Уровень {user.tier.name}</span>
                <span className="text-xs c-ink3">{user.nextTier ? `до ${user.nextTier.name}: ${money(user.nextTier.min - user.lifetimeSpend)}` : 'Максимальный уровень'}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--track)] overflow-hidden"><div className="h-full rounded-full tr" style={{ width: `${user.nextTier ? (user.lifetimeSpend - user.tier.min) / (user.nextTier.min - user.tier.min) * 100 : 100}%`, background: `linear-gradient(90deg, ${user.tier.color}, var(--lime))` }} /></div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs c-ink3"><div className="flex items-center gap-1.5 font-medium"><span className={clsx('pulse-dot', syncing && 'sync')} />Баланс NEON CLUB</div><div className="mt-0.5">{synced ? `Синхронизировано ${timeAgo(synced)}` : 'Обновляется при каждом заказе'}</div></div>
                <button onClick={sync} disabled={syncing} className="btn-ghost rounded-full px-3 py-2 text-xs font-medium flex items-center gap-1.5"><RefreshCw className={clsx('w-3.5 h-3.5', syncing && 'animate-spin')} />Обновить</button>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-medium c-ink3 uppercase tracking-widest mb-2">История</div>
              <div className="space-y-1.5">
                {user.bonusHistory.slice(0, 10).map(h => (
                  <div key={h.id} className="flex items-center gap-3 text-sm rounded-[16px] px-3 py-2 well">
                    {h.delta > 0 ? <TrendingUp className="w-4 h-4 c-lime" /> : <TrendingDown className="w-4 h-4 c-pink" />}
                    <span className="flex-1 min-w-0 truncate c-ink2">{h.reason}</span>
                    <span className={clsx('font-mono font-medium', h.delta > 0 ? 'c-lime' : 'c-pink')}>{h.delta > 0 ? '+' : ''}{h.delta}</span>
                  </div>
                ))}
                {!user.bonusHistory.length && <div className="text-sm c-ink3 text-center py-3">Операций пока нет</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
