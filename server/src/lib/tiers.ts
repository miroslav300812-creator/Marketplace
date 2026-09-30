export const TIERS = [
  { id: 'bronze', name: 'Bronze', min: 0, rate: 0.03, color: '#d9a066' },
  { id: 'silver', name: 'Silver', min: 2000, rate: 0.05, color: '#cbd5f5' },
  { id: 'gold', name: 'Gold', min: 5000, rate: 0.07, color: '#fcee0a' },
  { id: 'plat', name: 'Neon Platinum', min: 12000, rate: 0.1, color: '#c6ff3d' }
] as const;

export type Tier = (typeof TIERS)[number];

export function tierFor(lifetimeSpend: number): Tier {
  let t: Tier = TIERS[0];
  for (const x of TIERS) if (lifetimeSpend >= x.min) t = x;
  return t;
}
export const nextTier = (lifetimeSpend: number) => TIERS.find(t => t.min > lifetimeSpend) ?? null;

/** Rate for guests and freshly created users. */
export const DEFAULT_RATE = TIERS[0].rate;
