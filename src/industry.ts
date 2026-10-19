/** API keeps GYM | BARBER. UI uses these labels. */
export const INDUSTRY = {
  GYM: { label: 'Fitness', placeholder: 'Your studio name' },
  BARBER: { label: 'Salon', placeholder: 'Your salon name' },
} as const;

export type IndustryKind = keyof typeof INDUSTRY;

export function industryLabel(kind: string | null | undefined) {
  if (kind === 'GYM') return INDUSTRY.GYM.label;
  if (kind === 'BARBER') return INDUSTRY.BARBER.label;
  return 'Setup';
}
