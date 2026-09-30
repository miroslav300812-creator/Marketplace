import { env, integrations } from '../env.js';
import { HttpError } from '../lib/errors.js';

export type NpCity = { ref: string; name: string; region: string; zone: number; size: number };
export type NpWarehouse = { ref: string; type: 'branch' | 'postomat'; name: string; address: string; limit: string; hours: string };
export type NpQuote = { cost: number; days: number; etaLabel: string; breakdown?: Record<string, number> };

const STREETS = ['Крещатик', 'Шевченко', 'Франко', 'Леси Украинки', 'Грушевского', 'Соборная', 'Независимости', 'Сечевых Стрельцов', 'Героев Днепра', 'Садовая', 'Мира', 'Университетская', 'Академика Павлова', 'Лыбедская', 'Оболонская', 'Хмельницкого', 'Липинского', 'Ярославов Вал', 'Саксаганского', 'Антоновича'];
const POSTOMAT_PLACES = ['ТЦ «Галактика»', 'АЗС «Орбита»', 'Супермаркет NEON', 'ЖК «Комфорт Сити»', 'Аптека «Здоровье»', 'ТРЦ «Квант»', 'Фитнес-клуб «Импульс»', 'БЦ «Парус»', 'ЖК «Новый Горизонт»', 'Кофейня «Бит»'];
const MOCK_CITIES: NpCity[] = ([
  ['kyiv', 'Киев', 'г. Киев', 0, 180], ['lviv', 'Львов', 'Львовская обл.', 2, 90], ['odesa', 'Одесса', 'Одесская обл.', 2, 95], ['kharkiv', 'Харьков', 'Харьковская обл.', 1, 110],
  ['dnipro', 'Днепр', 'Днепропетровская обл.', 1, 100], ['zp', 'Запорожье', 'Запорожская обл.', 1, 70], ['vinnytsia', 'Винница', 'Винницкая обл.', 1, 55], ['if', 'Ивано-Франковск', 'Ивано-Франковская обл.', 2, 40],
  ['poltava', 'Полтава', 'Полтавская обл.', 1, 40], ['chernivtsi', 'Черновцы', 'Черновицкая обл.', 2, 35], ['uzh', 'Ужгород', 'Закарпатская обл.', 2, 25], ['mykolaiv', 'Николаев', 'Николаевская обл.', 2, 45],
  ['irpin', 'Ирпень', 'Киевская обл.', 0, 18], ['bucha', 'Буча', 'Киевская обл.', 0, 15], ['brovary', 'Бровары', 'Киевская обл.', 0, 20], ['bc', 'Белая Церковь', 'Киевская обл.', 0, 30],
  ['zhytomyr', 'Житомир', 'Житомирская обл.', 1, 40], ['chernihiv', 'Чернигов', 'Черниговская обл.', 1, 38], ['rivne', 'Ровно', 'Ровенская обл.', 2, 36], ['lutsk', 'Луцк', 'Волынская обл.', 2, 34],
  ['ternopil', 'Тернополь', 'Тернопольская обл.', 2, 33], ['kropyvnytskyi', 'Кропивницкий', 'Кировоградская обл.', 1, 30], ['sumy', 'Сумы', 'Сумская обл.', 1, 32], ['cherkasy', 'Черкассы', 'Черкасская обл.', 1, 36], ['khmelnytskyi', 'Хмельницкий', 'Хмельницкая обл.', 2, 35]
] as const).map(([ref, name, region, zone, size]) => ({ ref, name, region, zone, size }));

