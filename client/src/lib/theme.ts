import { useEffect } from 'react';

export type Theme = 'system' | 'dark' | 'light';
const KEY = 'nm_theme';

export function readTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : 'system'; } catch { return 'system'; }
}
export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
}

/**
 * One delegated listener drives two effects:
 * - a specular highlight that follows the pointer over any `.glass-i` surface;
 * - a scroll offset that lets the background light drops drift under the glass.
 */
export function useLiquidEnvironment() {
  useEffect(() => {
    applyTheme(readTheme());
    let raf = 0, lastEl: HTMLElement | null = null, lx = 0, ly = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      lx = e.clientX; ly = e.clientY;
      lastEl = (e.target as HTMLElement).closest?.('.glass-i') ?? null;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!lastEl) return;
        const r = lastEl.getBoundingClientRect();
        lastEl.style.setProperty('--px', `${lx - r.left}px`);
        lastEl.style.setProperty('--py', `${ly - r.top}px`);
      });
    };
    let sraf = 0;
    const onScroll = () => {
      if (sraf) return;
      sraf = requestAnimationFrame(() => { sraf = 0; document.documentElement.style.setProperty('--scroll', String(scrollY)); });
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('pointermove', onMove); removeEventListener('scroll', onScroll); };
  }, []);
}
