import gsap from 'gsap';

const visible = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find(el => {
  const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
});

function spark(x: number, y: number) {
  const s = document.createElement('div');
  s.className = 'fly-spark';
  s.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
  s.style.setProperty('--t', `translate(${x - 4 + (Math.random() * 32 - 16)}px, ${y - 4 + Math.random() * 26}px)`);
  s.style.background = Math.random() < 0.5 ? 'var(--lime)' : 'var(--yellow)';
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 600);
}

function impact(target: HTMLElement) {
  const r = target.getBoundingClientRect();
  [0, 130].forEach(delay => setTimeout(() => {
    const ring = document.createElement('div');
    ring.className = 'ripple-ring';
    const size = Math.max(r.width, r.height) * 1.15;
    Object.assign(ring.style, { left: r.left + r.width / 2 + 'px', top: r.top + r.height / 2 + 'px', width: size + 'px', height: size + 'px' });
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 750);
  }, delay));
  gsap.killTweensOf(target);
  gsap.timeline()
    .to(target, { scaleX: 1.32, scaleY: 0.7, duration: 0.09, ease: 'power2.out' })
    .to(target, { scaleX: 0.86, scaleY: 1.24, duration: 0.12, ease: 'power2.out' })
    .to(target, { scale: 1, duration: 0.7, ease: 'elastic.out(1.1, .32)' });
  const badge = target.querySelector('[data-count]');
  if (badge) { badge.classList.remove('count-pop'); void (badge as HTMLElement).offsetWidth; badge.classList.add('count-pop'); }
}

/** Flies a 3D emoji badge from `src` to the visible cart icon along a quadratic bezier. */
export function flyToCart(src: Element | null | undefined, emoji: string, delay = 0) {
  if (!src || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = visible('[data-cart-target]');
  if (!target) return;
  const s = src.getBoundingClientRect(), t = target.getBoundingClientRect();
  const x0 = s.left + s.width / 2, y0 = s.top + s.height / 2, x2 = t.left + t.width / 2, y2 = t.top + t.height / 2;
  const cx = x0 + (x2 - x0) * 0.3, cy = Math.min(y0, y2) - Math.max(140, Math.abs(x2 - x0) * 0.3);
  const el = document.createElement('div');
  el.className = 'fly-badge'; el.textContent = emoji; el.style.opacity = '0';
  document.body.appendChild(el);
  const o = { p: 0 }; let frame = 0;
  gsap.to(o, {
    p: 1, duration: 0.9, delay, ease: 'power1.inOut',
    onUpdate: () => {
      const p = o.p, q = 1 - p;
      const x = q * q * x0 + 2 * q * p * cx + p * p * x2, y = q * q * y0 + 2 * q * p * cy + p * p * y2;
      const sc = p < 0.18 ? 1 + p * 1.6 : 1.29 - (p - 0.18) * 1.15;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) perspective(420px) rotateY(${p * 360}deg) rotateZ(${-p * 28}deg) scale(${sc})`;
      el.style.opacity = p > 0.9 ? String(1 - (p - 0.9) / 0.1) : '1';
      if (++frame % 3 === 0) spark(x, y);
    },
    onComplete: () => { el.remove(); impact(target); }
  });
}

export function countTo(from: number, to: number, onUpdate: (v: number) => void) {
  const o = { v: from };
  return gsap.to(o, { v: to, duration: 1.1, ease: 'power2.out', onUpdate: () => onUpdate(Math.round(o.v)), onComplete: () => onUpdate(to) });
}
