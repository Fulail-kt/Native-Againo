import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Switch } from '@/components/ui/switch';
import { Calendar, LogOut, Plus, Scissors, Settings, Users } from '../../icons';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Form, FormField, FormSubmit, useAppForm } from '../../form';
import {
  addClientSchema,
  chairSchema,
  shopServiceSchema,
  shopSettingsSchema,
  type AddClientValues,
  type ChairValues,
  type ShopServiceValues,
  type ShopSettingsValues,
} from '../../schemas';
import {
  AppShell,
  BottomNav,
  Btn,
  CheckRow,
  Chip,
  EmptyState,
  Fab,
  Header,
  HelpTrigger,
  ListRow,
  PairCtas,
  ScrollBody,
  Section,
  DayOverviewGrid,
  AppearanceSettings,
} from '../../ui';
import { BottomSheet } from '../../components/BottomSheet';
import { pop } from '../../pop';
import { BarberDayBoard, historyChunkBounds, monthGridBounds, startOfTomorrow } from './BarberDayBoard';
import { ClientPage } from './ClientPage';
import { ApptSheetBody, BookSheetBody } from './schedule';
import {
  formatDay,
  hhmm,
  hour12,
  isClosedDay,
  isPastDay,
  isPastSlot,
  nextHalfHour,
  normalizeSlot,
  shopHours,
  takenStarts,
  time12,
  ymd,
} from './time';
import { WhatsAppCard } from './WhatsAppCard';
import { WhatsAppSignup } from './WhatsAppSignup';
import {
  ChairChips,
  chairLabel,
  chairsForService,
  ownerChairOf,
  selfFirst,
  serviceFits,
  staffChairOf,
} from './chairs';

type Tab = 'today' | 'customers' | 'services' | 'more';

const NAV = [
  { key: 'today', label: 'Calendar', Icon: Calendar },
  { key: 'customers', label: 'Clients', Icon: Users },
  { key: 'services', label: 'Services', Icon: Scissors },
  { key: 'more', label: 'Salon', Icon: Settings },
];

const CHIPS = [30, 45, 60, 90];
const WEEK = [
  { d: 0, l: 'Sun' },
  { d: 1, l: 'Mon' },
  { d: 2, l: 'Tue' },
  { d: 3, l: 'Wed' },
  { d: 4, l: 'Thu' },
  { d: 5, l: 'Fri' },
  { d: 6, l: 'Sat' },
];

function upcomingLabel(n?: number) {
  const c = n ?? 0;
  return c === 1 ? '1 upcoming' : `${c} upcoming`;
}

