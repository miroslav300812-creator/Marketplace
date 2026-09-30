import clsx from 'clsx';
import { CircleCheck, CircleX, Coins, Info, MessageSquareText, TriangleAlert, X } from 'lucide-react';
import { useUi } from '../store/ui';

const ICONS = { ok: CircleCheck, info: Info, warn: TriangleAlert, err: CircleX, sms: MessageSquareText, coin: Coins };

export function Toasts() {
  const toasts = useUi(s => s.toasts), dismiss = useUi(s => s.dismiss);
  return (
    <div className="fixed z-[200] top-3 md:top-20 inset-x-3 flex flex-col items-center gap-2 pointer-events-none" style={{ paddingTop: 'var(--sat)' }} aria-live="polite">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className="toast-enter panel pointer-events-auto rounded-[26px] pl-4 pr-3 py-3 flex gap-3 items-start w-full max-w-[400px]">
            <Icon className={clsx('w-5 h-5 mt-0.5 shrink-0', t.type === 'err' ? 'c-pink' : t.type === 'coin' || t.type === 'sms' ? 'c-yellow' : 'c-ink2')} />
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-sm">{t.title}</div>}
              <div className={clsx('text-sm', t.title ? 'c-ink3' : 'c-ink2')}>{t.msg}</div>
              {t.code && t.onUse && (
                <button onClick={() => { t.onUse!(); dismiss(t.id); }} className="mt-2.5 btn-neon rounded-full h-8 px-4 text-xs">Вставить код <span className="font-mono">{t.code}</span></button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="w-7 h-7 rounded-full grid place-items-center c-ink3 hover-soft shrink-0" aria-label="Закрыть"><X className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
    </div>
  );
}
