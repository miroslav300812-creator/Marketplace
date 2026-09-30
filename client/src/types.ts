export type Category = { id: string; name: string; emoji: string; icon: string; tint: string };
export type Product = {
  id: number; name: string; cat: string; price: number; old: number | null; unit: string; emoji: string;
  tags: string[]; country: string; kcal: number; stock: number; badge: '' | 'Хит' | 'Sale' | 'New';
  weight: number; desc: string; barcode: string; rating: { avg: number; n: number };
};
export type Recipe = {
  id: string; title: string; emoji: string; time: number; kcal: number; level: string; portions: number;
  discount: number; tint: string; steps: string[]; items: { productId: number; qty: number }[];
};
export type Tier = { id: string; name: string; min: number; rate: number; color: string };
export type Catalog = {
  categories: Category[]; products: Product[]; recipes: Recipe[]; tiers: Tier[];
  config: { courierFreeFrom: number; npFreeFrom: number; bonusMaxShare: number; integrations: { liqpay: boolean; novaposhta: boolean; sms: boolean } };
};
export type Review = {
  id: number; productId: number; author: string; rating: number; text: string; emojis: string[];
  verified: boolean; status: 'pending' | 'approved'; flagged: boolean; likes: number; createdAt: string; mine: boolean;
  product?: { name: string; emoji: string };
};
export type User = {
  id: number; phone: string; name: string; email: string; loyaltyCard: string; bonusBalance: number; lifetimeSpend: number;
  tier: Tier; nextTier: Tier | null; prefs: Prefs;
  bonusHistory: { id: number; delta: number; reason: string; orderId: string | null; at: string }[];
};
export type Prefs = { delivery?: DeliveryDraft; payMethod?: PayMethod };
export type PayMethod = 'card' | 'apple' | 'google' | 'cash';
export type OrderStatus = 'awaiting_payment' | 'new' | 'picking' | 'transit' | 'done' | 'cancelled';
export type Order = {
  id: string; status: OrderStatus; paymentStatus: 'pending' | 'paid' | 'failed' | 'cod' | 'refunded'; paymentMethod: PayMethod;
  paymentTx: string | null; paymentMask: string | null; createdAt: string;
  customer: { name: string; phone: string; email: string };
  items: { productId: number | null; name: string; emoji: string; price: number; qty: number; bundle: string | null }[];
  subtotal: number; bundleDiscount: number; promoCode: string | null; promoDiscount: number;
  bonusSpent: number; bonusEarned: number; bonusCredited: boolean;
  delivery: { type: 'np' | 'courier' | 'pickup'; cost: number; label: string; eta: string };
  total: number; history: { status: OrderStatus; at: string }[];
};
export type Payment = { provider: 'mock' } | { provider: 'liqpay'; url: string; data: string; signature: string } | null;

export type CartLine = { key: string; productId: number; qty: number; bundle: string | null };
export type DeliveryDraft = {
  type: 'np' | 'courier' | 'pickup';
  np: { cityRef: string; cityName: string; whType: 'branch' | 'postomat'; whRef: string; whName: string; whAddress: string };
  courier: { x: number | null; y: number | null; address: string; apt: string; comment: string };
  storeId: string;
};
export type Quote = {
  lines: { productId: number; name: string; emoji: string; price: number; qty: number; bundle: string | null; sum: number; disc: number }[];
  subtotal: number; bundleDiscount: number; promo: { code: string; label: string; type: string } | null; promoError: string | null;
  promoDiscount: number; goods: number; bonusMax: number; bonusApplied: number; bonusEarn: number; cashbackRate: number; weight: number;
  delivery: { type: string; cost: number; baseCost: number; eta: string; label: string; freeFrom: number } | null; total: number;
};
export type NpCity = { ref: string; name: string; region: string; size: number };
export type NpWarehouse = { ref: string; type: 'branch' | 'postomat'; name: string; address: string; limit: string; hours: string };
export type Store = { id: string; name: string; x: number; y: number; r: number; address: string; hours: string; load: number };
export type Coverage = { storeId: string; storeName: string; km: number; inZone: boolean; cost: number; eta: string };
