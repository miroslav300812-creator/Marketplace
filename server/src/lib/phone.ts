/** Normalises Ukrainian numbers to +380XXXXXXXXX or returns null. */
export function normalizePhone(input: string): string | null {
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('0')) d = '38' + d;
  else if (d.startsWith('80')) d = '3' + d;
  return /^380\d{9}$/.test(d) ? '+' + d : null;
}
export const formatPhone = (p: string) => p.replace(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/, '+380 $1 $2 $3 $4');
