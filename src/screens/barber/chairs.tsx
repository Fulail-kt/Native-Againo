import { View } from 'react-native';
import { Chip, Section } from '../../ui';

export type Chair = {
  id: number;
  name: string;
  staff?: { name?: string | null } | null;
  canAdmin?: boolean;
  upcoming?: number;
};

export function chairLabel(c: Chair, youId?: number | null) {
  if (youId != null && c.id === youId) return 'You';
  return c.staff?.name?.trim() || c.name;
}

export function ownerChairOf<T extends { id: number; sort?: number }>(chairs: T[]) {
  return [...chairs].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)[0] ?? null;
}

export function staffChairOf<
  T extends { id: number; name?: string; staff?: { id?: number } | null; staffUserId?: number },
>(chairs: T[], userId?: number) {
  if (userId == null) return undefined;
  return chairs.find((c) => c.staff?.id === userId || c.staffUserId === userId);
}

/** Logged-in seat first. Rest keep given order. */
export function selfFirst<T extends { id: number }>(chairs: T[], selfId?: number | null): T[] {
  if (selfId == null) return chairs;
  const mine = chairs.find((c) => c.id === selfId);
  if (!mine) return chairs;
  return [mine, ...chairs.filter((c) => c.id !== selfId)];
}

export function serviceFits(s: { chairIds?: number[] } | null | undefined, chairId: number | null) {
  const ids = s?.chairIds;
  if (!ids?.length) return true;
  if (chairId == null) return true;
  return ids.includes(chairId);
}

export function chairsForService(chairs: Chair[], s?: { chairIds?: number[] } | null) {
  if (!s?.chairIds?.length) return chairs;
  const allow = new Set(s.chairIds);
  return chairs.filter((c) => allow.has(c.id));
}

export function ChairChips({
  chairs,
  value,
  onPick,
  allowAny,
  title = 'Staff',
}: {
  chairs: Chair[];
  value: number | null;
  onPick: (id: number | null) => void;
  allowAny?: boolean;
  title?: string;
}) {
  if (chairs.length <= 1) return null;
  return (
    <Section title={title}>
      <View className="flex-row flex-wrap">
        {allowAny ? (
          <Chip label="Any" selected={value == null} onPress={() => onPick(null)} />
        ) : null}
        {chairs.map((c) => (
          <Chip key={c.id} label={chairLabel(c)} selected={value === c.id} onPress={() => onPick(c.id)} />
        ))}
      </View>
    </Section>
  );
}
