import { LocateFixed, Map as MapIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Coverage, Store } from '../types';

const riverX = (y: number) => 548 + 36 * Math.sin(y / 82) + 14 * Math.sin(y / 31);

function rng(seed: number) {
  let t = seed;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/** Static stylised city (blocks, river, avenues). Generated once; trusted markup. */
function buildBase() {
  const r = rng(20260930);
  let s = '<rect x="-50" y="-50" width="900" height="600" fill="#070d22"/>';
  for (let x = 8; x < 800; x += 46) for (let y = 8; y < 500; y += 38) {
    if (Math.abs(x + 20 - riverX(y + 16)) < 44) continue;
    const k = r();
    s += `<rect x="${x}" y="${y}" width="${38 + Math.floor(r() * 3)}" height="${30 + Math.floor(r() * 3)}" rx="4" fill="${k < 0.08 ? '#0c2a24' : k < 0.3 ? '#0e1a3d' : '#0b1533'}" stroke="${k < 0.08 ? 'rgba(198,255,61,.14)' : 'rgba(120,140,220,.08)'}"/>`;
  }
  let river = '';
  for (let y = -10; y <= 510; y += 10) river += (y === -10 ? 'M' : 'L') + riverX(y).toFixed(1) + ' ' + y + ' ';
  s += `<path d="${river}" stroke="#0a2a4f" stroke-width="46" fill="none"/><path d="${river}" stroke="#0e3b6b" stroke-width="30" fill="none"/><path d="${river}" stroke="rgba(34,227,255,.35)" stroke-width="1.5" fill="none" class="dash-flow"/>`;
  for (const d of ['M0 198 L800 186', 'M0 344 L800 356', 'M286 0 L300 500', 'M706 0 L690 500', 'M120 500 L470 0', 'M800 90 L560 500'])
    s += `<path d="${d}" stroke="rgba(34,227,255,.08)" stroke-width="12" fill="none"/><path d="${d}" stroke="#23336a" stroke-width="4" fill="none"/>`;
  for (const [t, x, y] of [['ПОДОЛ', 368, 196], ['ЦЕНТР', 432, 318], ['ЛЕВЫЙ БЕРЕГ', 690, 160], ['ОБОЛОНЬ', 250, 32], ['ГОЛОСЕЕВО', 300, 472], ['ПЕЧЕРСК', 470, 400], ['ДАРНИЦА', 690, 430]])
    s += `<text x="${x}" y="${y}" font-family="Unbounded, sans-serif" font-size="11" letter-spacing="3" fill="rgba(238,242,255,.2)" font-weight="700">${t}</text>`;
  return s;
}

type Props = {
  stores: Store[]; mode: 'courier' | 'pickup'; selectedStore?: string;
  pin?: { x: number; y: number } | null; coverage?: Coverage | null;
  onPin?: (x: number, y: number) => void; onStore?: (id: string) => void; error?: boolean;
};

export function CityMap({ stores, mode, selectedStore, pin, coverage, onPin, onStore, error }: Props) {
  const base = useMemo(buildBase, []);
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [locating, setLocating] = useState(false);
  const st = stores.find(s => s.id === selectedStore);
  const w = 800 / zoom, h = 500 / zoom;
  const cx = mode === 'courier' && pin ? pin.x : mode === 'pickup' && st ? st.x : 400;
  const cy = mode === 'courier' && pin ? pin.y : mode === 'pickup' && st ? st.y : 250;
  const x0 = Math.min(Math.max(cx - w / 2, 0), 800 - w), y0 = Math.min(Math.max(cy - h / 2, 0), 500 - h);
  const near = coverage ? stores.find(s => s.id === coverage.storeId) : undefined;

  const click = (e: MouseEvent<SVGSVGElement>) => {
    const storeEl = (e.target as Element).closest('[data-store]');
    if (mode === 'pickup') { if (storeEl) onStore?.(storeEl.getAttribute('data-store')!); return; }
    const el = svg.current; if (!el) return;
    const pt = el.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    onPin?.(Math.round(Math.min(795, Math.max(5, p.x))), Math.round(Math.min(495, Math.max(5, p.y))));
  };
  const locate = () => {
    setLocating(true);
    setTimeout(() => {
      setLocating(false);
      const s = stores[Math.floor(Math.random() * stores.length)], a = Math.random() * 6.28, d = 20 + Math.random() * s.r * 0.6;
      onPin?.(Math.round(s.x + Math.cos(a) * d), Math.round(s.y + Math.sin(a) * d));
    }, 1300);
  };

  return (
    <div className="relative rounded-3xl overflow-hidden border hairline" style={error ? { borderColor: 'var(--pink)' } : undefined}>
      <svg ref={svg} onClick={click} className="map-svg w-full aspect-[16/10] block" viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Карта магазинов и зоны доставки">
        <g dangerouslySetInnerHTML={{ __html: base }} />
        {stores.map(s => {
          const sel = mode === 'pickup' && selectedStore === s.id, col = sel ? '#fcee0a' : '#c6ff3d';
          return (
            <g key={s.id}>
              {mode === 'courier' && <circle cx={s.x} cy={s.y} r={s.r} fill={`rgba(198,255,61,${near?.id === s.id ? 0.09 : 0.045})`} stroke={`rgba(198,255,61,${near?.id === s.id ? 0.6 : 0.3})`} strokeWidth={1.5} strokeDasharray="5 6" />}
              <g className="store" data-store={s.id}>
                <circle cx={s.x} cy={s.y} r={26} fill="transparent" />
                <circle className="radar" cx={s.x} cy={s.y} r={16} fill="none" stroke={col} strokeWidth={2} />
                <circle className="core" cx={s.x} cy={s.y} r={sel ? 11 : 8} fill={col} stroke="#060a18" strokeWidth={3} />
                <text x={s.x} y={s.y - 17} textAnchor="middle" fontSize={11} fontWeight={800} fontFamily="Manrope, sans-serif" fill={sel ? '#fcee0a' : '#e9ffc4'} paintOrder="stroke" stroke="#060a18" strokeWidth={4}>{s.name.replace('NEON ', '')}</text>
              </g>
            </g>
          );
        })}
        {mode === 'courier' && pin && near && coverage && (
          <g key={`${pin.x}-${pin.y}`}>
            <line x1={near.x} y1={near.y} x2={pin.x} y2={pin.y} stroke={coverage.inZone ? '#22e3ff' : '#ff3d81'} strokeWidth={2.5} className="dash-flow" />
            <ellipse cx={pin.x} cy={pin.y} rx={8} ry={3} fill="rgba(0,0,0,.5)" />
            <g className="pin-drop">
              <path d={`M${pin.x} ${pin.y} C ${pin.x - 5} ${pin.y - 10} ${pin.x - 13} ${pin.y - 16} ${pin.x - 13} ${pin.y - 25} A 13 13 0 1 1 ${pin.x + 13} ${pin.y - 25} C ${pin.x + 13} ${pin.y - 16} ${pin.x + 5} ${pin.y - 10} ${pin.x} ${pin.y} Z`} fill={coverage.inZone ? '#22e3ff' : '#ff3d81'} stroke="#060a18" strokeWidth={2.5} />
              <circle cx={pin.x} cy={pin.y - 25} r={5} fill="#060a18" />
            </g>
          </g>
        )}
        {locating && <circle className="radar" cx={cx} cy={cy} r={120} fill="rgba(34,227,255,.08)" stroke="#22e3ff" strokeWidth={2} />}
      </svg>
      <div className="absolute left-3 top-3 text-[11px] font-bold px-3 py-1.5 rounded-full bg-black/60 backdrop-blur flex items-center gap-1.5 pointer-events-none"><MapIcon className="w-3.5 h-3.5 c-lime" />{mode === 'courier' ? 'Нажмите на карту, чтобы поставить пин' : 'Выберите супермаркет'}</div>
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button onClick={() => setZoom(z => Math.min(2.6, +(z + 0.4).toFixed(1)))} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur grid place-items-center hover:text-[var(--lime)]" aria-label="Приблизить"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => setZoom(z => Math.max(1, +(z - 0.4).toFixed(1)))} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur grid place-items-center hover:text-[var(--lime)]" aria-label="Отдалить"><ZoomOut className="w-4 h-4" /></button>
        {mode === 'courier' && <button onClick={locate} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur grid place-items-center hover:text-[var(--lime)]" aria-label="Моё местоположение"><LocateFixed className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}
