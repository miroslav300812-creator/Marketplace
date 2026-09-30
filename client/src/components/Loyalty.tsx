import clsx from 'clsx';
import { Barcode as BarcodeIcon, Copy, Gem, KeyRound, Nfc, QrCode, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
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
      <div className="holo auto p-5 flex flex-col justify-between text-white select-none" style={{ touchAction: 'none' }} onPointerMove={tilt} onPointerLeave={reset}>
        <div className="noise" />
        <div className="relative flex items-start justify-between">
          <div><div className="font-display font-black tracking-wider">NEON<span className="c-lime">·</span>CLUB</div><div className="text-[10px] font-bold tracking-[.25em] opacity-70 mt-1">{user.tier.name.toUpperCase()} MEMBER</div></div>
          <div className="text-right"><div className="text-[10px] opacity-70 font-bold">КЭШБЭК</div><div className="font-display font-black text-2xl" style={{ color: user.tier.color }}>{Math.round(user.tier.rate * 100)}%</div></div>
        </div>
        <div className="relative flex items-center gap-3"><div className="chip-gold" /><Nfc className="w-6 h-6 opacity-70" /></div>
        <div className="relative flex items-end justify-between">
          <div><div className="font-mono text-sm sm:text-base tracking-[.18em]">{user.loyaltyCard.replace(/(\d{4})(\d{4})(\d{5})/, '$1 $2 $3')}</div><div className="text-xs font-bold opacity-80 mt-1 uppercase">{user.name || 'NEON MEMBER'}</div></div>
          <div className="text-right"><div className="text-[10px] opacity-70 font-bold">БОНУСЫ</div><div className="font-mono font-bold text-2xl neon-text">{fmt(user.bonusBalance)}</div></div>
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
            <div className="mt-4 flex p-1 rounded-2xl bg-black/30 border hairline text-sm font-bold" role="tablist">
              <button role="tab" aria-selected={tab === 'qr'} onClick={() => { setTab('qr'); sfx.click(); }} className={clsx('flex-1 py-2 rounded-xl flex items-center justify-center gap-2', tab === 'qr' ? 'bg-lime' : 'c-ink2')}><QrCode className="w-4 h-4" />QR-код</button>
              <button role="tab" aria-selected={tab === 'bar'} onClick={() => { setTab('bar'); sfx.click(); }} className={clsx('flex-1 py-2 rounded-xl flex items-center justify-center gap-2', tab === 'bar' ? 'bg-lime' : 'c-ink2')}><BarcodeIcon className="w-4 h-4" />Штрихкод</button>
            </div>
            <div className="mt-3 rounded-3xl bg-[#f2f4fb] p-4">
              {tab === 'qr' ? (
                <div className="flex items-center gap-4">
                  <QrMatrix seed={seed + user.loyaltyCard} className="w-36 h-36 shrink-0" />
                  <div className="text-[#10131f]">
                    <div className="font-bold text-sm">Динамический QR</div>
                    <div className="text-xs text-[#5b6180] mt-1">Код обновляется каждые 30 секунд</div>
                    <div className="mt-3 flex items-center gap-2">
                      <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#dde1ef" strokeWidth="4" /><circle cx="18" cy="18" r="15" fill="none" stroke="#10131f" strokeWidth="4" strokeLinecap="round" strokeDasharray="94.25" strokeDashoffset={94.25 * (1 - left / 30)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
                      <span className="font-mono font-bold">0:{String(left).padStart(2, '0')}</span>
                    </div>
                  </div>
                </div>
              ) : <Barcode code={user.loyaltyCard} h={64} className="w-full" />}
            </div>
            <div className="mt-4 rounded-3xl glass p-4">
              <div className="font-bold text-sm flex items-center gap-2"><KeyRound className="w-4 h-4 c-yellow" />Одноразовый код для кассы</div>
              <div className="text-xs c-ink3 mt-0.5">Назовите кассиру, если нет сканера</div>
              {otp && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex gap-1.5">{otp.split('').map((d, k) => <span key={k + '-' + otpKey} className="otp-digit otp-roll" style={{ animationDelay: `${k * 60}ms` }}>{d}</span>)}</div>
                  <div className="ml-auto text-right">
                    <div className={clsx('font-mono text-sm font-bold', otpLeft <= 10 ? 'c-pink' : 'c-lime')}>{otpLeft} c</div>
                    <button onClick={() => { void navigator.clipboard?.writeText(otp); toast({ type: 'info', msg: 'Код скопирован' }); }} className="text-[11px] c-ink3 hover:text-white flex items-center gap-1"><Copy className="w-3 h-3" />копия</button>
                  </div>
                </div>
              )}
              <button onClick={genOtp} disabled={otpBusy} className="btn-yellow w-full rounded-xl py-3 mt-3 flex items-center justify-center gap-2 text-sm">{otpBusy ? <Spinner dark /> : <><Zap className="w-4 h-4" />{otp ? 'Сгенерировать новый' : 'Сгенерировать код'}</>}</button>
            </div>
            <div className="mt-4 rounded-3xl glass p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">Уровень {user.tier.name}</span>
                <span className="text-xs c-ink3">{user.nextTier ? `до ${user.nextTier.name}: ${money(user.nextTier.min - user.lifetimeSpend)}` : 'Максимальный уровень'}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full tr" style={{ width: `${user.nextTier ? (user.lifetimeSpend - user.tier.min) / (user.nextTier.min - user.tier.min) * 100 : 100}%`, background: `linear-gradient(90deg, ${user.tier.color}, var(--lime))` }} /></div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs c-ink3"><div className="flex items-center gap-1.5 font-bold"><span className={clsx('pulse-dot', syncing && 'sync')} />Баланс NEON CLUB</div><div className="mt-0.5">{synced ? `Синхронизировано ${timeAgo(synced)}` : 'Обновляется при каждом заказе'}</div></div>
                <button onClick={sync} disabled={syncing} className="btn-ghost rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5"><RefreshCw className={clsx('w-3.5 h-3.5', syncing && 'animate-spin')} />Обновить</button>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-bold c-ink3 uppercase tracking-widest mb-2">История</div>
              <div className="space-y-1.5">
                {user.bonusHistory.slice(0, 10).map(h => (
                  <div key={h.id} className="flex items-center gap-3 text-sm rounded-xl px-3 py-2 bg-black/20">
                    {h.delta > 0 ? <TrendingUp className="w-4 h-4 c-lime" /> : <TrendingDown className="w-4 h-4 c-pink" />}
                    <span className="flex-1 min-w-0 truncate c-ink2">{h.reason}</span>
                    <span className={clsx('font-mono font-bold', h.delta > 0 ? 'c-lime' : 'c-pink')}>{h.delta > 0 ? '+' : ''}{h.delta}</span>
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
