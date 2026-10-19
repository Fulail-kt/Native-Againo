const CLOCK: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export function ymd(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function time12(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString(undefined, CLOCK);
}

export function hour12(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true });
}

export function hm12(hour: number, minute: number) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return time12(d);
}

export function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  if (m < 30) d.setMinutes(30);
  else {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function isPastDay(dateStr: string) {
  const end = new Date(`${dateStr}T23:59:59`);
  return end.getTime() < Date.now();
}

export function isPastSlot(dateStr: string, hhmm: string) {
  return new Date(`${dateStr}T${hhmm}:00`).getTime() <= Date.now();
}

export function apptLabel(status: string, startAt?: Date | string) {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'NO_SHOW') return 'Missed';
  if (startAt && new Date(startAt).getTime() > Date.now()) return 'Upcoming';
  return 'Booked';
}

export function formatDay(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export type ShopHours = {
  openHour: number;
  closeHour: number;
  closedWeekdays: number[];
};

export function shopHours(shop?: { openHour?: number; closeHour?: number; closedWeekdays?: number[] } | null): ShopHours {
  return {
    openHour: shop?.openHour ?? 9,
    closeHour: shop?.closeHour ?? 20,
    closedWeekdays: shop?.closedWeekdays ?? [],
  };
}

export function weekdayOf(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

export function isClosedDay(dateStr: string, closed: number[]) {
  return closed.includes(weekdayOf(dateStr));
}

export function hourList(fromH: number, toH: number) {
  const rows: number[] = [];
  for (let h = fromH; h <= toH; h++) rows.push(h);
  return rows;
}

export function dateOptions(count = 14) {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const key = ymd(d);
    const tag = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : undefined;
    return {
      key,
      tag,
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
      num: d.getDate(),
      weekday: d.getDay(),
    };
  });
}

export function firstSlot(dateStr: string, hours?: ShopHours) {
  return clockSlots(dateStr, hours).at(0)?.hhmm ?? null;
}

function slotKeys(startAt: string, endAt: string) {
  const keys: string[] = [];
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  for (let t = start; t < end; t += 30 * 60_000) {
    const d = new Date(t);
    keys.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }
  return keys;
}

export function takenStarts(
  rows: { id?: number; startAt: string; endAt: string; status: string; chairId?: number }[],
  exceptId?: number | null,
  chairId?: number | null,
  chairIds?: number[],
) {
  const set = new Set<string>();
  const live = rows.filter((a) => a.status === 'BOOKED' && !(exceptId && a.id === exceptId));

  if (chairId != null || chairIds?.length === 1) {
    const only = chairId ?? chairIds![0];
    for (const a of live) {
      if (a.chairId != null && a.chairId !== only) continue;
      for (const k of slotKeys(a.startAt, a.endAt)) set.add(k);
    }
    return set;
  }

  const ids = chairIds?.length ? chairIds : [];
  if (ids.length <= 1) {
    for (const a of live) {
      for (const k of slotKeys(a.startAt, a.endAt)) set.add(k);
    }
    return set;
  }

  const busy = new Map<string, Set<number>>();
  for (const a of live) {
    if (a.chairId == null) continue;
    for (const k of slotKeys(a.startAt, a.endAt)) {
      const cur = busy.get(k) ?? new Set<number>();
      cur.add(a.chairId);
      busy.set(k, cur);
    }
  }
  for (const [k, chairs] of busy) {
    if (ids.every((id) => chairs.has(id))) set.add(k);
  }
  return set;
}

export function slotFits(hhmm: string, mins: number, taken: Set<string>) {
  const [h, m] = hhmm.split(':').map(Number);
  let cur = h * 60 + m;
  const stop = cur + mins;
  while (cur < stop) {
    const key = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`;
    if (taken.has(key)) return false;
    cur += 30;
  }
  return true;
}

const LEN = [30, 45, 60, 90];

export function fitMins(hhmm: string, want: number, taken: Set<string>) {
  if (!taken.size || slotFits(hhmm, want, taken)) return want;
  return [...LEN].filter((n) => n <= want).reverse().find((n) => slotFits(hhmm, n, taken)) ?? want;
}

export function normalizeSlot(dateStr: string, hhmm: string, hours?: ShopHours, taken?: Set<string>) {
  const slots = clockSlots(dateStr, hours);
  const ok = (s: { hhmm: string }) => !taken?.has(s.hhmm);
  if (slots.some((s) => s.hhmm === hhmm && ok(s))) return hhmm;
  return slots.find(ok)?.hhmm ?? slots[0]?.hhmm ?? hhmm;
}

export function clockSlots(dateStr?: string, hours?: ShopHours) {
  const fromH = hours?.openHour ?? 9;
  const toH = hours?.closeHour ?? 20;
  const rows: { hhmm: string; label: string }[] = [];
  for (let h = fromH; h < toH; h++) {
    for (const m of [0, 30]) {
      const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (dateStr && isPastSlot(dateStr, hhmm)) continue;
      rows.push({ hhmm, label: hm12(h, m) });
    }
  }
  return rows;
}
