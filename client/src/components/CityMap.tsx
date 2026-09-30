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
  let s = '<rect x="-50" y="-50" width="900" height="600" class="m-bg"/>';
  for (let x = 8; x < 800; x += 46) for (let y = 8; y < 500; y += 38) {
    if (Math.abs(x + 20 - riverX(y + 16)) < 44) continue;
    const k = r();
    s += `<rect x="${x}" y="${y}" width="${38 + Math.floor(r() * 3)}" height="${30 + Math.floor(r() * 3)}" rx="6" class="${k < 0.08 ? 'm-park' : 'm-block'}"/>`;
  }
  let river = '';
  for (let y = -10; y <= 510; y += 10) river += (y === -10 ? 'M' : 'L') + riverX(y).toFixed(1) + ' ' + y + ' ';
  s += `<path d="${river}" class="m-river" stroke-width="46" stroke-linecap="round"/><path d="${river}" class="m-river-core" stroke-width="26" stroke-linecap="round"/>`;
  for (const d of ['M0 198 L800 186', 'M0 344 L800 356', 'M286 0 L300 500', 'M706 0 L690 500', 'M120 500 L470 0', 'M800 90 L560 500'])
    s += `<path d="${d}" class="m-road" stroke-width="5"/>`;
  for (const [t, x, y] of [['ПОДОЛ', 368, 196], ['ЦЕНТР', 432, 318], ['ЛЕВЫЙ БЕРЕГ', 690, 160], ['ОБОЛОНЬ', 250, 32], ['ГОЛОСЕЕВО', 300, 472], ['ПЕЧЕРСК', 470, 400], ['ДАРНИЦА', 690, 430]])
    s += `<text x="${x}" y="${y}" class="m-label" font-size="10" letter-spacing="3" font-weight="500">${t}</text>`;
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
    <div className="relative rounded-[30px] overflow-hidden glass" style={error ? { borderColor: 'var(--pink)' } : undefined}>
      <svg ref={svg} onClick={click} className="map-svg w-full aspect-[16/10] block" viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Карта магазинов и зоны доставки">
        <g dangerouslySetInnerHTML={{ __html: base }} />
        {stores.map(s => {
          const sel = mode === 'pickup' && selectedStore === s.id, col = 'var(--ink)';
          return (
            <g key={s.id}>
              {mode === 'courier' && <circle cx={s.x} cy={s.y} r={s.r} fill="var(--ink)" fillOpacity={near?.id === s.id ? 0.07 : 0.03} stroke="var(--ink)" strokeOpacity={near?.id === s.id ? 0.45 : 0.18} strokeWidth={1} strokeDasharray="3 6" />}
              <g className="store" data-store={s.id}>
                <circle cx={s.x} cy={s.y} r={26} fill="transparent" />
                <circle className="radar" cx={s.x} cy={s.y} r={16} fill="none" stroke={col} strokeWidth={1} />
                <circle className="core" cx={s.x} cy={s.y} r={sel ? 9 : 6} fill={col} stroke="var(--bg)" strokeWidth={3} />
                <text x={s.x} y={s.y - 17} textAnchor="middle" fontSize={11} fontWeight={sel ? 600 : 500} fill="var(--ink)" fillOpacity={sel ? 1 : 0.7} paintOrder="stroke" stroke="var(--bg)" strokeWidth={4}>{s.name.replace('NEON ', '')}</text>
              </g>
            </g>
          );
        })}
        {mode === 'courier' && pin && near && coverage && (
          <g key={`${pin.x}-${pin.y}`}>
            <line x1={near.x} y1={near.y} x2={pin.x} y2={pin.y} stroke={coverage.inZone ? 'var(--ink)' : 'var(--danger)'} strokeWidth={1.5} className="dash-flow" />
            <ellipse cx={pin.x} cy={pin.y} rx={8} ry={3} fill="var(--ink)" fillOpacity={0.2} />
            <g className="pin-drop">
              <path d={`M${pin.x} ${pin.y} C ${pin.x - 5} ${pin.y - 10} ${pin.x - 13} ${pin.y - 16} ${pin.x - 13} ${pin.y - 25} A 13 13 0 1 1 ${pin.x + 13} ${pin.y - 25} C ${pin.x + 13} ${pin.y - 16} ${pin.x + 5} ${pin.y - 10} ${pin.x} ${pin.y} Z`} fill={coverage.inZone ? 'var(--ink)' : 'var(--danger)'} stroke="var(--bg)" strokeWidth={2.5} />
              <circle cx={pin.x} cy={pin.y - 25} r={5} fill="var(--bg)" />
            </g>
          </g>
        )}
        {locating && <circle className="radar" cx={cx} cy={cy} r={120} fill="var(--ink)" fillOpacity={0.05} stroke="var(--ink)" strokeOpacity={0.4} strokeWidth={1} />}
      </svg>
      <div className="absolute left-3 top-3 text-[11px] c-ink2 px-3 py-1.5 rounded-full glass flex items-center gap-1.5 pointer-events-none"><MapIcon className="w-3.5 h-3.5" />{mode === 'courier' ? 'Нажмите на карту, чтобы поставить пин' : 'Выберите супермаркет'}</div>
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button onClick={() => setZoom(z => Math.min(2.6, +(z + 0.4).toFixed(1)))} className="w-9 h-9 rounded-full glass grid place-items-center hover:text-[var(--ink)]" aria-label="Приблизить"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => setZoom(z => Math.max(1, +(z - 0.4).toFixed(1)))} className="w-9 h-9 rounded-full glass grid place-items-center hover:text-[var(--ink)]" aria-label="Отдалить"><ZoomOut className="w-4 h-4" /></button>
        {mode === 'courier' && <button onClick={locate} className="w-9 h-9 rounded-full glass grid place-items-center hover:text-[var(--ink)]" aria-label="Моё местоположение"><LocateFixed className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}
