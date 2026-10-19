export type InputKind = 'digits' | 'decimal' | 'alnum';

export function clip(kind: InputKind | undefined, v: string) {
  if (kind === 'digits') return v.replace(/\D/g, '');
  if (kind === 'alnum') return v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (kind !== 'decimal') return v;
  const raw = v.replace(/[^\d.]/g, '');
  const dot = raw.indexOf('.');
  if (dot === -1) return raw;
  const head = raw.slice(0, dot) || '0';
  const frac = raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return frac.length ? `${head}.${frac}` : `${head}.`;
}

export function digitsOnly(v: string) {
  return clip('digits', v);
}