function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: string) {
  let t = hashStr(seed);
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const etaLabel = (days: number) => new Date(Date.now() + days * 864e5).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

const mock = {
  async searchCities(q: string): Promise<NpCity[]> {
    const s = q.trim().toLowerCase();
    return MOCK_CITIES.filter(c => !s || c.name.toLowerCase().includes(s) || c.region.toLowerCase().includes(s)).slice(0, 8);
  },
  async warehouses(cityRef: string): Promise<NpWarehouse[]> {
    const c = MOCK_CITIES.find(x => x.ref === cityRef);
    if (!c) return [];
    const r = rng('wh-' + cityRef), out: NpWarehouse[] = [];
    const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
    for (let i = 1; i <= Math.max(6, Math.round(c.size / 6)); i++)
      out.push({ ref: `${cityRef}-b${i}`, type: 'branch', name: `Отделение №${i}`, address: `ул. ${pick(STREETS)}, ${1 + Math.floor(r() * 140)}`, limit: r() < 0.3 ? 'до 1000 кг' : 'до 30 кг', hours: r() < 0.5 ? '08:00–21:00' : '09:00–20:00' });
    for (let i = 1; i <= Math.max(4, Math.round(c.size / 5)); i++)
      out.push({ ref: `${cityRef}-p${i}`, type: 'postomat', name: `Почтомат №${5000 + Math.floor(r() * 4000)}`, address: `${pick(POSTOMAT_PLACES)}, ул. ${pick(STREETS)}, ${1 + Math.floor(r() * 90)}`, limit: 'до 20 кг · 40×30×60 см', hours: '24/7' });
    return out;
  },
  async quote(p: { cityRef: string; type: string; weight: number; declared: number }): Promise<NpQuote> {
    const c = MOCK_CITIES.find(x => x.ref === p.cityRef) ?? { zone: 1 };
    const base = p.type === 'postomat' ? 55 : 70;
    const weight = Math.round(Math.max(0, p.weight - 2) * 9), zone = c.zone * 12, insurance = Math.round(p.declared * 0.005);
    const days = c.zone === 2 ? 2 : 1;
    return { cost: base + weight + zone + insurance, days, etaLabel: etaLabel(days), breakdown: { base, weight, zone, insurance } };
  }
};

/* ---------------- Real Nova Poshta API v2 ---------------- */
async function call<T>(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>): Promise<T[]> {
  const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.NOVAPOSHTA_API_KEY, modelName, calledMethod, methodProperties })
  });
  const json = await res.json() as { success: boolean; data: T[]; errors: string[] };
  if (!json.success) throw new HttpError(502, 'Новая Почта: ' + (json.errors?.join('; ') || 'ошибка API'), 'novaposhta');
  return json.data;
}
const real = {
  async searchCities(q: string): Promise<NpCity[]> {
    if (q.trim().length < 2) return [];
    const data = await call<{ Addresses: { DeliveryCity: string; MainDescription: string; Area: string; Warehouses: number }[] }>('Address', 'searchSettlements', { CityName: q.trim(), Limit: '10', Page: '1' });
    return (data[0]?.Addresses ?? []).filter(a => a.Warehouses > 0).map(a => ({ ref: a.DeliveryCity, name: a.MainDescription, region: a.Area + ' обл.', zone: 1, size: a.Warehouses }));
  },
  async warehouses(cityRef: string): Promise<NpWarehouse[]> {
    const data = await call<{ Ref: string; Description: string; ShortAddress: string; CategoryOfWarehouse: string; TotalMaxWeightAllowed: string; Schedule?: Record<string, string> }>('Address', 'getWarehouses', { CityRef: cityRef, Limit: '500', Page: '1' });
    return data.map(w => ({
      ref: w.Ref,
      type: w.CategoryOfWarehouse === 'Postomat' ? 'postomat' : 'branch',
      name: w.Description.split(':')[0],
      address: w.ShortAddress,
      limit: Number(w.TotalMaxWeightAllowed) ? `до ${w.TotalMaxWeightAllowed} кг` : 'без ограничений',
      hours: w.Schedule?.Monday ?? ''
    }));
  },
  async quote(p: { cityRef: string; type: string; weight: number; declared: number }): Promise<NpQuote> {
    const serviceType = 'WarehouseWarehouse';
    const [price] = await call<{ Cost: number }>('InternetDocument', 'getDocumentPrice', {
      CitySender: env.NOVAPOSHTA_SENDER_CITY_REF, CityRecipient: p.cityRef, Weight: String(Math.max(0.1, p.weight)),
      ServiceType: serviceType, Cost: String(Math.max(1, Math.round(p.declared))), CargoType: 'Parcel', SeatsAmount: '1'
    });
    const now = new Date();
    const [eta] = await call<{ DeliveryDate: { date: string } }>('InternetDocument', 'getDocumentDeliveryDate', {
      DateTime: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`,
      ServiceType: serviceType, CitySender: env.NOVAPOSHTA_SENDER_CITY_REF, CityRecipient: p.cityRef
    });
    const date = eta?.DeliveryDate?.date ? new Date(eta.DeliveryDate.date.replace(' ', 'T')) : new Date(Date.now() + 864e5);
    const days = Math.max(1, Math.round((date.getTime() - now.getTime()) / 864e5));
    return { cost: Math.round(price?.Cost ?? 0), days, etaLabel: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }) };
  }
};

export const novaPoshta = integrations.novaposhta ? real : mock;
