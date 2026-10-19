import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, X } from '../../icons';
import { Btn, Chip, EmptyState, ListRow, Section } from '../../ui';
import { colors } from '../../theme';
import { ChairChips, chairsForService, serviceFits, type Chair } from './chairs';
import {
  clockSlots,
  dateOptions,
  apptLabel,
  formatDay,
  isClosedDay,
  fitMins,
  normalizeSlot,
  shopHours,
  slotFits,
  time12,
  type ShopHours,
} from './time';

export function DateStrip({
  value,
  onPick,
  hours,
}: {
  value: string;
  onPick: (ymd: string) => void;
  hours?: ShopHours;
}) {
  const days = useMemo(() => dateOptions(14), []);
  const closed = hours?.closedWeekdays ?? [];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-sm py-xs"
    >
      {days.map((d) => {
        const on = d.key === value;
        const off = closed.includes(d.weekday);
        return (
          <Pressable
            key={d.key}
            className={`min-w-[56px] items-center rounded-md border px-md py-sm ${
              on ? 'border-primary bg-primary' : 'border-border bg-surface2'
            }${off ? ' opacity-40' : ''}`}
            disabled={off}
            onPress={() => {
              if (off) return;
              onPick(d.key);
            }}
          >
            <Text className={`text-[11px] font-semibold ${on ? 'text-white' : 'text-muted'}`}>
              {off ? 'Off' : d.tag ?? d.dow}
            </Text>
            <Text
              className={`mt-[2px] text-[18px] font-extrabold ${
                on ? 'text-white' : off ? 'text-muted' : 'text-ink'
              }`}
            >
              {d.num}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimeGrid({
  date,
  value,
  onPick,
  hours,
  taken,
}: {
  date: string;
  value: string;
  onPick: (hhmm: string) => void;
  hours?: ShopHours;
  taken?: Set<string>;
}) {
  if (hours && isClosedDay(date, hours.closedWeekdays)) {
    return <EmptyState title="Closed" body="Pick another day." />;
  }
  const slots = clockSlots(date, hours);
  if (slots.length === 0) {
    return <EmptyState title="No times left" body="Pick another day." />;
  }
  const busy = taken ?? new Set<string>();
  return (
    <View className="flex-row flex-wrap gap-sm">
      {slots.map((s) => {
        const blocked = busy.has(s.hhmm);
        const on = value === s.hhmm;
        return (
          <Pressable
            key={s.hhmm}
            className={`w-[31%] items-center rounded-md border py-md ${
              on ? 'border-primary bg-primary' : 'border-border bg-surface2'
            }${blocked ? ' opacity-35' : ''}`}
            disabled={blocked}
            onPress={() => {
              if (blocked) return;
              onPick(s.hhmm);
            }}
          >
            <Text
              className={`text-[13px] font-semibold ${
                on ? 'text-white' : blocked ? 'text-muted line-through' : 'text-ink'
              }`}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ClientPick({
  customers,
  customerId,
  onPick,
}: {
  customers: any[];
  customerId: number | null;
  onPick: (id: number) => void;
}) {
  const [q, setQ] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (c.isActive !== false || c.id === customerId) &&
        (!needle || c.name.toLowerCase().includes(needle) || c.phone.includes(needle)),
    );
  }, [customers, q, customerId]);
  const shown = q.trim() ? items.slice(0, 30) : items.slice(0, 9);

  if (customers.filter((c) => c.isActive !== false || c.id === customerId).length === 0) {
    return (
      <Section title="Client">
        <EmptyState title="Add a client first" body="Clients tab → Add client." />
      </Section>
    );
  }

  return (
    <Section
      title="Client"
      action={
        searchOn ? (
          <Pressable hitSlop={8} onPress={() => { setSearchOn(false); setQ(''); }}>
            <X size={18} color={colors.muted} />
          </Pressable>
        ) : (
          <Pressable hitSlop={8} onPress={() => setSearchOn(true)}>
            <Search size={18} color={colors.muted} />
          </Pressable>
        )
      }
    >
      {searchOn ? (
        <TextInput
          className="mb-sm rounded-md border border-border bg-surface2 px-md py-sm text-[15px] text-ink"
          placeholder="Search your client"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
        />
      ) : null}
        {shown.length === 0 ? (
          <Text className="py-sm text-[13px] text-muted">No match</Text>
        ) : (
          <View className="flex-row flex-wrap gap-sm">
            {shown.map((c) => (
              <Pressable
                key={c.id}
                className={`w-[48%] rounded-md border px-md py-md ${
                  customerId === c.id ? 'border-primary bg-surface' : 'border-border bg-surface2'
                }`}
                onPress={() => {
                  onPick(c.id);
                  setSearchOn(false);
                  setQ('');
                }}
              >
                <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text className="mt-[4px] text-[12px] text-muted" numberOfLines={1}>
                  {c.phone}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
    </Section>
  );
}

const CHIPS = [30, 45, 60, 90];

export function BookSheetBody({
  customers,
  services,
  customerId,
  serviceId,
  date,
  time,
  mins,
  onCustomer,
  onService,
  onDate,
  onTime,
  onMins,
  busy,
  onConfirm,
  shop,
  taken,
  chairs,
  chairId,
  onChair,
}: {
  customers: any[];
  services: any[];
  customerId: number | null;
  serviceId: number | null;
  date: string;
  time: string;
  mins: number;
  onCustomer: (id: number) => void;
  onService: (id: number) => void;
  onDate: (ymd: string) => void;
  onTime: (hhmm: string) => void;
  onMins: (n: number) => void;
  busy: boolean;
  onConfirm: () => void;
  shop?: any;
  taken?: Set<string>;
  chairs?: Chair[];
  chairId?: number | null;
  onChair?: (id: number | null) => void;
}) {
  const hours = shopHours(shop);
  const busySlots = taken ?? new Set<string>();
  const takenKey = [...busySlots].join(',');
  useEffect(() => {
    const next = normalizeSlot(date, time, hours, busySlots);
    if (next !== time) onTime(next);
  }, [date, time, onTime, hours.openHour, hours.closeHour, takenKey]);
  useEffect(() => {
    const next = fitMins(time, mins, busySlots);
    if (next !== mins) onMins(next);
  }, [time, mins, takenKey, onMins, busySlots]);

  const customer = customers.find((c) => c.id === customerId);
  const service = services.find((s) => s.id === serviceId);
  const offerChairs = chairsForService(chairs ?? [], service);
  const offerServices = services.filter(
    (s) => s.isActive !== false && serviceFits(s, chairId ?? null),
  );
  const ready = !!(
    customer &&
    customer.isActive !== false &&
    service &&
    service.isActive !== false &&
    time &&
    slotFits(time, mins, busySlots)
  );
  const confirmLabel = ready
    ? `Book · ${formatDay(date)} ${time12(`${date}T${time}:00`)}`
    : 'Pick client + service + time';

  return (
    <>
      <ClientPick customers={customers} customerId={customerId} onPick={onCustomer} />
      <ChairChips
        chairs={offerChairs}
        value={chairId ?? null}
        onPick={(id) => onChair?.(id)}
        allowAny={offerChairs.length > 1}
      />

      <Section title="Service">
        <View className="flex-row flex-wrap gap-sm">
          {offerServices.map((s) => (
              <Pressable
                key={s.id}
                className={`w-[48%] rounded-md border px-md py-md ${
                  serviceId === s.id ? 'border-primary bg-surface' : 'border-border bg-surface2'
                }`}
                onPress={() => onService(s.id)}
              >
                <View className="flex-row items-start justify-between gap-xs">
                  <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text className="text-[13px] font-bold text-primary">₹{s.price}</Text>
                </View>
                <Text className="mt-[4px] text-[12px] text-muted">{s.durationMinutes} min</Text>
              </Pressable>
            ))}
        </View>
      </Section>

      {service ? (
        <Section title="Duration">
          <View className="flex-row flex-wrap gap-sm">
            {CHIPS.map((n) => (
              <Chip
                key={n}
                label={`${n}m`}
                selected={mins === n}
                disabled={!slotFits(time, n, busySlots)}
                onPress={() => onMins(n)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Day">
        <DateStrip value={date} onPick={onDate} hours={hours} />
      </Section>

      <Section title="Time">
        <TimeGrid date={date} value={time} onPick={onTime} hours={hours} taken={busySlots} />
      </Section>

      {ready ? (
        <View className="mb-sm mt-md rounded-md border border-border bg-surface2 p-md">
          <Text className="text-[16px] font-bold text-ink">{customer.name}</Text>
          <Text className="mt-[4px] text-[13px] text-muted">
            {service.name} · {mins}m · {formatDay(date)} · {time12(`${date}T${time}:00`)}
          </Text>
        </View>
      ) : null}

      <Btn label={confirmLabel} inset busy={busy} onPress={onConfirm} disabled={!ready} />
    </>
  );
}

export function ApptSheetBody({
  customers,
  customerId,
  customer,
  serviceName,
  status,
  services,
  serviceId,
  date,
  time,
  mins,
  onCustomer,
  onService,
  onDate,
  onTime,
  onMins,
  busy,
  onSave,
  onStatus,
  shop,
  taken,
  chairs,
  chairId,
  onChair,
}: {
  customers: any[];
  customerId: number;
  customer: { name: string; phone: string };
  serviceName: string;
  status: string;
  services: any[];
  serviceId: number;
  date: string;
  time: string;
  mins: number;
  onCustomer: (id: number) => void;
  onService: (id: number) => void;
  onDate: (ymd: string) => void;
  onTime: (hhmm: string) => void;
  onMins: (n: number) => void;
  busy: boolean;
  onSave: () => void;
  onStatus: (s: string) => void;
  shop?: any;
  taken?: Set<string>;
  chairs?: Chair[];
  chairId?: number | null;
  onChair?: (id: number) => void;
}) {
  const hours = shopHours(shop);
  const busySlots = taken ?? new Set<string>();
  const takenKey = [...busySlots].join(',');
  const service = services.find((s) => s.id === serviceId);
  const offerChairs = chairsForService(chairs ?? [], service);
  const offerServices = services.filter(
    (s) => (s.isActive !== false || s.id === serviceId) && serviceFits(s, chairId ?? null),
  );
  useEffect(() => {
    const next = normalizeSlot(date, time, hours, busySlots);
    if (next !== time) onTime(next);
  }, [date, time, onTime, hours.openHour, hours.closeHour, takenKey]);
  useEffect(() => {
    const next = fitMins(time, mins, busySlots);
    if (next !== mins) onMins(next);
  }, [time, mins, takenKey, onMins, busySlots]);

  return (
    <>
      <ClientPick customers={customers} customerId={customerId} onPick={onCustomer} />
      <ChairChips
        chairs={offerChairs}
        value={chairId ?? null}
        onPick={(id) => {
          if (id != null) onChair?.(id);
        }}
      />
      <Section title="Service">
        {offerServices.map((s) => (
          <ListRow
            key={s.id}
            title={s.name}
            subtitle={`${s.durationMinutes} min`}
            selected={serviceId === s.id}
            onPress={() => onService(s.id)}
          />
        ))}
      </Section>

      <Section title="Day">
        <DateStrip value={date} onPick={onDate} hours={hours} />
      </Section>

      <Section title="Time">
        <TimeGrid date={date} value={time} onPick={onTime} hours={hours} taken={busySlots} />
      </Section>

      <Section title="Duration">
        <View className="flex-row flex-wrap gap-sm">
          {CHIPS.map((n) => (
            <Chip
              key={n}
              label={`${n}m`}
              selected={mins === n}
              disabled={!slotFits(time, n, busySlots)}
              onPress={() => onMins(n)}
            />
          ))}
        </View>
      </Section>

      <View className="mb-sm mt-md rounded-md border border-border bg-surface2 p-md">
        <Text className="text-[16px] font-bold text-ink">{customer.name}</Text>
        <Text className="mt-[4px] text-[13px] text-muted">
          {serviceName} · {mins}m · {formatDay(date)} · {time12(`${date}T${time}:00`)} · {apptLabel(status, `${date}T${time}:00`)}
        </Text>
        <Text className="mt-[4px] text-[13px] text-muted">{customer.phone}</Text>
      </View>

      <Btn label="Save changes" inset busy={busy} onPress={onSave} disabled={!customer || !serviceId || !time} />

      <View className="mt-sm flex-row flex-wrap">
        {new Date(`${date}T${time}:00`).getTime() <= Date.now() ? (
          <>
            <Chip label="Done" selected={status === 'COMPLETED'} onPress={() => onStatus('COMPLETED')} />
            <Chip label="Missed" selected={status === 'NO_SHOW'} onPress={() => onStatus('NO_SHOW')} />
          </>
        ) : null}
        <Chip label="Cancel" selected={status === 'CANCELLED'} onPress={() => onStatus('CANCELLED')} />
      </View>
    </>
  );
}
