import clsx from 'clsx';
import { Star, X } from 'lucide-react';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import type { Product } from '../types';

/** Swipe-down-to-close for bottom sheets on phones. Attach to the sheet header. */
export function useSheetDrag(onClose: () => void) {
  return (e: PointerEvent<HTMLElement>) => {
    if (window.innerWidth >= 768 || (e.target as HTMLElement).closest('button,input,a,select,textarea')) return;
    const sheet = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-sheet]');
    if (!sheet) return;
    const y0 = e.clientY; let dy = 0;
    sheet.style.transition = 'none';
    const move = (ev: globalThis.PointerEvent) => {
      // Rubber-band resistance: the glass follows the finger, then slows down like a viscous drop.
      const raw = Math.max(0, ev.clientY - y0);
      dy = raw < 120 ? raw : 120 + (raw - 120) * 0.55;
      sheet.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 300) / 3000})`;
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      sheet.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
      if (dy > 110) { sheet.style.transform = 'translateY(110%)'; setTimeout(onClose, 280); }
      else { sheet.style.transform = ''; setTimeout(() => { sheet.style.transition = ''; }, 620); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
}

type OverlayProps = {
  open: boolean; onClose?: () => void; children: ReactNode; label: string;
  variant?: 'center' | 'drawer'; z?: number; className?: string; closeOnBackdrop?: boolean;
};
/**
 * Spotlight overlay: the page behind is blurred and dimmed; the content floats as a glass slab.
 * `center` is a floating modal (bottom sheet on phones), `drawer` a floating side panel.
 */
export function Overlay({ open, onClose, children, label, variant = 'center', z = 80, className, closeOnBackdrop = true }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.focus({ preventScroll: true }); }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 backdrop fade-in" style={{ zIndex: z }} onClick={() => closeOnBackdrop && onClose?.()} />
      {variant === 'drawer' ? (
        <aside ref={ref} tabIndex={-1} data-sheet role="dialog" aria-label={label} style={{ zIndex: z + 5 }}
          className={clsx('drawer-enter panel fixed inset-x-2 bottom-2 max-h-[88vh] rounded-[32px] md:left-auto md:right-3 md:top-3 md:bottom-3 md:max-h-none md:w-[440px] flex flex-col overflow-hidden outline-none', className)}>
          {children}
        </aside>
      ) : (
        <div className="fixed inset-0 flex items-end md:items-center justify-center p-2 md:p-8 pointer-events-none" style={{ zIndex: z + 5 }}>
          <div ref={ref} tabIndex={-1} data-sheet role="dialog" aria-label={label}
            className={clsx('modal-in panel pointer-events-auto w-full max-h-[92vh] overflow-auto thin-scroll rounded-[32px] md:rounded-[36px] outline-none', className)}>
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
    <div onPointerDown={drag} style={{ touchAction: 'none' }} className="px-6 pt-3 pb-4">
      <div className="md:hidden flex justify-center mb-3"><span className="sheet-handle" /></div>
      <div className="flex items-center justify-between gap-3 md:pt-3">
        <h3 className="font-display text-xl flex items-center gap-2.5">{icon && <span className="c-ink3">{icon}</span>}{title}</h3>
        <div className="flex items-center gap-1">{extra}<CloseBtn onClick={onClose} /></div>
      </div>
    </div>
  );
}

export const CloseBtn = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button onClick={onClick} className={clsx('w-9 h-9 rounded-full hover-soft c-ink2 grid place-items-center shrink-0', className)} aria-label="Закрыть"><X className="w-4 h-4" strokeWidth={1.75} /></button>
);

export function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Рейтинг ${value.toFixed(1)} из 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={clsx('star', i <= Math.round(value) && 'on')}><Star className={clsx(size, 'fill-current')} strokeWidth={0} /></span>)}
    </span>
  );
}

export const Spinner = ({ className }: { dark?: boolean; className?: string }) => <span className={clsx('spinner inline-block', className)} />;

export const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={clsx('toggle', on && 'on')} />
);

export function Ribbon({ badge }: { badge: Product['badge'] }) {
  if (!badge) return null;
  return <span className={clsx('ribbon', badge === 'Sale' && 'rb-sale')}>{badge}</span>;
}

/** Kept for API compatibility: the product "photo" no longer sits on a tinted plate. */
export function useTint() {
  return (_catId: string) => 'transparent';
}

export function Orb({ emoji, className, emoClass, loaded = true, radius }: { emoji: string; tint?: string; className?: string; emoClass?: string; loaded?: boolean; radius?: number }) {
  return (
    <div className="badge3d">
      <div className={clsx('orb', className)} style={radius ? { borderRadius: radius } : undefined}>
        {loaded ? <span className="imgfade block" style={{ transformStyle: 'preserve-3d' }}><span className={clsx('emo block', emoClass)}>{emoji}</span></span>
          : <div className="skel absolute inset-[14%] !rounded-full" />}
      </div>
    </div>
  );
}

export const Field = ({ label, error, children, className }: { label: ReactNode; error?: string; children: ReactNode; className?: string }) => (
  <label className={clsx('block', className)}>
    <span className="text-xs font-medium c-ink3">{label}</span>
    <div className="mt-2">{children}</div>
    {error && <span className="text-xs c-pink mt-1.5 block">{error}</span>}
  </label>
);

/** Emoji tile used in compact lists (cart, search, orders). */
export const Tile = ({ emoji, size = 'w-12 h-12 text-2xl' }: { emoji: string; size?: string }) => (
  <span className={clsx('rounded-[18px] grid place-items-center shrink-0 well', size)} style={{ boxShadow: 'var(--hl-soft)' }}>{emoji}</span>
);
