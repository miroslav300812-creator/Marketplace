import clsx from 'clsx';
import { Check, CircleX, CreditCard, Fingerprint, Lock, Minus, ScanFace, Shield, ShieldCheck, Smartphone, Wallet, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { confetti } from '../lib/confetti';
import { money } from '../lib/format';
import { sfx } from '../lib/sound';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Order } from '../types';
import { CloseBtn, Overlay, Spinner } from './ui';

const STEPS = ['Защищённое соединение с LiqPay', 'Авторизация в банке-эмитенте', '3-D Secure верификация', 'Фиксация платежа'];
type StepState = 'wait' | 'active' | 'done' | 'skip' | 'fail';
type Stage = 'form' | 'wallet' | 'processing' | '3ds' | 'success' | 'failed';
type ChargeResult = { status: 'success'; order: Order } | { status: '3ds_verify'; txId: string; devOtp?: string } | { status: 'failure'; message: string };
const TEST_CARDS = [['4242 4242 4242 4242', 'успех', 'c-lime'], ['4000 0000 0000 3220', '3-D Secure', 'c-cyan'], ['4000 0000 0000 0002', 'отказ', 'c-pink']];
const luhn = (n: string) => { const d = n.replace(/\D/g, ''); let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let x = +d[i]; if (alt) { x *= 2; if (x > 9) x -= 9; } s += x; alt = !alt; } return d.length === 16 && s % 10 === 0; };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Sandbox stand-in for LiqPay's hosted checkout, used when no LiqPay keys are configured. */
export function PaymentModal() {
  const pay = useUi(s => s.pay), set = useUi(s => s.set), toast = useUi(s => s.toast);
  const profile = useSession(s => s.profile), setProfile = useSession(s => s.setProfile), refresh = useSession(s => s.refresh);
  const order = pay?.order;
  const method = order?.paymentMethod === 'cash' ? 'card' : order?.paymentMethod ?? 'card';
  const [stage, setStage] = useState<Stage>('form');
  const [steps, setSteps] = useState<StepState[]>(['wait', 'wait', 'wait', 'wait']);
  const [card, setCard] = useState({ num: '', exp: '', cvv: '', holder: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [flip, setFlip] = useState(false);
  const [err, setErr] = useState('');
  const [tx, setTx] = useState(''), [otp, setOtp] = useState('');
  const [wallet, setWallet] = useState<'idle' | 'auth' | 'ok'>('idle');

  useEffect(() => {
    if (!order) return;
    setStage(method === 'card' ? 'form' : 'wallet'); setSteps(['wait', 'wait', 'wait', 'wait']); setErr(''); setWallet('idle');
    setCard({ num: '', exp: '', cvv: '', holder: (profile.name || '').toUpperCase() });
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pay || !order) return null;

  const close = () => { if (stage === 'processing') return; set({ pay: null }); if (stage !== 'success') toast({ type: 'info', msg: `Заказ ${order.id} ждёт оплаты — оплатить можно в «Мои заказы»` }); };
  const mark = (i: number, s: StepState) => setSteps(p => p.map((x, j) => (j === i ? s : x)));
  const brand = /^4/.test(card.num) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(card.num) ? 'Mastercard' : '';

  const finish = (o: Order) => {
    mark(3, 'active');
    setTimeout(() => {
      mark(3, 'done'); setStage('success'); sfx.success();
      if (method === 'card' && profile.rememberCard && o.paymentMask) setProfile({ savedCard: '•••• ' + o.paymentMask.slice(-4) });
      void refresh();
      setTimeout(() => { set({ pay: null, receipt: o }); confetti.rain(); if (o.bonusEarned) { sfx.coins(); toast({ type: 'coin', title: `+${o.bonusEarned} бонусов`, msg: 'Кэшбэк начислен на карту NEON CLUB' }); } }, 1000);
    }, 500);
  };
  const handle = (r: ChargeResult) => {
    if (r.status === 'success') { mark(1, 'done'); setSteps(p => p.map((x, j) => (j === 2 ? (x === 'active' || x === 'done' ? 'done' : 'skip') : x))); finish(r.order); }
    else if (r.status === '3ds_verify') {
      mark(1, 'done'); mark(2, 'active'); setTx(r.txId); setOtp(''); setStage('3ds');
      if (r.devOtp) setTimeout(() => toast({ type: 'sms', title: 'Банк · 3-D Secure (демо)', msg: `Код для оплаты ${money(order.total)}: ${r.devOtp}`, code: r.devOtp, ttl: 15000, onUse: () => { setOtp(r.devOtp!); void confirm3ds(r.devOtp!, r.txId); } }), 700);
    } else { mark(1, 'fail'); setErr(r.message); setStage('failed'); sfx.error(); }
  };
  const charge = async (body: object) => {
    setStage('processing'); setErr(''); setSteps(['active', 'wait', 'wait', 'wait']);
    await wait(700); mark(0, 'done'); mark(1, 'active');
    try { handle(await api.post<ChargeResult>('/payments/mock/charge', { orderId: order.id, ...body })); }
    catch (e) { mark(1, 'fail'); setErr((e as Error).message); setStage('failed'); sfx.error(); }
  };
  const submitCard = () => {
    const e: Record<string, string> = {};
    if (!luhn(card.num)) e.num = 'Неверный номер карты';
    const m = /^(\d{2})\/(\d{2})$/.exec(card.exp);
    if (!m || +m[1] < 1 || +m[1] > 12) e.exp = 'ММ/ГГ'; else if (new Date(2000 + +m[2], +m[1], 1) < new Date()) e.exp = 'Карта просрочена';
    if (!/^\d{3}$/.test(card.cvv)) e.cvv = '3 цифры';
    setErrs(e);
    if (Object.keys(e).length) { sfx.error(); return; }
    void charge({ method: 'card', card: { number: card.num, exp: card.exp, cvv: card.cvv } });
  };
  async function confirm3ds(code = otp, txId = tx) {
    if (!/^\d{6}$/.test(code)) { setErr('Введите 6 цифр'); sfx.error(); return; }
    setStage('processing'); setErr('');
    try { const r = await api.post<ChargeResult>('/payments/mock/3ds', { txId, otp: code }); mark(2, 'done'); handle(r); }
    catch (e) { setStage('3ds'); setErr((e as Error).message); sfx.error(); }
  }
  const walletPay = async () => { setWallet('auth'); sfx.click(); await wait(1500); setWallet('ok'); sfx.pop(); await wait(400); void charge({ method }); };

  return (
    <Overlay open onClose={close} label="Оплата LiqPay" z={110} className="md:max-w-[440px]" closeOnBackdrop={false}>
      <div>
        <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b hairline">
          <span className="w-10 h-10 rounded-[16px] grid place-items-center font-display text-sm well" style={{ boxShadow: 'var(--hl-soft)' }}>Lp</span>
          <div className="flex-1"><div className="font-medium text-sm flex items-center gap-2">LiqPay Checkout <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-lime">SANDBOX</span></div><div className="text-[11px] c-ink3">Тестовый режим · заказ {order.id}</div></div>
          {stage !== 'processing' && stage !== 'success' && <CloseBtn onClick={close} />}
        </div>
        <div className="px-5 pt-4 flex items-end justify-between"><div className="text-xs c-ink3">К оплате</div><div className="font-display text-2xl">{money(order.total)}</div></div>

        {stage === 'form' && (
          <div className="p-5 space-y-4">
            <div className="ccard max-w-[340px] mx-auto">
              <div className={clsx('ccard-inner', flip && 'flip')}>
                <div className="ccard-face flex flex-col justify-between">
                  <div className="flex items-center justify-between"><div className="w-10 h-[30px] rounded-[9px] well" style={{ boxShadow: 'var(--hl)' }} /><span className="font-display italic text-lg">{brand || '••••'}</span></div>
                  <div className="font-mono text-lg tracking-[.14em]">{(card.num || '•••• •••• •••• ••••').padEnd(19, '•')}</div>
                  <div className="flex justify-between text-xs"><div><div className="text-[9px] opacity-60">ДЕРЖАТЕЛЬ</div><div className="font-medium uppercase truncate max-w-[180px]">{card.holder || 'CARD HOLDER'}</div></div><div className="text-right"><div className="text-[9px] opacity-60">СРОК</div><div className="font-mono font-medium">{card.exp || 'ММ/ГГ'}</div></div></div>
                </div>
                <div className="ccard-face ccard-back"><div className="h-10 bg-black/80 mt-6" /><div className="mx-5 mt-5 h-9 rounded bg-white/90 flex items-center justify-end px-3 font-mono font-medium text-[var(--on-accent)]">{card.cvv ? card.cvv.replace(/./g, '•') : 'CVV'}</div></div>
              </div>
            </div>
            <label className="block"><span className="text-xs font-medium c-ink3">Номер карты</span>
              <input value={card.num} onChange={e => setCard({ ...card, num: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() })} onFocus={() => setFlip(false)} inputMode="numeric" autoComplete="cc-number" className={clsx('field mt-1.5 font-mono tracking-wider', errs.num && 'err')} placeholder="0000 0000 0000 0000" />
              {errs.num && <span className="text-xs c-pink font-semibold mt-1 block">{errs.num}</span>}</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium c-ink3">Срок</span>
                <input value={card.exp} onChange={e => { let d = e.target.value.replace(/\D/g, '').slice(0, 4); if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2); setCard({ ...card, exp: d }); }} onFocus={() => setFlip(false)} inputMode="numeric" autoComplete="cc-exp" className={clsx('field mt-1.5 font-mono', errs.exp && 'err')} placeholder="ММ/ГГ" />
                {errs.exp && <span className="text-xs c-pink font-semibold mt-1 block">{errs.exp}</span>}</label>
              <label className="block"><span className="text-xs font-medium c-ink3">CVV</span>
                <input value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })} onFocus={() => setFlip(true)} onBlur={() => setFlip(false)} type="password" inputMode="numeric" autoComplete="cc-csc" className={clsx('field mt-1.5 font-mono', errs.cvv && 'err')} placeholder="•••" />
                {errs.cvv && <span className="text-xs c-pink font-semibold mt-1 block">{errs.cvv}</span>}</label>
            </div>
            <label className="block"><span className="text-xs font-medium c-ink3">Имя на карте</span><input value={card.holder} onChange={e => setCard({ ...card, holder: e.target.value })} onFocus={() => setFlip(false)} autoComplete="cc-name" className="field mt-1.5 uppercase" placeholder="TARAS SHEVCHENKO" /></label>
            <label className="flex items-center gap-2.5 text-xs c-ink2 cursor-pointer"><input type="checkbox" className="cbx !w-5 !h-5" checked={profile.rememberCard} onChange={e => setProfile({ rememberCard: e.target.checked })} />Запомнить маску карты для следующих заказов</label>
            <div className="rounded-[24px] well border border-dashed border-[var(--stroke-2)] p-3">
              <div className="text-[11px] font-medium c-ink3 mb-2">Тестовые карты (нажмите, чтобы подставить):</div>
              <div className="space-y-1.5 text-xs">{TEST_CARDS.map(([n, l, c]) => <button key={n} onClick={() => { setCard({ ...card, num: n, exp: '12/29', cvv: '123' }); setErrs({}); sfx.click(); }} className="w-full flex justify-between hover:text-[var(--lime)]"><span className="font-mono">{n}</span><span className={c}>{l}</span></button>)}</div>
            </div>
            <button onClick={submitCard} className="btn-neon w-full rounded-full py-4 flex items-center justify-center gap-2"><Lock className="w-4 h-4" />Оплатить {money(order.total)}</button>
          </div>
        )}

        {stage === 'wallet' && (
          <div className="p-5">
            <div className={clsx('rounded-[30px] p-6 text-center', method === 'apple' ? 'bg-black' : 'bg-white text-[#1f1f1f]')}>
              <div className="font-medium text-lg flex items-center justify-center gap-2">{method === 'apple' ? <><Smartphone className="w-5 h-5" />Pay</> : <><Wallet className="w-5 h-5" />G Pay</>}</div>
              <div className="text-sm opacity-70 mt-1">NEON MARKET</div>
              <div className="font-display text-3xl mt-3">{money(order.total)}</div>
              <div className="mt-4 text-xs opacity-70 flex items-center justify-center gap-2"><CreditCard className="w-4 h-4" />{method === 'apple' ? 'Visa •••• 4242' : 'Mastercard •••• 5454'}</div>
              <div className="mt-6 grid place-items-center">
                <button onClick={() => wallet === 'idle' && void walletPay()} className={clsx('w-20 h-20 rounded-full grid place-items-center tr', wallet === 'auth' && 'bio-pulse ring-2 ring-[var(--lime)]', wallet === 'ok' && 'bg-lime', wallet === 'idle' && (method === 'apple' ? 'bg-[var(--track)]' : 'bg-black/5'))} aria-label="Подтвердить оплату">
                  {wallet === 'ok' ? <Check className="w-10 h-10" /> : method === 'apple' ? <ScanFace className="w-10 h-10" strokeWidth={1.6} /> : <Fingerprint className="w-10 h-10" strokeWidth={1.6} />}
                </button>
                <div className="text-sm mt-3 font-semibold">{wallet === 'idle' ? (method === 'apple' ? 'Нажмите для Face ID' : 'Коснитесь для подтверждения') : wallet === 'auth' ? 'Проверка биометрии…' : 'Готово'}</div>
              </div>
            </div>
          </div>
        )}

        {(stage === 'processing' || stage === 'success') && (
          <div className="p-5">
            <div className="space-y-3">
              {STEPS.map((t, i) => (
                <div key={t} className={clsx('proc-step flex items-center gap-3 tr', steps[i] === 'active' && 'active', ['done', 'skip'].includes(steps[i]) && 'done')}>
                  <span className="w-7 h-7 grid place-items-center">
                    {steps[i] === 'active' && <Spinner />}
                    {steps[i] === 'done' && <span className="w-6 h-6 rounded-full bg-lime grid place-items-center"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                    {steps[i] === 'skip' && <span className="w-6 h-6 rounded-full bg-[var(--track)] grid place-items-center c-ink3"><Minus className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                    {steps[i] === 'wait' && <span className="w-2 h-2 rounded-full bg-white/30" />}
                    {steps[i] === 'fail' && <span className="w-6 h-6 rounded-full bg-[var(--pink)] grid place-items-center"><X className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                  </span>
                  <span className="text-sm font-semibold">{t}{steps[i] === 'skip' && ' — не требуется'}</span>
                </div>
              ))}
            </div>
            {stage === 'success' && <div className="mt-6 text-center fade-in"><div className="w-20 h-20 rounded-full bg-lime grid place-items-center mx-auto bio-pulse"><Check className="w-10 h-10" strokeWidth={3} /></div><div className="font-display text-xl mt-4">Оплата прошла успешно</div></div>}
          </div>
        )}

        {stage === '3ds' && (
          <div className="p-5">
            <div className="rounded-[30px] paper text-[var(--paper-ink)] p-5">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck className="w-5 h-5 text-[#1fa34a]" />3-D Secure · Банк-эмитент</div>
              <p className="text-sm text-[#5b6180] mt-2">Подтвердите оплату {money(order.total)} в NEON MARKET одноразовым кодом из SMS.</p>
              <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && void confirm3ds()} inputMode="numeric" autoComplete="one-time-code" className="mt-4 w-full rounded-[16px] border-2 border-[#dde1ef] focus:border-[#1fa34a] outline-none px-4 py-3 text-center font-mono text-2xl tracking-[.4em] bg-white" placeholder="••••••" aria-label="Код 3-D Secure" />
              {err && <div className="text-xs text-[#e11d48] font-semibold mt-2">{err}</div>}
              <button onClick={() => void confirm3ds()} className="w-full rounded-full h-12 mt-4 font-medium text-white bg-[#111214]">Подтвердить</button>
            </div>
          </div>
        )}

        {stage === 'failed' && (
          <div className="p-5 text-center">
            <div className="w-20 h-20 rounded-full grid place-items-center mx-auto" style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}><CircleX className="w-10 h-10" strokeWidth={1.8} /></div>
            <div className="font-display text-xl mt-4">Платёж отклонён</div>
            <p className="text-sm c-ink2 mt-2">{err}</p>
            <button onClick={() => { setStage(method === 'card' ? 'form' : 'wallet'); setWallet('idle'); setErr(''); sfx.click(); }} className="btn-neon w-full rounded-full py-3.5 mt-5">Попробовать снова</button>
          </div>
        )}
        <div className="px-5 pb-5 text-center text-[10px] c-ink3 flex items-center justify-center gap-1.5"><Shield className="w-3 h-3" />Эмулятор LiqPay · добавьте ключи в .env для реальных платежей</div>
      </div>
    </Overlay>
  );
}
