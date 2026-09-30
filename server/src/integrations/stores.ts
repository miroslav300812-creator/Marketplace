/** Pickup stores on the in-app city map (SVG coordinates, 1 unit ≈ 25 m). */
export const STORES = [
  { id: 's1', name: 'NEON Крещатик', x: 452, y: 268, r: 122, address: 'ул. Крещатик, 22', hours: '07:00–23:00', load: 0.72 },
  { id: 's2', name: 'NEON Подол', x: 400, y: 150, r: 104, address: 'ул. Сагайдачного, 8', hours: '08:00–22:00', load: 0.38 },
  { id: 's3', name: 'NEON Левобережная', x: 672, y: 222, r: 118, address: 'Броварской пр., 17', hours: 'Круглосуточно', load: 0.55 },
  { id: 's4', name: 'NEON Оболонь', x: 332, y: 58, r: 96, address: 'Оболонский пр., 40', hours: '08:00–23:00', load: 0.24 },
  { id: 's5', name: 'NEON Голосеево', x: 372, y: 418, r: 110, address: 'пр. Науки, 3', hours: '07:00–22:00', load: 0.47 }
];
const KM_PER_UNIT = 0.025;
const STREETS = ['Крещатик', 'Шевченко', 'Франко', 'Леси Украинки', 'Грушевского', 'Соборная', 'Независимости', 'Сечевых Стрельцов', 'Героев Днепра', 'Садовая', 'Мира', 'Университетская', 'Академика Павлова', 'Лыбедская', 'Оболонская', 'Хмельницкого', 'Липинского', 'Ярославов Вал', 'Саксаганского', 'Антоновича'];

export function coverage(x: number, y: number) {
  let best = STORES[0], bd = Infinity;
  for (const s of STORES) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  const km = +(bd * KM_PER_UNIT).toFixed(1);
  return {
    storeId: best.id, storeName: best.name, km, inZone: bd <= best.r,
    cost: Math.round(39 + km * 9),
    eta: `${Math.round(25 + km * 8)}–${Math.round(40 + km * 10)} мин`
  };
}
export function reverseGeocode(x: number, y: number) {
  const st = STREETS[(Math.floor(x / 60) * 7 + Math.floor(y / 45) * 3) % STREETS.length];
  return `ул. ${st}, ${1 + (Math.floor(x * 3 + y * 7) % 120)}`;
}
