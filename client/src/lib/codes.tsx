import type { ReactElement } from 'react';
/* Real EAN-13 barcodes and a decorative rotating QR-style matrix. */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13(code: string) {
  const d = code.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * (i % 2 ? 3 : 1);
  return d + ((10 - (s % 10)) % 10);
}

export function Barcode({ code, h = 56, color = '#0b0f1e', className = '' }: { code: string; h?: number; color?: string; className?: string }) {
  const c = ean13(code);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (P[+c[0]][i - 1] === 'L' ? L : G)[+c[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[+c[i]];
  bits += '101';
  const guard = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  const bars: ReactElement[] = [];
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') bars.push(<rect key={i} x={i + 9} y={0} width={1.02} height={guard.has(i) ? h + 6 : h} />);
  return (
    <svg viewBox={`0 0 113 ${h + 14}`} className={className} shapeRendering="crispEdges" fill={color} role="img" aria-label={`EAN-13 ${c}`}>
      {bars}
      <g fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="700" textAnchor="middle">
        <text x="4" y={h + 11}>{c[0]}</text>
        <text x="33" y={h + 11} letterSpacing="1.6">{c.slice(1, 7)}</text>
        <text x="80" y={h + 11} letterSpacing="1.6">{c.slice(7)}</text>
      </g>
    </svg>
  );
}

function rng(seed: string) {
  let t = 2166136261; for (let i = 0; i < seed.length; i++) { t ^= seed.charCodeAt(i); t = Math.imul(t, 16777619); }
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export function QrMatrix({ seed, className = '' }: { seed: string; className?: string }) {
  const N = 25, r = rng(seed), m = Array.from({ length: N }, () => Array<number>(N).fill(0));
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const on = (x >= 0 && x <= 6 && (y === 0 || y === 6)) || (y >= 0 && y <= 6 && (x === 0 || x === 6)) || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      m[Y][X] = on ? 2 : 3;
    }
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0 ? 2 : 3; m[i][6] = i % 2 === 0 ? 2 : 3; }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) m[N - 9 + y][N - 9 + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1 ? 2 : 3;
  const cells: ReactElement[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (m[y][x] === 0) m[y][x] = r() < 0.52 ? 1 : 0;
    if (m[y][x] === 1 || m[y][x] === 2) cells.push(<rect key={y * N + x} x={x + 2} y={y + 2} width={1.02} height={1.02} />);
  }
  return <svg viewBox={`0 0 ${N + 4} ${N + 4}`} className={className} shapeRendering="crispEdges" fill="currentColor">{cells}</svg>;
}
