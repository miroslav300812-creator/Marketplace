/** Web Audio synthesiser for UI sounds plus light vibration feedback. */
class SoundEngine {
  enabled = (() => { try { return localStorage.getItem('nm_sound') !== '0'; } catch { return true; } })();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private get ready() {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return null;
        this.ctx = new C();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch { return null; }
  }
  set(on: boolean) { this.enabled = on; try { localStorage.setItem('nm_sound', on ? '1' : '0'); } catch { /* ignore */ } if (on) this.success(); }
  haptic(p: number | number[] = 8) { try { if (this.enabled && navigator.vibrate) navigator.vibrate(p); } catch { /* no haptics */ } }
  private tone({ f = 440, f2 = 0, d = 0.15, type = 'sine' as OscillatorType, v = 0.3, at = 0 }) {
    const c = this.ready; if (!c || !this.master) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + d + 0.03);
  }
  private noise(d = 0.35, v = 0.14, f = 350, f2 = 3200) {
    const c = this.ready; if (!c || !this.master) return;
    const t = c.currentTime, len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp).connect(g).connect(this.master); src.start(t); src.stop(t + d);
  }
  pop() { this.tone({ f: 380, f2: 920, d: 0.12, v: 0.35 }); this.tone({ f: 1500, f2: 1900, d: 0.05, type: 'triangle', v: 0.07, at: 0.02 }); this.haptic(10); }
  click() { this.tone({ f: 1150, f2: 700, d: 0.045, type: 'triangle', v: 0.12 }); this.haptic(5); }
  coin() { this.tone({ f: 988, d: 0.09, type: 'square', v: 0.08 }); this.tone({ f: 1319, d: 0.4, type: 'square', v: 0.08, at: 0.08 }); this.haptic([8, 40, 8]); }
  coins() { [0, 0.07, 0.15, 0.24, 0.34].forEach((t, i) => { this.tone({ f: 1568 + i * 110, d: 0.11, type: 'square', v: 0.05, at: t }); this.tone({ f: 2093 + i * 140, d: 0.28, v: 0.045, at: t + 0.03 }); }); this.haptic([6, 30, 6, 30, 6]); }
  success() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, d: 0.24, type: 'triangle', v: 0.15, at: i * 0.08 })); this.haptic([10, 30, 10]); }
  error() { this.tone({ f: 220, f2: 130, d: 0.26, type: 'sawtooth', v: 0.07 }); this.haptic([30, 40, 30]); }
  whoosh() { this.noise(); }
}
export const sfx = new SoundEngine();
