import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { ArrowLeft, ChevronRight, Search } from '../../icons';
import { colors, space } from '../../theme';
import { Btn, Chip, EmptyState, Segmented } from '../../ui';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Chair, chairLabel } from './chairs';
import { apptLabel, formatDay, hour12, hourList, isClosedDay, shopHours, time12, ymd, type ShopHours } from './time';

type CalView = 'board' | 'list' | 'history';

const ROW = 76;
const LINE = 8; // matches hourLine marginTop

export function dayBounds(dateStr: string) {
  const from = new Date(`${dateStr}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function weekBounds(dateStr: string) {
  const week = weekOf(dateStr);
  return { from: dayBounds(ymd(week[0])).from, to: dayBounds(ymd(week[6])).to };
}

export function monthGrid(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  const mondayOff = first.getDay() === 0 ? -6 : 1 - first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() + mondayOff);
  return Array.from({ length: 42 }, (_, i) => {
    const n = new Date(start);
    n.setDate(start.getDate() + i);
    return n;
  });
}

export function monthGridBounds(dateStr: string) {
  const cells = monthGrid(dateStr);
  return { from: dayBounds(ymd(cells[0])).from, to: dayBounds(ymd(cells[41])).to };
}

export const HIST_CHUNK = 20;

export function historyChunkBounds(toExclusive: Date, days = HIST_CHUNK) {
  const to = new Date(toExclusive);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString(), fromDate: from };
}

export function startOfTomorrow() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

export function weekOf(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const mondayOff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + mondayOff);
  return Array.from({ length: 7 }, (_, i) => {
    const n = new Date(mon);
    n.setDate(mon.getDate() + i);
    return n;
  });
}

function minsOf(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function liveAppts(rows: any[]) {
  return rows
    .filter((a) => a.status !== 'CANCELLED')
    .slice()
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function pastAppts(rows: any[], now: Date) {
  return rows
    .filter((a) => {
      if (a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'NO_SHOW') return true;
      return new Date(a.endAt).getTime() < now.getTime();
    })
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

function groupByDay(rows: any[]) {
  const map = new Map<string, any[]>();
  for (const a of rows) {
    const key = ymd(new Date(a.startAt));
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return [...map.entries()];
}

type ApptItem = { a: any; start: number; end: number; col: number; cols: number };
type BoardBlock =
  | { kind: 'single'; item: ApptItem }
  | { kind: 'stack'; items: ApptItem[]; col: number; cols: number };

function packCols(rows: any[]): ApptItem[] {
  const items = liveAppts(rows).map((a) => ({
    a,
    start: minsOf(a.startAt),
    end: minsOf(a.endAt),
  }));
  const colEnd: number[] = [];
  const placed = items.map((it) => {
    let col = 0;
    while (col < colEnd.length && colEnd[col] > it.start) col += 1;
    if (col === colEnd.length) colEnd.push(it.end);
    else colEnd[col] = it.end;
    return { ...it, col };
  });
  const cols = Math.max(colEnd.length, 1);
  return placed.map((p) => ({ ...p, cols }));
}

function groupStacks(items: ApptItem[]): BoardBlock[] {
  const byCol = new Map<number, ApptItem[]>();
  for (const it of items) {
    const list = byCol.get(it.col) ?? [];
    list.push(it);
    byCol.set(it.col, list);
  }

  const blocks: BoardBlock[] = [];
  for (const list of byCol.values()) {
    list.sort((a, b) => a.start - b.start);
    let chain: ApptItem[] = [];
    let chainEnd = -1;

    const flush = () => {
      if (chain.length === 0) return;
      if (chain.length === 1) blocks.push({ kind: 'single', item: chain[0] });
      else blocks.push({ kind: 'stack', items: chain, col: chain[0].col, cols: chain[0].cols });
      chain = [];
      chainEnd = -1;
    };

    for (const it of list) {
      if (chain.length === 0 || it.start <= chainEnd) {
        chain.push(it);
        chainEnd = Math.max(chainEnd, it.end);
      } else {
        flush();
        chain = [it];
        chainEnd = it.end;
      }
    }
    flush();
  }

  return blocks.sort((a, b) => {
    const sa = a.kind === 'single' ? a.item.start : a.items[0].start;
    const sb = b.kind === 'single' ? b.item.start : b.items[0].start;
    return sa - sb;
  });
}

function laneStyle(col: number, cols: number): ViewStyle {
  return { left: `${(col / cols) * 100}%`, width: `${100 / cols}%` };
}

function topPx(start: number, openHour: number) {
  return ((start - openHour * 60) / 60) * ROW + LINE;
}

function heightPx(mins: number) {
  return Math.max((mins / 60) * ROW, 22);
}

function dayHint(dateStr: string, ref = new Date()) {
  const today = ymd(ref);
  if (dateStr === today) return 'Today';
  const tomorrow = new Date(ref);
  tomorrow.setDate(ref.getDate() + 1);
  if (dateStr === ymd(tomorrow)) return 'Tomorrow';
  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);
  if (dateStr === ymd(yesterday)) return 'Yesterday';
  return null;
}

const WEEK_LABS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function DatePicker({
  date,
  marks,
  closedWeekdays,
  anchor,
  onPick,
  onClose,
  onPeek,
}: {
  date: string;
  marks: Map<string, { booked: boolean; done: boolean }>;
  closedWeekdays: number[];
  anchor: { x: number; y: number; w: number; h: number };
  onPick: (ymd: string) => void;
  onClose: () => void;
  onPeek: (ymd: string) => void;
}) {
  const [cursor, setCursor] = useState(date);
  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const month = new Date(`${cursor}T12:00:00`);
  const today = ymd();
  const title = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const screen = Dimensions.get('window');
  const pad = space.md;
  const width = Math.min(screen.width - pad * 2, 360);
  const left = Math.min(Math.max(pad, anchor.x + anchor.w / 2 - width / 2), screen.width - width - pad);
  const estH = 360;
  const below = anchor.y + anchor.h + 6;
  const top = below + estH > screen.height - pad ? Math.max(pad, anchor.y - estH - 6) : below;

  function shiftMonth(delta: number) {
    const n = new Date(month);
    n.setMonth(n.getMonth() + delta);
    const next = ymd(n);
    setCursor(next);
    onPeek(next);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1">
        <Pressable className="absolute inset-0 bg-transparent" onPress={onClose} />
        <View
          className="absolute rounded-lg border border-border bg-surface p-md"
          style={{
            top,
            left,
            width,
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
          }}
        >
          <View className="mb-md flex-row items-center justify-between">
            <Pressable
              onPress={() => shiftMonth(-1)}
              className="h-xxl w-xxl items-center justify-center rounded-pill border border-border bg-surface2"
              hitSlop={8}
            >
              <ArrowLeft size={16} color={colors.text} />
            </Pressable>
            <Text className="text-[15px] font-bold text-ink">{title}</Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              className="h-xxl w-xxl items-center justify-center rounded-pill border border-border bg-surface2"
              hitSlop={8}
            >
              <ChevronRight size={16} color={colors.text} />
            </Pressable>
          </View>
          <View className="mb-sm flex-row">
            {WEEK_LABS.map((l, i) => (
              <Text key={`${l}-${i}`} className="flex-1 text-center text-[11px] font-bold text-muted">
                {l}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {cells.map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === month.getMonth();
              const on = key === date;
              const isToday = key === today;
              const off = isClosedDay(key, closedWeekdays);
              const mark = marks.get(key);
              return (
                <Pressable
                  key={key}
                  className="w-[14.28%] items-center py-[2px]"
                  onPress={() => {
                    onPick(key);
                    onClose();
                  }}
                >
                  <View
                    className={`h-xxl w-xxl items-center justify-center rounded-lg${
                      isToday && !on ? ' border-[1.5px] border-primary' : ''
                    }${on ? ' bg-primary' : ''}`}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${
                        on ? 'text-white' : !inMonth ? 'text-muted opacity-45' : off ? 'text-muted' : 'text-ink'
                      }`}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  <View className="mt-[2px] h-[6px] flex-row items-center gap-[3px]">
                    {mark?.booked ? (
                      <View className={`h-[5px] w-[5px] rounded-[3px] ${on ? 'bg-white' : 'bg-primary'}`} />
                    ) : null}
                    {mark?.done ? (
                      <View className={`h-[5px] w-[5px] rounded-[3px] ${on ? 'bg-white/85' : 'bg-success'}`} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function dayMarks(rows: any[]) {
  const m = new Map<string, { booked: boolean; done: boolean }>();
  for (const a of rows) {
    if (a.status === 'CANCELLED') continue;
    const k = ymd(new Date(a.startAt));
    const cur = m.get(k) ?? { booked: false, done: false };
    if (a.status === 'COMPLETED') cur.done = true;
    else cur.booked = true;
    m.set(k, cur);
  }
  return m;
}

const STATUS_COLOR: Record<string, string> = {
  BOOKED: colors.primary,
  COMPLETED: colors.success,
  CANCELLED: colors.muted,
  NO_SHOW: colors.warning,
};

function ApptRow({
  a,
  end,
  onOpen,
  compact,
  showChair,
}: {
  a: any;
  end: number;
  onOpen: () => void;
  compact?: boolean;
  showChair?: boolean;
}) {
  const color = STATUS_COLOR[a.status] ?? colors.primary;
  const dur = end - minsOf(a.startAt);
  const name = a.customer?.name ?? 'Client';
  const chair = showChair && a.chair?.name ? `${a.chair.name} · ` : '';
  const meta = `${chair}${a.customer?.phone ?? ''} · ${a.service?.name ?? ''} · ${dur}m`;
  const status = apptLabel(a.status, a.startAt);
  const range = `${time12(a.startAt)} – ${time12(a.endAt)}`;

  if (compact) {
    return (
      <Pressable className="flex-1 justify-center px-sm" onPress={onOpen}>
        <View className="gap-xs">
          <View className="flex-row items-center justify-between gap-[6px]">
            <Text className="flex-1 text-[12px] font-bold text-ink" numberOfLines={1}>
              {name}
            </Text>
            <Text className="shrink-0 text-[10px] font-extrabold" style={{ color }} numberOfLines={1}>
              {status}
            </Text>
          </View>
          <View className="flex-row items-center justify-between gap-[6px]">
            <Text className="flex-1 text-[10px] text-muted" numberOfLines={1}>
              {meta}
            </Text>
            <Text className="shrink-0 text-[10px] font-bold" style={{ color }} numberOfLines={1}>
              {range}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable className="px-sm py-xs" onPress={onOpen}>
      <View className="flex-row items-center justify-between gap-xs">
        <Text className="flex-1 text-[11px] font-bold" style={{ color }} numberOfLines={1}>
          {range}
        </Text>
        <Text className="text-[10px] font-extrabold" style={{ color }}>
          {status}
        </Text>
      </View>
      <Text className="mt-px text-[13px] font-bold text-ink" numberOfLines={1}>
        {name}
      </Text>
      <Text className="mt-px text-[11px] text-muted" numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

function ListApptCard({ a, onOpen, showChair }: { a: any; onOpen: () => void; showChair?: boolean }) {
  const color = STATUS_COLOR[a.status] ?? colors.primary;
  const end = minsOf(a.endAt);
  const dur = end - minsOf(a.startAt);
  const name = a.customer?.name ?? 'Client';
  const status = apptLabel(a.status, a.startAt);
  const chair = showChair && a.chair?.name ? `${a.chair.name} · ` : '';
  return (
    <Pressable
      className="rounded-md border border-border border-l-4 bg-surface2 px-md py-sm"
      style={{ borderLeftColor: color }}
      onPress={onOpen}
    >
      <View className="flex-row items-center justify-between gap-sm">
        <Text className="flex-1 text-[15px] font-bold text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-[11px] font-extrabold" style={{ color }}>
          {status}
        </Text>
      </View>
      <Text className="mt-xs text-[13px] font-bold" style={{ color }}>
        {time12(a.startAt)} – {time12(a.endAt)}
      </Text>
      <Text className="mt-[2px] text-[12px] text-muted" numberOfLines={1}>
        {chair}{a.customer?.phone ?? ''} · {a.service?.name ?? ''} · {dur}m
      </Text>
    </Pressable>
  );
}

const HIST_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'COMPLETED', label: 'Done' },
  { key: 'NO_SHOW', label: 'Missed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'BOOKED', label: 'Booked' },
] as const;

type HistFilterKey = (typeof HIST_FILTERS)[number]['key'];

function HistFilter({ value, onChange }: { value: HistFilterKey; onChange: (k: HistFilterKey) => void }) {
  const selected = HIST_FILTERS.find((f) => f.key === value) ?? HIST_FILTERS[0];
  return (
    <Select
      value={{ value: selected.key, label: selected.label }}
      onValueChange={(opt) => {
        if (opt?.value) onChange(opt.value as HistFilterKey);
      }}
    >
      <SelectTrigger className="h-10 min-w-[108px] border-border bg-surface px-sm shadow-none">
        <SelectValue placeholder="All" className="text-sm font-semibold text-ink" />
      </SelectTrigger>
      <SelectContent className="border-border bg-surface">
        <SelectGroup>
          {HIST_FILTERS.map((f) => (
            <SelectItem key={f.key} value={f.key} label={f.label} className="active:bg-surface2">
              {f.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function histMatch(a: any, q: string, filter: HistFilterKey) {
  if (filter !== 'all' && a.status !== filter) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const blob = `${a.customer?.name ?? ''} ${a.customer?.phone ?? ''} ${a.service?.name ?? ''} ${a.chair?.name ?? ''}`.toLowerCase();
  return blob.includes(needle);
}

export function BarberDayBoard({
  date,
  appointments,
  onDate,
  onBookAt,
  onOpen,
  onPeekMonth,
  onViewChange,
  historyAppts,
  historyMore,
  historyBusy,
  onHistoryMore,
  hours,
  chairs,
  chairId,
  youChairId,
  onChair,
}: {
  date: string;
  appointments: any[];
  onDate: (ymd: string) => void;
  onBookAt: (time: string) => void;
  onOpen: (row: any) => void;
  onPeekMonth?: (ymd: string | null) => void;
  onViewChange?: (view: CalView) => void;
  historyAppts?: any[];
  historyMore?: boolean;
  historyBusy?: boolean;
  onHistoryMore?: () => void;
  hours?: ShopHours;
  chairs?: Chair[];
  chairId?: number | null;
  youChairId?: number | null;
  onChair?: (id: number | null) => void;
}) {
  const h = shopHours(hours);
  const HOURS = hourList(h.openHour, h.closeHour);
  const closed = isClosedDay(date, h.closedWeekdays);
  const [view, setView] = useState<CalView>('list');
  const [histQ, setHistQ] = useState('');
  const [histFilter, setHistFilter] = useState<HistFilterKey>('all');
  const [picker, setPicker] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const titleRef = useRef<View>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const openHour = HOURS[0];
  const scoped = useMemo(
    () => (chairId ? appointments.filter((a) => a.chairId === chairId) : appointments),
    [appointments, chairId],
  );
  const showChair = (chairs?.length ?? 0) > 1 && !chairId;
  const dayAppts = useMemo(
    () => scoped.filter((a) => ymd(new Date(a.startAt)) === date),
    [scoped, date],
  );
  const blocks = useMemo(() => groupStacks(packCols(dayAppts)), [dayAppts]);
  const marks = useMemo(() => dayMarks(scoped), [scoped]);

  const week = weekOf(date);
  const listAppts = useMemo(() => liveAppts(dayAppts), [dayAppts]);
  const histGroups = useMemo(() => {
    const rows = chairId ? (historyAppts ?? []).filter((a) => a.chairId === chairId) : (historyAppts ?? []);
    return groupByDay(pastAppts(rows, now).filter((a) => histMatch(a, histQ, histFilter)));
  }, [historyAppts, chairId, now, histQ, histFilter]);

  function setCalView(next: CalView) {
    setView(next);
    onViewChange?.(next);
    if (next === 'history') {
      setPicker(null);
      onPeekMonth?.(null);
    }
  }
  const title = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const hint = dayHint(date, now);
  const isToday = date === ymd(now);
  const nowTop = topPx(now.getHours() * 60 + now.getMinutes(), openHour);

  function shift(days: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    onDate(ymd(d));
  }

  return (
    <View className="mt-lg gap-sm">
      {(chairs?.length ?? 0) > 1 ? (
        <View className="flex-row flex-wrap">
          <Chip label="All" selected={!chairId} onPress={() => onChair?.(null)} />
          {chairs!.map((c) => (
            <Chip
              key={c.id}
              label={chairLabel(c, youChairId)}
              selected={chairId === c.id}
              onPress={() => onChair?.(c.id)}
            />
          ))}
        </View>
      ) : null}
      <Segmented
        compact
        options={[
          { key: 'board', label: 'Board' },
          { key: 'list', label: 'List' },
        ]}
        end={[{ key: 'history', label: 'History' }]}
        value={view}
        onChange={(k) => setCalView(k as CalView)}
      />
      {view === 'history' ? (
        <View className="mb-lg gap-sm">
          <View className="flex-row items-center gap-sm">
            <View className="min-w-0 flex-1 flex-row items-center overflow-hidden rounded-md border border-border bg-surface px-sm">
              <Search size={16} color={colors.muted} />
              <TextInput
                className="min-h-[40px] flex-1 border-0 bg-transparent px-sm py-2 text-[14px] text-ink"
                placeholder="Name, phone, service"
                placeholderTextColor={colors.muted}
                value={histQ}
                onChangeText={setHistQ}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                underlineColorAndroid="transparent"
                style={Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none', boxShadow: 'none' } as object) : undefined}
              />
            </View>
            <HistFilter value={histFilter} onChange={setHistFilter} />
          </View>
          {histGroups.length === 0 && !historyBusy ? (
            <EmptyState
              title={histQ || histFilter !== 'all' ? 'No matches' : 'No history'}
              body={histQ || histFilter !== 'all' ? 'Try another search or filter.' : 'Load more to look further back.'}
            />
          ) : (
            histGroups.map(([day, rows]) => (
              <View key={day} className="gap-sm">
                <Text className="mt-xs text-[12px] font-bold text-muted">{formatDay(day)}</Text>
                {rows.map((a) => (
                  <ListApptCard key={a.id} a={a} showChair={showChair} onOpen={() => onOpen(a)} />
                ))}
              </View>
            ))
          )}
          {historyMore ? (
            <Pressable
              className="items-center py-sm"
              disabled={historyBusy}
              onPress={() => onHistoryMore?.()}
            >
              {historyBusy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text className="text-[12px] font-semibold text-primary">Load more</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {view !== 'history' ? (
      <>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => shift(-7)} hitSlop={8} className="p-sm">
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <View ref={titleRef} collapsable={false} className="flex-1 py-xs">
          <Pressable
            onPress={() => {
              if (picker) {
                setPicker(null);
                onPeekMonth?.(null);
                return;
              }
              titleRef.current?.measureInWindow((x, y, w, h) => {
                onPeekMonth?.(date);
                setPicker({ x, y, w, h });
              });
            }}
          >
            <Text className="text-center text-[16px] font-bold text-ink">
              {title}
              {hint ? <Text className="font-medium text-muted"> ({hint})</Text> : null}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={() => shift(7)} hitSlop={8} className="p-sm">
          <ChevronRight size={18} color={colors.text} />
        </Pressable>
      </View>
      <View className="mb-lg flex-row gap-[6px]">
        {week.map((d) => {
          const key = ymd(d);
          const on = key === date;
          const today = key === ymd(new Date());
          const off = isClosedDay(key, h.closedWeekdays);
          const mark = marks.get(key);
          return (
            <Pressable
              key={key}
              className={`relative flex-1 items-center overflow-hidden rounded-md border px-[2px] pb-md pt-sm ${
                on ? 'border-primary bg-primary' : 'border-border bg-surface'
              }${off ? ' opacity-45' : ''}`}
              onPress={() => onDate(key)}
            >
              <Text className={`text-[11px] font-semibold ${on ? 'text-white' : 'text-muted'}`}>
                {off ? 'Off' : d.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Text>
              <Text
                className={`mt-[2px] text-[15px] font-bold ${
                  on ? 'text-white' : off ? 'text-muted' : today ? 'text-primary' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </Text>
              {!off && (mark?.booked || mark?.done) ? (
                <View
                  className={`absolute bottom-0 left-1 right-1 h-[3px] rounded-full ${
                    on ? 'bg-white' : mark?.booked ? 'bg-primary' : 'bg-success'
                  }`}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      </>
      ) : null}

      {view === 'list' ? (
        <View className="mb-lg gap-sm">
          {listAppts.length === 0 ? (
            <EmptyState title="No bookings" body="This day is clear." />
          ) : (
            listAppts.map((a) => (
              <ListApptCard key={a.id} a={a} showChair={showChair} onOpen={() => onOpen(a)} />
            ))
          )}
        </View>
      ) : null}

      {view === 'board' && closed ? (
        <View className="mb-md rounded-md border border-border bg-surface2 p-md">
          <Text className="text-[15px] font-bold text-ink">Closed</Text>
          <Text className="mt-xs text-[13px] text-muted">Weekly off. Pick another day.</Text>
        </View>
      ) : null}

      {view === 'board' ? (
      <View className="relative mb-sm">
        {HOURS.map((hour) => {
          const hhmm = `${String(hour).padStart(2, '0')}:00`;
          const past = isToday && hour * 60 <= now.getHours() * 60 + now.getMinutes();
          const last = hour === h.closeHour;
          return (
            <Pressable
              key={hour}
              className={`h-[76px] flex-row items-start${past || last || closed ? ' opacity-40' : ''}`}
              disabled={past || last || closed}
              onPress={() => {
                if (past || last || closed) return;
                onBookAt(hhmm);
              }}
            >
              <Text className="w-[56px] text-[11px] font-bold text-muted">{hour12(hour)}</Text>
              <View className={`mt-sm h-px flex-1 ${past || last ? 'bg-surface2' : 'bg-border'}`} />
            </Pressable>
          );
        })}
        <View pointerEvents="box-none" className="absolute bottom-0 left-[60px] right-0 top-0">
          {blocks.map((block) => {
            if (block.kind === 'single') {
              const { a, start, end, col, cols } = block.item;
              const top = topPx(start, openHour);
              const height = heightPx(end - start);
              const compact = height < 50;
              const color = STATUS_COLOR[a.status] ?? colors.primary;
              return (
                <View
                  key={a.id}
                  className={`absolute overflow-hidden rounded-md border border-border border-l-4 bg-surface2 pr-xs${
                    compact ? ' flex-col py-0' : ''
                  }`}
                  style={{ top: Math.max(top, 0), height, borderLeftColor: color, ...laneStyle(col, cols) } as ViewStyle}
                >
                  <ApptRow compact={compact} a={a} end={end} showChair={showChair} onOpen={() => onOpen(a)} />
                </View>
              );
            }

            const first = block.items[0];
            const last = block.items[block.items.length - 1];
            const top = topPx(first.start, openHour);
            const totalMins = last.end - first.start;
            const height = heightPx(totalMins);
            const edge = STATUS_COLOR[first.a.status] ?? colors.primary;
            return (
              <View
                key={`stack-${first.a.id}`}
                className="absolute flex-col overflow-hidden rounded-md border border-border border-l-4 bg-surface2 py-0 pr-xs"
                style={{ top: Math.max(top, 0), height, borderLeftColor: edge, ...laneStyle(block.col, block.cols) } as ViewStyle}
              >
                {block.items.map((it, idx) => (
                  <View
                    key={it.a.id}
                    className={`min-h-0 overflow-hidden${idx > 0 ? ' border-t border-border' : ''}`}
                    style={{ flex: it.end - it.start }}
                  >
                    <ApptRow compact a={it.a} end={it.end} showChair={showChair} onOpen={() => onOpen(it.a)} />
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        {isToday && nowTop >= 0 && nowTop <= HOURS.length * ROW ? (
          <View pointerEvents="none" className="absolute left-0 right-0 z-[4] flex-row items-center" style={{ top: nowTop }}>
            <Text className="w-[56px] text-[10px] font-extrabold text-danger">{time12(now)}</Text>
            <View className="mr-[2px] h-[8px] w-[8px] rounded-[4px] bg-danger" />
            <View className="h-[2px] flex-1 bg-danger" />
          </View>
        ) : null}
      </View>
      ) : null}
      {picker ? (
        <DatePicker
          date={date}
          marks={marks}
          closedWeekdays={h.closedWeekdays}
          anchor={picker}
          onPick={onDate}
          onPeek={(m) => onPeekMonth?.(m)}
          onClose={() => {
            setPicker(null);
            onPeekMonth?.(null);
          }}
        />
      ) : null}
    </View>
  );
}
