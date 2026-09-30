/** EAN-13 check digit for a 12-digit body. */
export function ean13(body12: string): string {
  const d = body12.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d[i]) * (i % 2 ? 3 : 1);
  return d + ((10 - (s % 10)) % 10);
}
export const productBarcode = (id: number) => ean13('4820' + String(id).padStart(5, '0') + '731');
