export const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
export const money = (n: number) => fmt(n) + ' ₴';
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const dt = (t: string | number) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export function timeAgo(t: string | number) {
  const s = Math.max(1, Math.round((Date.now() - +new Date(t)) / 1000));
  if (s < 60) return 'только что';
  if (s < 3600) return Math.round(s / 60) + ' мин назад';
  if (s < 86400) return Math.round(s / 3600) + ' ч назад';
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
export const discountPct = (p: { price: number; old: number | null }) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);
export function formatPhoneInput(raw: string, prev = '') {
  let d = raw.replace(/\D/g, '');
  if (d === prev.replace(/\D/g, '') && raw.length < prev.length) d = d.slice(0, -1);
  if (!d) return '';
  if (d.startsWith('0')) d = '38' + d; else if (d.startsWith('80')) d = '3' + d; else if (!d.startsWith('380')) d = '380' + d.replace(/^3(8)?/, '');
  const p = d.slice(3, 12);
  let out = '+380';
  if (p.length) out += ' ' + p.slice(0, 2);
  if (p.length > 2) out += ' ' + p.slice(2, 5);
  if (p.length > 5) out += ' ' + p.slice(5, 7);
  if (p.length > 7) out += ' ' + p.slice(7, 9);
  return out;
}
export const phoneValid = (p: string) => /^380\d{9}$/.test(p.replace(/\D/g, ''));
export function download(name: string, content: string, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
export const uid = () => Math.random().toString(36).slice(2, 10);