function rupees(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function ChairForm({
  initial,
  upcoming,
  chairs,
  ownerId,
  isSelf,
  dropTo,
  dropping,
  busy,
  onDropTo,
  onDropping,
  onSave,
  onRemove,
}: {
  initial: ChairValues;
  upcoming: number;
  chairs: any[];
  ownerId?: number;
  isSelf?: boolean;
  dropTo: number | null;
  dropping: boolean;
  busy: boolean;
  onDropTo: (id: number | null) => void;
  onDropping: (v: boolean | ((p: boolean) => boolean)) => void;
  onSave: (v: ChairValues) => void | Promise<void>;
  onRemove: (id: number) => void;
}) {
  const form = useAppForm<ChairValues>(chairSchema, initial);
  const assign = form.watch('assignStaff');
  const hasStaff = form.watch('hasStaff');
  const isOwner = form.watch('isOwner');
  const locked = isOwner || !!isSelf;
  return (
    <Form form={form}>
      <FormField
        control={form.control}
        name="name"
        label="Chair name"
        maxLength={40}
        placeholder="Chair name"
      />
      {locked ? (
        <Text className="mb-md text-[13px] text-muted">
          {isOwner ? 'Owner seat.' : 'Your seat.'} Rename only.
          {isOwner ? ' Cannot delete.' : ' Cannot remove your login.'}
          {upcoming > 0 ? ` ${upcomingLabel(upcoming)}.` : ''}
        </Text>
      ) : (
        <>
          <CheckRow
            label="Assign staff"
            body="They log in with phone + password"
            checked={assign}
            onToggle={() => form.setValue('assignStaff', !assign, { shouldDirty: true, shouldValidate: true })}
          />
          {assign ? (
            <>
              <FormField control={form.control} name="staffName" label="Staff name" maxLength={80} placeholder="Ravi" />
              <FormField
                control={form.control}
                name="staffPhone"
                label="Staff phone"
                kind="digits"
                maxLength={15}
                placeholder="9876543210"
              />
              <FormField
                control={form.control}
                name="staffPassword"
                label={hasStaff ? 'New password (optional)' : 'Password'}
                secure
                maxLength={72}
                placeholder={hasStaff ? 'Leave blank to keep' : 'Min 6 characters'}
              />
              <CheckRow
                label="Salon admin"
                body="Can edit shop, chairs, services"
                checked={form.watch('canAdmin')}
                onToggle={() =>
                  form.setValue('canAdmin', !form.getValues('canAdmin'), { shouldDirty: true, shouldValidate: true })
                }
              />
            </>
          ) : null}
          {upcoming > 0 ? (
            <Text className="mb-md text-[13px] text-muted">{upcomingLabel(upcoming)} on this chair.</Text>
          ) : null}
        </>
      )}
      {initial.id != null && chairs.length > 1 && !locked && upcoming > 0 ? (
        <>
          <Pressable className="mb-sm py-sm" onPress={() => onDropping((v) => !v)}>
            <Text className="text-[14px] font-semibold text-primary">
              {dropTo ? `Move bookings → ${chairs.find((c: any) => c.id === dropTo)?.name ?? 'chair'}` : 'Move bookings'}
            </Text>
          </Pressable>
          {dropping
            ? chairs
                .filter((c: any) => c.id !== initial.id)
                .map((c: any) => (
                  <ListRow
                    key={c.id}
                    title={c.name}
                    subtitle={`${c.id === ownerId ? 'Owner' : c.staff?.name ?? c.name} · ${upcomingLabel(c.upcoming)}`}
                    selected={dropTo === c.id}
                    onPress={() => onDropTo(c.id === dropTo ? null : c.id)}
                  />
                ))
            : null}
        </>
      ) : null}
      <FormSubmit
        label={initial.id == null ? 'Save chair' : 'Save'}
        inset
        busy={busy}
        onValid={onSave}
        requireDirty={initial.id != null}
      />
      {initial.id != null && chairs.length > 1 && !locked ? (
        <Btn label="Remove chair" variant="ghost" inset onPress={() => onRemove(initial.id!)} />
      ) : null}
    </Form>
  );
}

function HourStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (h: number) => void;
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View className="flex-1">
      <Text className="mb-sm text-[13px] font-semibold text-muted">{label}</Text>
      <View className="flex-row items-center justify-between rounded-md border border-border bg-surface2 px-sm py-[6px]">
        <Pressable
          className={`h-[36px] w-[36px] items-center justify-center rounded-sm bg-surface${atMin ? ' opacity-35' : ''}`}
          disabled={atMin}
          onPress={() => onChange(value - 1)}
        >
          <Text className="text-[20px] font-semibold leading-[22px] text-ink">−</Text>
        </Pressable>
        <Text className="text-[16px] font-bold text-ink">{hour12(value)}</Text>
        <Pressable
          className={`h-[36px] w-[36px] items-center justify-center rounded-sm bg-surface${atMax ? ' opacity-35' : ''}`}
          disabled={atMax}
          onPress={() => onChange(value + 1)}
        >
          <Text className="text-[20px] font-semibold leading-[22px] text-ink">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ChipRow({
  suffix,
  value,
  onPick,
}: {
  suffix: string;
  value: number;
  onPick: (n: number) => void;
}) {
  return (
    <View className="flex-row flex-wrap">
      {CHIPS.map((n) => (
        <Chip key={n} label={`${n}${suffix}`} selected={value === n} onPress={() => onPick(n)} />
      ))}
    </View>
  );
}

function clashText(e: unknown) {
  const list = (e as Error & { conflicts?: { startAt?: string; endAt?: string; fromName?: string; toName?: string }[] })
    ?.conflicts;
  if (!Array.isArray(list) || !list.length) return '';
  const lines = list.slice(0, 8).map((c) => {
    const start = new Date(c.startAt ?? '');
    const end = new Date(c.endAt ?? c.startAt ?? '');
    const who = [c.fromName, c.toName].filter(Boolean).join(' overlaps ');
    return `${formatDay(ymd(start))} ${time12(start)}–${time12(end)}${who ? `\n${who}` : ''}`;
  });
  const more = list.length > 8 ? `\n+${list.length - 8} more` : '';
  return `${lines.join('\n\n')}${more}\n\nReschedule or cancel the overlap, then try again.`;
}

function chairErr(title: string, e: unknown) {
  const clash = clashText(e);
  if (clash) return pop.info('Overlapping times', clash);
  return pop.err(title, e);
}

export function BarberApp() {
  const { token, user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [shop, setShop] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [wa, setWa] = useState<any>(null);
  const [sheet, setSheet] = useState<null | 'customer' | 'service' | 'book' | 'appt'>(null);
  const [viewClientId, setViewClientId] = useState<number | null>(null);
  const [editServiceId, setEditServiceId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [openHour, setOpenHour] = useState(9);
  const [closeHour, setCloseHour] = useState(20);
  const [closedDays, setClosedDays] = useState<number[]>([]);

  const shopForm = useAppForm<ShopSettingsValues>(shopSettingsSchema, {
    name: '',
    phone: '',
    mapsUrl: '',
    followUpDays: 45,
    openHour: 9,
    closeHour: 20,
    closedWeekdays: [] as number[],
  });
  const clientForm = useAppForm<AddClientValues>(addClientSchema, {
    name: '',
    phone: '',
    sendWelcome: true,
    followUpDays: 45,
    preferredChairId: null,
  });
  const serviceForm = useAppForm(shopServiceSchema, { name: '', mins: '60', price: '250' });
  const shopMapsUrl = shopForm.watch('mapsUrl');
  const shopOpen = shopForm.watch('openHour');
  const shopClose = shopForm.watch('closeHour');
  const shopOff = shopForm.watch('closedWeekdays');
  const shopFollow = shopForm.watch('followUpDays');
  const sendWelcome = clientForm.watch('sendWelcome');
  const cFollowDays = clientForm.watch('followUpDays');
  const [bookCustomer, setBookCustomer] = useState<any>(null);
  const [bookService, setBookService] = useState<any>(null);
  const [calDate, setCalDate] = useState(() => ymd());
  const [peekMonth, setPeekMonth] = useState<string | null>(null);
  const [bookDate, setBookDate] = useState(() => ymd());
  const [bookTime, setBookTime] = useState(nextHalfHour());
  const [bookMins, setBookMins] = useState(60);
  const [picked, setPicked] = useState<any>(null);
  const [editDate, setEditDate] = useState(() => ymd());
  const [editTime, setEditTime] = useState('');
  const [editMins, setEditMins] = useState(60);
  const [waTicket, setWaTicket] = useState<string | null>(null);
  const [waOauthUrl, setWaOauthUrl] = useState<string | null>(null);
  const [calChairId, setCalChairId] = useState<number | null>(null);
  const [bookChairId, setBookChairId] = useState<number | null>(null);
  const [chairDropTo, setChairDropTo] = useState<number | null>(null);
  const [chairDropping, setChairDropping] = useState(false);
  const [chairEdit, setChairEdit] = useState<ChairValues | null>(null);
  const [serviceChairIds, setServiceChairIds] = useState<number[]>([]);
  const [serviceStaffOpen, setServiceStaffOpen] = useState(false);
  const histOpen = useRef(false);
  const histCursor = useRef<Date | null>(null);
  const [histAppts, setHistAppts] = useState<any[]>([]);
  const [histMore, setHistMore] = useState(false);
  const [histBusy, setHistBusy] = useState(false);

  const loadShop = useCallback(async () => {
    const s = await api('/shops/me', { token });
    setShop(s);
    const days = s.followUpDays ?? 45;
    const hours = {
      openHour: s.openHour ?? 9,
      closeHour: s.closeHour ?? 20,
      closedWeekdays: s.closedWeekdays ?? [],
    };
    setOpenHour(hours.openHour);
    setCloseHour(hours.closeHour);
    setClosedDays(hours.closedWeekdays);
    shopForm.reset({
      name: s.name ?? '',
      phone: String(s.phone ?? '').replace(/\D/g, ''),
      mapsUrl: s.address ?? '',
      followUpDays: days,
      ...hours,
    });
    clientForm.reset({ name: '', phone: '', sendWelcome: true, followUpDays: days, preferredChairId: null });
  }, [token]);

  const loadCustomers = useCallback(async () => {
    setCustomers(await api('/shops/customers', { token }));
  }, [token]);

  const loadServices = useCallback(async () => {
    setServices(await api('/shops/services', { token }));
  }, [token]);

  const loadAppts = useCallback(async () => {
    const r = monthGridBounds(peekMonth ?? calDate);
    setAppts(
      await api(`/shops/appointments?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`, {
        token,
      }),
    );
  }, [token, calDate, peekMonth]);

  const loadHistoryChunk = useCallback(
    async (reset: boolean) => {
      const to = reset || !histCursor.current ? startOfTomorrow() : histCursor.current;
      const r = historyChunkBounds(to);
      setHistBusy(true);
      try {
        const data = await api(
          `/shops/appointments?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}&older=1`,
          { token },
        );
        const rows = Array.isArray(data) ? data : (data.items ?? []);
        histCursor.current = r.fromDate;
        setHistAppts((prev) => {
          const merged = reset ? rows : [...rows, ...prev];
          const seen = new Set<number>();
          return merged.filter((a: any) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
        });
        const floor = new Date();
        floor.setFullYear(floor.getFullYear() - 2);
        setHistMore(!!data.hasOlder && r.fromDate.getTime() > floor.getTime());
      } finally {
        setHistBusy(false);
      }
    },
    [token],
  );

  const loadWa = useCallback(async () => {
    setWa(await api('/integrations/whatsapp', { token }));
  }, [token]);

  useEffect(() => {
    Promise.all([loadShop(), loadCustomers(), loadServices()]).catch((e) => pop.err('Shop', e));
  }, [loadShop, loadCustomers, loadServices]);

  useEffect(() => {
    if (user?.role === 'SHOP_OWNER' || shop?.canAdmin) loadWa().catch((e) => pop.err('WhatsApp', e));
  }, [user?.role, shop?.canAdmin, loadWa]);

  useEffect(() => {
    if (tab !== 'today' || histOpen.current) return;
    loadAppts().catch((e) => pop.err('Calendar', e));
  }, [tab, loadAppts]);

  async function addCustomer(values: AddClientValues) {
    setBusy(true);
    try {
      const row = await api('/shops/customers', {
        token,
        method: 'POST',
        body: {
          name: values.name.trim(),
          phone: values.phone,
          sendGreeting: values.sendWelcome,
          followUpDays: values.followUpDays,
          preferredChairId: values.preferredChairId ?? undefined,
        },
      });
      clientForm.reset({
        name: '',
        phone: '',
        sendWelcome: true,
        followUpDays: shop?.followUpDays ?? 45,
        preferredChairId: null,
      });
      setSheet(null);
      await loadCustomers();
      if (!values.sendWelcome) pop.ok('Client added');
      else if (row.greeting?.sent) pop.ok('Client added', 'Welcome WhatsApp sent.');
      else if (row.greeting?.reason) pop.ok('Client saved', `WhatsApp skipped: ${row.greeting.reason}`);
      else pop.ok('Client added');
    } catch (e) {
      pop.err('Add failed', e);
    } finally {
      setBusy(false);
    }
  }

  function openService(row?: any) {
    if (row) {
      setEditServiceId(row.id);
      serviceForm.reset({
        name: row.name,
        mins: String(row.durationMinutes),
        price: String(row.price),
      });
      setServiceChairIds(Array.isArray(row.chairIds) ? row.chairIds : []);
    } else {
      setEditServiceId(null);
      serviceForm.reset({ name: '', mins: '60', price: '250' });
      setServiceChairIds([]);
    }
    setServiceStaffOpen(false);
    setSheet('service');
  }

  async function saveService(values: ShopServiceValues) {
    const mins = Number(values.mins);
    const price = Number(values.price);
    setBusy(true);
    try {
      const body = {
        name: values.name.trim(),
        durationMinutes: mins,
        price,
        chairIds: serviceChairIds,
      };
      if (editServiceId) {
        await api(`/shops/services/${editServiceId}`, { token, method: 'PATCH', body });
        pop.ok('Service updated');
      } else {
        await api('/shops/services', { token, method: 'POST', body });
        pop.ok('Service added');
      }
      serviceForm.reset({ name: '', mins: '60', price: '250' });
      setServiceChairIds([]);
      setEditServiceId(null);
      setSheet(null);
      await loadServices();
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  function serviceBody(row: any, extra?: Record<string, unknown>) {
    return {
      name: row.name,
      durationMinutes: row.durationMinutes,
      price: Number(row.price),
      chairIds: Array.isArray(row.chairIds) ? row.chairIds : [],
      ...extra,
    };
  }

  async function toggleServiceActive(row: any) {
    const next = row.isActive === false;
    setServices((cur) => cur.map((s) => (s.id === row.id ? { ...s, isActive: next } : s)));
    try {
      await api(`/shops/services/${row.id}`, {
        token,
        method: 'PATCH',
        body: serviceBody(row, { isActive: next }),
      });
    } catch (e) {
      await loadServices();
      pop.err('Save failed', e);
    }
  }

  async function dropService() {
    if (!editServiceId) return;
    const ok = await pop.ask('Delete service?', 'Gone for good. No bookings on it.', {
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/shops/services/${editServiceId}`, { token, method: 'DELETE' });
      setEditServiceId(null);
      setSheet(null);
      await loadServices();
      pop.ok('Deleted');
    } catch (e) {
      pop.err('Delete failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function setServiceOn(on: boolean) {
    const row = services.find((s) => s.id === editServiceId);
    if (!row) return;
    setBusy(true);
    try {
      await api(`/shops/services/${row.id}`, {
        token,
        method: 'PATCH',
        body: serviceBody(row, { isActive: on }),
      });
      setEditServiceId(null);
      setSheet(null);
      await loadServices();
      pop.ok(on ? 'Service on' : 'Service disabled');
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  function customerBody(row: any, extra?: Record<string, unknown>) {
    return {
      name: row.name,
      phone: String(row.phone ?? '').replace(/\D/g, ''),
      notes: row.notes || undefined,
      followUpDays: row.followUpDays,
      preferredChairId: row.preferredChairId ?? null,
      ...extra,
    };
  }

  async function toggleCustomerActive(row: any) {
    const next = row.isActive === false;
    setCustomers((cur) => cur.map((c) => (c.id === row.id ? { ...c, isActive: next } : c)));
    if (bookCustomer?.id === row.id && !next) setBookCustomer(null);
    try {
      await api(`/shops/customers/${row.id}`, {
        token,
        method: 'PATCH',
        body: customerBody(row, { isActive: next }),
      });
    } catch (e) {
      await loadCustomers();
      pop.err('Save failed', e);
    }
  }

  async function book() {
    if (!bookCustomer || !bookService || bookCustomer.isActive === false || bookService.isActive === false) {
      pop.info('Pick client + service');
      return;
    }
    const startAt = new Date(`${bookDate}T${bookTime}:00`);
    if (Number.isNaN(startAt.getTime())) {
      pop.info('Bad date/time', 'Use YYYY-MM-DD and HH:mm.');
      return;
    }
    if (startAt.getTime() <= Date.now()) {
      pop.info('Past time', 'Pick a future slot.');
      return;
    }
    setBusy(true);
    try {
      await api('/shops/appointments', {
        token,
        method: 'POST',
        body: {
          customerId: bookCustomer.id,
          serviceId: bookService.id,
          startAt: startAt.toISOString(),
          durationMinutes: bookMins,
          ...(bookChairId ? { chairId: bookChairId } : {}),
        },
      });
      setSheet(null);
      await loadAppts();
      pop.ok('Booked');
    } catch (e) {
      pop.err('Book failed', e);
    } finally {
      setBusy(false);
    }
  }

  function primeBook(date: string, time: string) {
    const hours = shopHours({ openHour, closeHour, closedWeekdays: closedDays });
    if (isClosedDay(date, hours.closedWeekdays)) {
      pop.info('Closed', 'That weekday is a weekly off.');
      return;
    }
    setBookDate(date);
    setBookTime(normalizeSlot(date, time, hours));
    const liveC = customers.filter((c) => c.isActive !== false);
    const pickC = bookCustomer?.isActive !== false ? bookCustomer : liveC.length === 1 ? liveC[0] : null;
    setBookCustomer(pickC);
    const liveS = services.filter((s) => s.isActive !== false);
    const svc = bookService?.isActive !== false ? bookService : liveS.length === 1 ? liveS[0] : null;
    if (svc) {
      setBookService(svc);
      setBookMins(svc.durationMinutes || 60);
    } else {
      setBookService(null);
    }
    const prefer = bookCustomer?.preferredChairId;
    setBookChairId(calChairId ?? prefer ?? selfChairId ?? listedChairs[0]?.id ?? null);
    setSheet('book');
  }

  async function saveApptEdits() {
    if (!picked) return;
    const startAt = new Date(`${editDate}T${editTime}:00`);
    if (Number.isNaN(startAt.getTime())) {
      pop.info('Bad time', 'Use HH:mm.');
      return;
    }
    if (startAt.getTime() <= Date.now()) {
      pop.info('Past time', 'Pick a future slot.');
      return;
    }
    setBusy(true);
    try {
      await api(`/shops/appointments/${picked.id}`, {
        token,
        method: 'PATCH',
        body: {
          startAt: startAt.toISOString(),
          durationMinutes: editMins,
          serviceId: picked.serviceId,
          customerId: picked.customerId,
          chairId: picked.chairId,
        },
      });
      setSheet(null);
      setPicked(null);
      await loadAppts();
      pop.ok('Updated');
    } catch (e) {
      pop.err('Update failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function setApptStatus(status: string) {
    if (!picked) return;
    setBusy(true);
    try {
      const id = picked.id;
      const res = await api(`/shops/appointments/${picked.id}`, {
        token,
        method: 'PATCH',
        body: { status },
      });
      setSheet(null);
      setPicked(null);
      setHistAppts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      await Promise.all([loadAppts(), loadCustomers()]);
      if (status === 'COMPLETED') {
        const pts = res.loyaltyAwarded ?? 10;
        pop.ok(res.loyaltyStreak ? `Done · +${pts} streak` : `Done · +${pts} pts`);
      } else {
        pop.ok('Updated');
      }
    } catch (e) {
      pop.err('Update failed', e);
    } finally {
      setBusy(false);
    }
  }

  function goTab(k: Tab) {
    setSheet(null);
    setEditServiceId(null);
    setTab(k);
  }

  async function saveShop(values: ShopSettingsValues) {
    setBusy(true);
    try {
      const s = await api('/shops/me', {
        token,
        method: 'PATCH',
        body: {
          name: values.name.trim(),
          phone: values.phone || undefined,
          address: values.mapsUrl.trim() || '',
          followUpDays: values.followUpDays,
          openHour: values.openHour,
          closeHour: values.closeHour,
          closedWeekdays: values.closedWeekdays,
        },
      });
      setShop(s);
      setOpenHour(s.openHour ?? values.openHour);
      setCloseHour(s.closeHour ?? values.closeHour);
      setClosedDays(s.closedWeekdays ?? values.closedWeekdays);
      shopForm.reset(values);
      clientForm.setValue('followUpDays', s.followUpDays ?? values.followUpDays);
      pop.ok('Saved');
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function connectWa() {
    setWaBusy(true);
    try {
      const res = await api('/integrations/whatsapp/connect', { token, method: 'POST' });
      if (res.restored || (res.status === 'CONNECTED' && !res.ticket)) {
        setWa(res);
        pop.ok('WhatsApp connected');
        return;
      }
      setWaTicket(res.ticket);
      setWaOauthUrl(res.oauthUrl ?? null);
      if (!res.oauthUrl) {
        pop.info(
          'Set PUBLIC_API_URL',
          'Meta needs HTTPS. Start ngrok on port 3000 and put that https URL in Nest/.env as PUBLIC_API_URL, then restart Nest.',
        );
      }
    } catch (e) {
      pop.err('WhatsApp', e);
    } finally {
      setWaBusy(false);
    }
  }

  async function finishWa(payload: { code: string; wabaId?: string; phoneNumberId?: string }) {
    const ticket = waTicket;
    setWaTicket(null);
    setWaOauthUrl(null);
    if (!ticket) return;
    setWaBusy(true);
    try {
      const next = await api('/integrations/whatsapp/complete', {
        token,
        method: 'POST',
        body: { ticket, ...payload },
      });
      setWa(next);
      pop.ok('WhatsApp connected');
    } catch (e) {
      pop.err('WhatsApp', e);
      loadWa().catch(() => undefined);
    } finally {
      setWaBusy(false);
    }
  }

  async function disconnectWa() {
    const ok = await pop.ask(
      'Disconnect WhatsApp?',
      'This shop will stop sending. Reconnect uses the same number — no new Meta account.',
      { confirm: 'Disconnect', danger: true },
    );
    if (!ok) return;
    setWaBusy(true);
    try {
      setWa(await api('/integrations/whatsapp/disconnect', { token, method: 'POST' }));
      pop.ok('Disconnected');
    } catch (e) {
      pop.err('Disconnect failed', e);
    } finally {
      setWaBusy(false);
    }
  }

  async function testWa(phone: string) {
    setWaBusy(true);
    try {
      await api('/integrations/whatsapp/test', {
        token,
        method: 'POST',
        body: { phone },
      });
      pop.ok('Test sent', 'Check the phone. Meta may still reject text outside the 24h window.');
    } catch (e) {
      pop.err('Test failed', e);
    } finally {
      setWaBusy(false);
    }
  }

  const chairs = shop?.chairs ?? [];
  const isShopOwner = user?.role === 'SHOP_OWNER';
  const isAdmin = isShopOwner || !!shop?.canAdmin;
  const isStaff = user?.role === 'SHOP_STAFF' && !isAdmin;
  const ownerChair = ownerChairOf(chairs);
  const myChair = staffChairOf(chairs, user?.id);
  const selfChairId = myChair?.id ?? (isShopOwner ? ownerChair?.id : undefined);
  const listedChairs = useMemo(() => selfFirst(chairs as any[], selfChairId), [chairs, selfChairId]);
  const editUpcoming =
    chairEdit?.id != null ? (chairs.find((c: any) => c.id === chairEdit.id)?.upcoming ?? 0) : 0;
  const boardChairs = isStaff && myChair ? [myChair] : listedChairs;
  const visibleServices = services.filter((s) => {
    if (isStaff && myChair && !serviceFits(s, myChair.id)) return false;
    if (!isAdmin && s.isActive === false) return false;
    return true;
  });
  const editingService = editServiceId != null ? services.find((s) => s.id === editServiceId) : null;
  useEffect(() => {
    if (isStaff && myChair?.id) setCalChairId(myChair.id);
  }, [isStaff, myChair?.id]);
  const preferChair = clientForm.watch('preferredChairId');
  const dayAppts = useMemo(
    () => appts.filter((a) => ymd(new Date(a.startAt)) === calDate),
    [appts, calDate],
  );
  const dayStats = useMemo(() => {
    const scoped = dayAppts.filter((a) => !calChairId || a.chairId === calChairId);
    const booked = scoped.filter((a) => a.status === 'BOOKED').length;
    const done = scoped.filter((a) => a.status === 'COMPLETED').length;
    const missed = scoped.filter((a) => a.status === 'NO_SHOW').length;
    const paid = scoped.filter((a) => a.status === 'COMPLETED');
    const revenue = paid.reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0);
    const lines =
      boardChairs.length > 1 && calChairId == null
        ? boardChairs.map((c: any) => ({
            label: chairLabel(c),
            value: rupees(
              dayAppts
                .filter((a) => a.status === 'COMPLETED' && a.chairId === c.id)
                .reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0),
            ),
          }))
        : undefined;
    return { booked, done, missed, revenue, lines };
  }, [dayAppts, calChairId, boardChairs]);
  const bookTaken = useMemo(
    () =>
      takenStarts(
        dayAppts,
        null,
        bookChairId,
        chairsForService(boardChairs, bookService).map((c: any) => c.id),
      ),
    [dayAppts, bookChairId, boardChairs, bookService],
  );
  const editTaken = useMemo(
    () =>
      takenStarts(
        dayAppts,
        picked?.id,
        picked?.chairId,
        chairsForService(boardChairs, picked?.service).map((c: any) => c.id),
      ),
    [dayAppts, picked?.id, picked?.chairId, picked?.service, boardChairs],
  );

  async function addChair() {
    if (chairs.length >= 5) {
      pop.info('Chair limit', 'Max 5 chairs.');
      return;
    }
    setChairEdit({
      id: null,
      name: `Chair ${chairs.length + 1}`,
      assignStaff: false,
      staffName: '',
      staffPhone: '',
      staffPassword: '',
      hasStaff: false,
      canAdmin: false,
      isOwner: false,
    });
  }

  async function saveChair(values: ChairValues) {
    const name = values.name.trim();
    const ownerSeat = values.isOwner;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name };
      if (values.assignStaff && !ownerSeat) {
        body.staffName = values.staffName.trim();
        body.staffPhone = values.staffPhone.replace(/\D/g, '');
        if (values.staffPassword) body.staffPassword = values.staffPassword;
        body.canAdmin = values.canAdmin;
      } else if (!ownerSeat && values.id != null) {
        body.canAdmin = false;
      }
      if (values.id == null) {
        await api('/shops/chairs', { token, method: 'POST', body });
        pop.ok(values.assignStaff ? 'Chair + staff added' : 'Chair added');
      } else {
        const destOk =
          chairDropTo != null &&
          !ownerSeat &&
          chairs.some((c: any) => c.id === chairDropTo);
        if (destOk) {
          await api(`/shops/chairs/${values.id}/move`, {
            token,
            method: 'POST',
            body: { to: chairDropTo },
          });
        }
        await api(`/shops/chairs/${values.id}`, { token, method: 'PATCH', body });
        pop.ok(destOk ? 'Saved · bookings moved' : 'Saved');
      }
      setChairEdit(null);
      setChairDropTo(null);
      setChairDropping(false);
      await loadShop();
    } catch (e) {
      chairErr('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  function chairWho(c: any) {
    if (!c) return 'Owner';
    if (ownerChair && c.id === ownerChair.id) return `${c.name} · Owner`;
    return c.staff?.name ? `${c.name} · ${c.staff.name}` : `${c.name} · Owner`;
  }

  async function dropChair(id: number) {
    if (ownerChair && id === ownerChair.id) {
      pop.info('Owner chair', 'Owner chair cannot be deleted.');
      return;
    }
    if (!isShopOwner && myChair && id === myChair.id) {
      pop.info('Your chair', 'Cannot remove your own login.');
      return;
    }
    const others = chairs.filter((c: any) => c.id !== id);
    if (!others.length) {
      pop.info('Last chair', 'Keep at least one chair.');
      return;
    }
    const live = chairs.find((c: any) => c.id === id)?.upcoming ?? 0;
    const dest =
      others.find((c: any) => c.id === chairDropTo) ??
      (live === 0 ? others.find((c: any) => c.id === ownerChair?.id) ?? others[0] : undefined);
    if (!dest) {
      setChairDropping(true);
      pop.info('Move bookings', 'Pick who takes the bookings first.');
      return;
    }
    const ok = await pop.ask(
      'Remove chair?',
      `Bookings move to ${chairWho(dest)}. Staff login for this chair is deleted.`,
      { confirm: 'Remove', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/shops/chairs/${id}?to=${dest.id}`, { token, method: 'DELETE' });
      setChairEdit(null);
      setChairDropTo(null);
      setChairDropping(false);
      if (calChairId === id) setCalChairId(null);
      await Promise.all([loadShop(), loadAppts()]);
      pop.ok('Chair removed');
    } catch (e) {
      chairErr('Remove failed', e);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Tab, string> = {
    today: 'Calendar',
    customers: 'Clients',
    services: 'Services',
    more: 'Salon',
  };

  if (viewClientId && token && shop?.id) {
    return (
      <AppShell>
        <ClientPage
          token={token}
          shopId={shop.id}
          customerId={viewClientId}
          defaultFollow={shop?.followUpDays ?? 45}
          chairs={listedChairs}
          onBack={() => setViewClientId(null)}
          onChanged={() => {
            loadCustomers().catch(() => undefined);
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      footer={
        <BottomNav items={NAV} value={tab} onChange={(k) => goTab(k as Tab)} />
      }
    >
      <Header title={titles[tab]} />
      <View className="relative flex-1">
      <ScrollBody fabPad={tab === 'today' || tab === 'customers' || tab === 'services'}>
        {tab === 'today' ? (
          <>
            <DayOverviewGrid
              booking={{
                value: dayStats.booked,
                lines: [
                  { label: 'Done', value: dayStats.done, tone: 'success' },
                  { label: 'Up next', value: dayStats.booked, tone: 'primary' },
                  { label: 'Missed', value: dayStats.missed, tone: 'warning' },
                ],
              }}
              revenue={{
                value: rupees(dayStats.revenue),
                lines: dayStats.lines,
              }}
              footer={[
                { label: 'Clients', value: customers.filter((c) => c.isActive !== false).length },
                { label: 'Services', value: visibleServices.filter((s) => s.isActive !== false).length },
              ]}
            />
            <BarberDayBoard
              date={calDate}
              appointments={appts}
              chairs={boardChairs}
              chairId={calChairId}
              youChairId={selfChairId}
              onChair={setCalChairId}
              hours={shopHours({ openHour, closeHour, closedWeekdays: closedDays })}
              onDate={setCalDate}
              onPeekMonth={setPeekMonth}
              historyAppts={histAppts}
              historyMore={histMore}
              historyBusy={histBusy}
              onHistoryMore={() => loadHistoryChunk(false).catch((e) => pop.err('History', e))}
              onViewChange={(v) => {
                const next = v === 'history';
                if (next === histOpen.current) return;
                histOpen.current = next;
                if (next) {
                  histCursor.current = null;
                  setHistAppts([]);
                  setHistMore(false);
                  loadHistoryChunk(true).catch((e) => pop.err('History', e));
                } else loadAppts().catch((e) => pop.err('Calendar', e));
              }}
              onBookAt={(time) => {
                if (isPastDay(calDate) || isPastSlot(calDate, time)) {
                  pop.info('Past time', 'Pick a future slot.');
                  return;
                }
                primeBook(calDate, time);
              }}
              onOpen={(a) => {
                setPicked(a);
                setEditDate(ymd(new Date(a.startAt)));
                setEditTime(hhmm(a.startAt));
                const start = new Date(a.startAt);
                const end = new Date(a.endAt);
                setEditMins(Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000)));
                setSheet('appt');
              }}
            />
          </>
        ) : null}

        {tab === 'customers' ? (
          <>
            <Section title={`${customers.length} clients`}>
              {customers.length === 0 ? (
                <EmptyState title="None yet" body="Add walk-in or regulars here." />
              ) : (
                customers.map((c) => (
                  <ListRow
                    key={c.id}
                    title={c.name}
                    subtitle={[
                      c.isActive === false ? 'Disabled' : null,
                      c.phone,
                      c.isActive === false
                        ? null
                        : `remind ${c.followUpDays ?? shop?.followUpDays ?? 45}d`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={c.loyaltyPoints ? `${c.loyaltyPoints} pts` : undefined}
                    onPress={() => setViewClientId(c.id)}
                    trailing={
                      <Switch
                        checked={c.isActive !== false}
                        onCheckedChange={() => toggleCustomerActive(c)}
                        accessibilityLabel={`${c.name} active`}
                      />
                    }
                  />
                ))
              )}
            </Section>
          </>
        ) : null}

        {tab === 'services' ? (
          <>
            <Section title={`${isStaff ? visibleServices.length : services.length} services`}>
              {visibleServices.length === 0 ? (
                <EmptyState title="None yet" body="Haircut, beard, color…" />
              ) : (
                visibleServices.map((s) => (
                  <ListRow
                    key={s.id}
                    title={s.name}
                    subtitle={[
                      s.isActive === false ? 'Disabled' : null,
                      `${s.durationMinutes} min`,
                      s.chairIds?.length
                        ? s.chairIds
                            .map((id: number) => chairLabel(chairs.find((c: any) => c.id === id) ?? { id, name: 'Staff' }))
                            .join(', ')
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={`₹${s.price}`}
                    onPress={isAdmin ? () => openService(s) : undefined}
                    trailing={
                      isAdmin ? (
                        <Switch
                          checked={s.isActive !== false}
                          onCheckedChange={() => toggleServiceActive(s)}
                          accessibilityLabel={`${s.name} on book list`}
                        />
                      ) : undefined
                    }
                  />
                ))
              )}
            </Section>
          </>
        ) : null}

        {tab === 'more' && isStaff ? (
          <>
            <Section title={myChair?.name ?? 'Your chair'}>
              <Text className="text-[13px] text-muted">
                {user?.name}
                {user?.phone ? ` · ${user.phone}` : ''}
              </Text>
              <Text className="mt-sm text-[13px] text-muted">Login with this phone + password.</Text>
            </Section>
            <AppearanceSettings />
            <Btn label="Sign out" variant="ghost" icon={LogOut} onPress={logout} />
          </>
        ) : null}

        {tab === 'more' && !isStaff ? (
          <>
            <Form form={shopForm}>
              <FormField
                control={shopForm.control}
                name="name"
                label="Salon name"
                placeholder="Salon name"
                maxLength={80}
              />
              <FormField
                control={shopForm.control}
                name="phone"
                label="Phone"
                placeholder="9876543210"
                kind="digits"
                maxLength={15}
              />
              <Section
                title="Location"
                help={{
                  title: 'Copy salon location',
                  body: '1. Tap Open Maps.\n2. Search your salon or drop a pin.\n3. Share → Copy link.\n4. Paste that link in the box.',
                }}
                action={
                  <Pressable
                    onPress={() => {
                      const url =
                        shopMapsUrl.trim() ||
                        'https://www.google.com/maps';
                      Linking.openURL(url.startsWith('http') ? url : `https://${url}`).catch((e) =>
                        pop.err('Could not open Maps', e),
                      );
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-[12px] font-semibold text-primary">Open Maps</Text>
                  </Pressable>
                }
              >
                <FormField
                  control={shopForm.control}
                  name="mapsUrl"
                  label="Maps link"
                  hideLabel
                  placeholder="Paste Maps link here"
                  maxLength={500}
                />
              </Section>
              <Section
                title="Hours"
                help={{
                  title: 'Hours',
                  body: 'Open = first bookable hour. Close = last hour on board. Last slot is 30m before close.',
                }}
              >
                <View className="flex-row gap-md">
                  <HourStepper
                    label="Open"
                    value={shopOpen}
                    min={6}
                    max={16}
                    onChange={(h) => {
                      shopForm.setValue('openHour', h, { shouldDirty: true });
                      if (shopClose <= h) shopForm.setValue('closeHour', h + 1, { shouldDirty: true });
                    }}
                  />
                  <HourStepper
                    label="Close"
                    value={shopClose}
                    min={shopOpen + 1}
                    max={23}
                    onChange={(h) => shopForm.setValue('closeHour', h, { shouldDirty: true })}
                  />
                </View>
                {shopForm.formState.errors.closeHour ? (
                  <Text className="mt-xs text-[12px] font-semibold text-danger">
                    {shopForm.formState.errors.closeHour.message}
                  </Text>
                ) : null}
              </Section>
              <Section
                title="Days off"
                help={{
                  title: 'Weekly off',
                  body: 'Tap a weekday to close every week. One-off holidays come later.',
                }}
              >
                <View className="flex-row flex-wrap">
                  {WEEK.map((w) => (
                    <Chip
                      key={w.d}
                      label={w.l}
                      selected={shopOff.includes(w.d)}
                      onPress={() =>
                        shopForm.setValue(
                          'closedWeekdays',
                          shopOff.includes(w.d) ? shopOff.filter((x) => x !== w.d) : [...shopOff, w.d].sort(),
                          { shouldDirty: true },
                        )
                      }
                    />
                  ))}
                </View>
              </Section>
              <Section
                title="Staffs / Seats"
                help={{
                  title: 'Staffs / Seats',
                  body: 'Your seat first. Owner seat is locked. Extra chairs can get a staff login. Max 5.',
                }}
                action={
                  chairs.length < 5 ? (
                    <Pressable onPress={addChair} hitSlop={8}>
                      <Text className="text-[12px] font-semibold text-primary">Add</Text>
                    </Pressable>
                  ) : (
                    <Text className="text-[12px] font-semibold text-muted">Max 5</Text>
                  )
                }
              >
                {chairs.length > 1 ? (
                  <View className="flex-row flex-wrap justify-between">
                    {listedChairs.map((c: any) => {
                      const ownerSeat = ownerChair && c.id === ownerChair.id;
                      const selfSeat = !isShopOwner && !!myChair && c.id === myChair.id;
                      const title = chairLabel(c);
                      const sub = [
                        ownerSeat ? 'Owner' : selfSeat ? 'You' : title !== c.name ? c.name : null,
                        !ownerSeat && c.canAdmin ? 'Admin' : null,
                        (c.upcoming ?? 0) > 0 ? upcomingLabel(c.upcoming) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <Pressable
                          key={c.id}
                          className="mb-sm w-[48%] rounded-md border border-border bg-surface p-md"
                          onPress={() => {
                            setChairDropTo(null);
                            setChairDropping(false);
                            setChairEdit({
                              id: c.id,
                              name: c.name,
                              assignStaff: ownerSeat || selfSeat ? false : !!c.staff,
                              staffName: c.staff?.name ?? '',
                              staffPhone: String(c.staff?.phone ?? '').replace(/\D/g, ''),
                              staffPassword: '',
                              hasStaff: !!c.staff,
                              canAdmin: !!c.canAdmin,
                              isOwner: !!ownerSeat,
                            });
                          }}
                        >
                          <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                            {title}
                          </Text>
                          {sub ? (
                            <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
                              {sub}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Section>
              <Section
                title="Loyalty"
                help={{
                  title: 'Points',
                  body: 'Done visit = +10 pts. Back before the window below = +20 streak. Window resets after each visit.',
                }}
              >
                <ChipRow
                  suffix="d"
                  value={shopFollow}
                  onPick={(n) => shopForm.setValue('followUpDays', n, { shouldDirty: true })}
                />
              </Section>
              <FormSubmit label="Save" onValid={saveShop} busy={busy} />
            </Form>

            <Section title="WhatsApp">
              <WhatsAppCard
                wa={wa}
                busy={waBusy}
                onConnect={connectWa}
                onDisconnect={disconnectWa}
                onTest={testWa}
              />
            </Section>

            <AppearanceSettings />
            <Btn label="Sign out" variant="ghost" icon={LogOut} onPress={logout} />
          </>
        ) : null}
      </ScrollBody>
      {tab === 'today' ? (
        <Fab
          label="Book"
          icon={Plus}
          onPress={() => {
            if (isPastDay(calDate)) {
              pop.info('Past day', 'Pick today or a future day.');
              return;
            }
            if (isClosedDay(calDate, closedDays)) {
              pop.info('Closed', 'That weekday is a weekly off.');
              return;
            }
            const t = nextHalfHour();
            if (isPastSlot(calDate, t) && calDate === ymd()) {
              pop.info('No times left', 'Today is done. Pick tomorrow.');
              return;
            }
            primeBook(calDate, t);
          }}
        />
      ) : null}
      {tab === 'customers' ? (
        <Fab
          label="Add client"
          icon={Plus}
          onPress={() => {
            clientForm.reset({
              name: '',
              phone: '',
              sendWelcome: true,
              followUpDays: shop?.followUpDays ?? 45,
              preferredChairId: null,
            });
            setSheet('customer');
          }}
        />
      ) : null}
      {tab === 'services' && isAdmin ? <Fab label="Add service" icon={Plus} onPress={() => openService()} /> : null}
      </View>

      <BottomSheet open={sheet === 'customer'} title="Add client" onClose={() => setSheet(null)}>
        <Form form={clientForm}>
          <FormField control={clientForm.control} name="name" label="Name" placeholder="Name" maxLength={80} />
          <FormField
            control={clientForm.control}
            name="phone"
            label="Phone"
            placeholder="9876543210"
            kind="digits"
            maxLength={15}
          />
          <CheckRow
            label="Welcome WhatsApp"
            body={wa?.status === 'CONNECTED' ? 'Sends after save' : 'Connect WhatsApp in Salon first'}
            checked={sendWelcome}
            onToggle={() => clientForm.setValue('sendWelcome', !sendWelcome, { shouldDirty: true })}
          />
          <ChairChips
            chairs={listedChairs}
            value={preferChair}
            onPick={(id) => clientForm.setValue('preferredChairId', id, { shouldDirty: true })}
            allowAny
            title="Preferred staff"
          />
          <Section title="Remind after">
            <ChipRow
              suffix="d"
              value={cFollowDays}
              onPick={(n) => clientForm.setValue('followUpDays', n, { shouldDirty: true })}
            />
          </Section>
          <FormSubmit
            label={sendWelcome ? 'Save + send welcome' : 'Save without WhatsApp'}
            inset
            busy={busy}
            onValid={addCustomer}
          />
        </Form>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'service'}
        title={editServiceId ? 'Edit service' : 'Add service'}
        onClose={() => {
          setSheet(null);
          setEditServiceId(null);
          setServiceStaffOpen(false);
        }}
      >
        <Form form={serviceForm}>
          <FormField control={serviceForm.control} name="name" label="Name" placeholder="Haircut" maxLength={80} />
          <FormField
            control={serviceForm.control}
            name="mins"
            label="Minutes"
            kind="digits"
            maxLength={3}
            placeholder="60"
          />
          <FormField
            control={serviceForm.control}
            name="price"
            label="Price (₹)"
            kind="decimal"
            maxLength={9}
            placeholder="250"
          />
          {chairs.length > 1 ? (
            <>
              <View className="mb-sm flex-row items-center">
                <Pressable className="flex-1 py-sm" onPress={() => setServiceStaffOpen((v) => !v)}>
                  <Text className="text-[14px] font-semibold text-primary">
                    {serviceChairIds.length
                      ? `Staff · ${serviceChairIds
                          .map((id) => chairLabel(chairs.find((c: any) => c.id === id) ?? { id, name: 'Staff' }))
                          .join(', ')}`
                      : 'Staff (optional)'}
                  </Text>
                </Pressable>
                <HelpTrigger
                  title="Staff"
                  body="Leave blank = any staff can offer this. Pick names to lock it (manicure, color…)."
                />
              </View>
              {serviceStaffOpen ? (
                <View className="mb-md flex-row flex-wrap">
                  {listedChairs.map((c: any) => (
                    <Chip
                      key={c.id}
                      label={chairLabel(c)}
                      selected={serviceChairIds.includes(c.id)}
                      onPress={() =>
                        setServiceChairIds((ids) =>
                          ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                        )
                      }
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
          <PairCtas
            hint={
              editingService?.hasHistory
                ? "Can't delete — this service is on past bookings. Disable to hide it from new books."
                : undefined
            }
            left={
              editingService ? (
                editingService.hasHistory ? (
                  <Btn
                    label={editingService.isActive === false ? 'Enable' : 'Disable'}
                    variant="secondary"
                    inset
                    busy={busy}
                    onPress={() => setServiceOn(editingService.isActive === false)}
                  />
                ) : (
                  <Btn label="Delete" variant="danger" inset busy={busy} onPress={dropService} />
                )
              ) : undefined
            }
            right={
              <FormSubmit
                label={editServiceId ? 'Save' : 'Save service'}
                inset
                busy={busy}
                onValid={saveService}
              />
            }
          />
        </Form>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'book'}
        title="Book"
        subtitle={formatDay(bookDate)}
        onClose={() => setSheet(null)}
        expand="full"
      >
        <BookSheetBody
          customers={customers}
          services={services}
          customerId={bookCustomer?.id ?? null}
          serviceId={bookService?.id ?? null}
          date={bookDate}
          time={bookTime}
          mins={bookMins}
          chairs={boardChairs}
          chairId={bookChairId}
          onChair={(id) => {
            setBookChairId(id);
            if (bookService && !serviceFits(bookService, id)) setBookService(null);
          }}
          onCustomer={(id) => {
            const c = customers.find((x) => x.id === id) ?? null;
            setBookCustomer(c);
            if (
              c?.preferredChairId &&
              (!bookService || serviceFits(bookService, c.preferredChairId))
            ) {
              setBookChairId(c.preferredChairId);
            }
          }}
          onService={(id) => {
            const s = services.find((x) => x.id === id);
            if (!s) return;
            setBookService(s);
            setBookMins(s.durationMinutes || 60);
            if (bookChairId != null && !serviceFits(s, bookChairId)) setBookChairId(null);
          }}
          onDate={(d) => {
            setBookDate(d);
            setCalDate(d);
          }}
          taken={bookTaken}
          onTime={setBookTime}
          onMins={setBookMins}
          busy={busy}
          onConfirm={book}
          shop={{ openHour, closeHour, closedWeekdays: closedDays }}
        />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'appt'}
        title={picked ? `${picked.customer?.name}` : 'Appointment'}
        onClose={() => {
          setSheet(null);
          setPicked(null);
        }}
      >
        {picked ? (
          <ApptSheetBody
            customers={customers}
            customerId={picked.customerId}
            chairs={boardChairs}
            chairId={picked.chairId ?? null}
            onChair={(id) => setPicked({ ...picked, chairId: id })}
            onCustomer={(id) => {
              const c = customers.find((x) => x.id === id);
              if (c) setPicked({ ...picked, customerId: c.id, customer: c });
            }}
            customer={{
              name: picked.customer?.name ?? 'Client',
              phone: picked.customer?.phone ?? '',
            }}
            serviceName={picked.service?.name ?? ''}
            status={picked.status}
            services={services}
            serviceId={picked.serviceId}
            date={editDate}
            time={editTime}
            mins={editMins}
            onService={(id) => {
              const s = services.find((x) => x.id === id);
              if (!s) return;
              const next: any = { ...picked, serviceId: s.id, service: s };
              if (!serviceFits(s, picked.chairId)) {
                const first = chairsForService(boardChairs, s)[0];
                if (first) next.chairId = first.id;
              }
              setPicked(next);
              setEditMins(s.durationMinutes || editMins);
            }}
            onDate={(d) => {
              setEditDate(d);
              setCalDate(d);
            }}
            taken={editTaken}
            onTime={setEditTime}
            onMins={setEditMins}
            busy={busy}
            onSave={saveApptEdits}
            onStatus={setApptStatus}
            shop={{ openHour, closeHour, closedWeekdays: closedDays }}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={!!chairEdit}
        title={
          chairEdit?.id == null
            ? 'Add chair'
            : chairEdit.id === ownerChair?.id
              ? isShopOwner
                ? 'Your chair'
                : 'Owner chair'
              : myChair && chairEdit.id === myChair.id
                ? 'Your chair'
                : 'Chair'
        }
        onClose={() => {
          setChairEdit(null);
          setChairDropTo(null);
          setChairDropping(false);
        }}
      >
        {chairEdit ? (
          <ChairForm
            key={`${chairEdit.id ?? 'new'}-${chairEdit.hasStaff}`}
            initial={chairEdit}
            upcoming={editUpcoming}
            chairs={listedChairs}
            ownerId={ownerChair?.id}
            isSelf={!isShopOwner && !!myChair && chairEdit.id === myChair.id}
            dropTo={chairDropTo}
            dropping={chairDropping}
            busy={busy}
            onDropTo={setChairDropTo}
            onDropping={setChairDropping}
            onSave={saveChair}
            onRemove={dropChair}
          />
        ) : null}
      </BottomSheet>

      <WhatsAppSignup
        ticket={waTicket}
        oauthUrl={waOauthUrl}
        onDone={finishWa}
        onCancel={() => {
          setWaTicket(null);
          setWaOauthUrl(null);
        }}
      />
    </AppShell>
  );
}
