import clsx from 'clsx';
import { Star, X } from 'lucide-react';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import type { Product } from '../types';
import { useCatalog } from '../store/catalog';

/** Swipe-down-to-close for bottom sheets on phones. Attach to the sheet header. */
export function useSheetDrag(onClose: () => void) {
  return (e: PointerEvent<HTMLElement>) => {
    if (window.innerWidth >= 768 || (e.target as HTMLElement).closest('button,input,a,select,textarea')) return;
    const sheet = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-sheet]');
    if (!sheet) return;
    const y0 = e.clientY; let dy = 0;
    sheet.style.transition = 'none';
    const move = (ev: globalThis.PointerEvent) => { dy = Math.max(0, ev.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      sheet.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1)';
      if (dy > 110) { sheet.style.transform = 'translateY(100%)'; setTimeout(onClose, 260); }
      else { sheet.style.transform = ''; setTimeout(() => { sheet.style.transition = ''; }, 320); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
}

type OverlayProps = {
  open: boolean; onClose?: () => void; children: ReactNode; label: string;
  variant?: 'center' | 'drawer'; z?: number; className?: string; closeOnBackdrop?: boolean;
};
/** Backdrop + panel. `center` is a modal on desktop / bottom sheet on phones; `drawer` slides from the right. */
export function Overlay({ open, onClose, children, label, variant = 'center', z = 80, className, closeOnBackdrop = true }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 backdrop fade-in" style={{ zIndex: z }} onClick={() => closeOnBackdrop && onClose?.()} />
      {variant === 'drawer' ? (
        <aside ref={ref} tabIndex={-1} data-sheet role="dialog" aria-label={label} style={{ zIndex: z + 5 }}
          className={clsx('drawer-enter fixed inset-x-0 bottom-0 max-h-[90vh] rounded-t-[28px] md:rounded-none md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[460px] panel flex flex-col outline-none', className)}>
          {children}
        </aside>
      ) : (
        <div className="fixed inset-0 flex items-end md:items-center justify-center md:p-6 pointer-events-none" style={{ zIndex: z + 5 }}>
          <div ref={ref} tabIndex={-1} data-sheet role="dialog" aria-label={label}
            className={clsx('modal-in pointer-events-auto w-full max-h-[94vh] overflow-auto thin-scroll panel rounded-t-[28px] md:rounded-[28px] outline-none', className)}>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

export function SheetHeader({ title, icon, onClose, extra }: { title: ReactNode; icon?: ReactNode; onClose: () => void; extra?: ReactNode }) {
  const drag = useSheetDrag(onClose);
  return (
    <div onPointerDown={drag} style={{ touchAction: 'none' }} className="px-5 pt-3 pb-4 border-b hairline">
      <div className="md:hidden flex justify-center mb-3"><span className="sheet-handle" /></div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display font-bold text-xl flex items-center gap-2.5">{icon}{title}</h3>
        <div className="flex items-center gap-1">{extra}<CloseBtn onClick={onClose} /></div>
      </div>
    </div>
  );
}

export const CloseBtn = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button onClick={onClick} className={clsx('w-9 h-9 rounded-xl btn-ghost grid place-items-center shrink-0', className)} aria-label="Закрыть"><X className="w-4 h-4" /></button>
);

export function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Рейтинг ${value.toFixed(1)} из 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={clsx('star', i <= Math.round(value) && 'on')}><Star className={clsx(size, 'fill-current')} strokeWidth={1.5} /></span>)}
    </span>
  );
}

export const Spinner = ({ dark, className }: { dark?: boolean; className?: string }) => <span className={clsx('spinner inline-block', dark && '!border-black/30 !border-t-black', className)} />;

export const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={clsx('toggle', on && 'on')} />
);

export function Ribbon({ badge }: { badge: Product['badge'] }) {
  if (!badge) return null;
  return <span className={clsx('ribbon', badge === 'Хит' ? 'rb-hit' : badge === 'Sale' ? 'rb-sale' : 'rb-new')}>{badge}</span>;
}

export function useTint() {
  const cats = useCatalog(s => s.data?.categories);
  return (catId: string) => cats?.find(c => c.id === catId)?.tint ?? 'rgba(198,255,61,.5)';
}

export function Orb({ emoji, tint, className, emoClass, loaded = true, radius }: { emoji: string; tint: string; className?: string; emoClass?: string; loaded?: boolean; radius?: number }) {
  return (
    <div className="badge3d">
      <div className={clsx('orb', className)} style={{ ['--tint' as string]: tint, ...(radius ? { borderRadius: radius } : {}) }}>
        {loaded ? <span className="imgfade block" style={{ transformStyle: 'preserve-3d' }}><span className={clsx('emo block', emoClass)}>{emoji}</span></span>
          : <div className="skel absolute inset-0 !rounded-[22px]" />}
      </div>
    </div>
  );
}

export const Field = ({ label, error, children, className }: { label: ReactNode; error?: string; children: ReactNode; className?: string }) => (
  <label className={clsx('block', className)}>
    <span className="text-xs font-bold c-ink3">{label}</span>
    <div className="mt-1.5">{children}</div>
    {error && <span className="text-xs c-pink font-semibold mt-1 block">{error}</span>}
  </label>
);
