type Part = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; tilt: number; color: string; circle: boolean; life: number; ttl: number };
const COLORS = ['#c6ff3d', '#fcee0a', '#22e3ff', '#ff3d81', '#8b5cff', '#ffffff'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Canvas confetti drawn on a single full-screen canvas. */
class Confetti {
  private parts: Part[] = [];
  private running = false;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private dpr = 1;

  private ensure() {
    if (this.canvas) return;
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10000';
    document.body.appendChild(c);
    this.canvas = c; this.ctx = c.getContext('2d')!;
    const resize = () => { this.dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * this.dpr; c.height = innerHeight * this.dpr; };
    resize(); addEventListener('resize', resize);
  }
  burst({ x = innerWidth / 2, y = innerHeight / 2, count = 110, spread = 60, power = 14, angle = -90 } = {}) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.ensure();
    for (let i = 0; i < count; i++) {
      const a = (angle + rand(-spread, spread)) * Math.PI / 180, sp = rand(power * 0.4, power);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: rand(6, 11), h: rand(8, 16), rot: rand(0, 6.28), vr: rand(-0.3, 0.3), tilt: rand(0, 6.28), color: COLORS[i % COLORS.length], circle: Math.random() < 0.3, life: 0, ttl: rand(90, 160) });
    }
    if (!this.running) { this.running = true; requestAnimationFrame(() => this.tick()); }
  }
  at(el: Element | null, opts = {}) {
    const r = el?.getBoundingClientRect();
    this.burst({ x: r ? r.left + r.width / 2 : innerWidth / 2, y: r ? r.top + r.height / 2 : innerHeight / 2, ...opts });
  }
  rain() {
    this.burst({ x: innerWidth * 0.15, y: innerHeight * 0.9, angle: -65, spread: 25, power: 22, count: 90 });
    this.burst({ x: innerWidth * 0.85, y: innerHeight * 0.9, angle: -115, spread: 25, power: 22, count: 90 });
    setTimeout(() => this.burst({ x: innerWidth / 2, y: innerHeight * 0.35, spread: 180, power: 10, count: 80 }), 250);
  }
  private tick() {
    const c = this.ctx!;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    this.parts = this.parts.filter(p => p.life < p.ttl && p.y < innerHeight + 40);
    for (const p of this.parts) {
      p.life++; p.vy += 0.33; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tilt += 0.12;
      c.save(); c.globalAlpha = 1 - Math.max(0, (p.life - p.ttl * 0.7) / (p.ttl * 0.3));
      c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color;
      if (p.circle) { c.beginPath(); c.arc(0, 0, p.w / 2, 0, 6.283); c.fill(); } else { c.scale(1, Math.cos(p.tilt)); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      c.restore();
    }
    if (this.parts.length) requestAnimationFrame(() => this.tick());
    else { this.running = false; c.clearRect(0, 0, innerWidth, innerHeight); }
  }
}
export const confetti = new Confetti();
