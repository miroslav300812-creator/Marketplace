import clsx from 'clsx';
import { CircleCheck, CircleX, Coins, Info, MessageSquareText, TriangleAlert, X } from 'lucide-react';
import { useUi, type Toast } from '../store/ui';

const ICONS = { ok: CircleCheck, info: Info, warn: TriangleAlert, err: CircleX, sms: MessageSquareText, coin: Coins };
const TONE: Record<Toast['type'], string> = {
  ok: 'bg-[rgba(198,255,61,.15)] c-lime', info: 'bg-[rgba(34,227,255,.15)] c-cyan', warn: 'bg-[rgba(252,238,10,.15)] c-yellow',
  coin: 'bg-[rgba(252,238,10,.15)] c-yellow', err: 'bg-[rgba(255,61,129,.15)] c-pink', sms: 'bg-[#22c55e] text-white'
};

export function Toasts() {
  const toasts = useUi(s => s.toasts), dismiss = useUi(s => s.dismiss);
  return (
    <div className="fixed z-[200] top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-[380px] space-y-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className={clsx('toast-enter pointer-events-auto rounded-2xl p-3.5 flex gap-3 items-start shadow-2xl', t.type === 'sms' ? 'bg-[#f2f4fb] text-[#10131f]' : 'panel')}>
            <span className={clsx('w-9 h-9 rounded-xl grid place-items-center shrink-0', TONE[t.type])}><Icon className="w-5 h-5" /></span>
            <div className="flex-1 min-w-0">
              {t.title && <div className="font-bold text-sm">{t.title}</div>}
              <div className={clsx('text-sm', t.type === 'sms' ? 'text-[#3b4160]' : 'c-ink2')}>{t.msg}</div>
              {t.code && t.onUse && (
                <button onClick={() => { t.onUse!(); dismiss(t.id); }} className="mt-2 text-xs font-extrabold rounded-lg px-3 py-1.5 bg-[#10131f] text-[var(--lime)]">Вставить код {t.code}</button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0" aria-label="Закрыть"><X className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
