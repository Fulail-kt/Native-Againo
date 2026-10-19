import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { GifThumb } from '../../components/GifThumb';
import { MonthCalendar, type CalDay } from '../../components/MonthCalendar';
import { StreakHeatmap } from '../../components/StreakHeatmap';
import { SwipeCompleteRow } from '../../components/SwipeCompleteRow';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { pop } from '../../pop';
import { Form, FormField, FormSubmit, useAppForm } from '../../form';
import { logSetsSchema, type LogSetsValues } from '../../schemas';
import { WEEKDAY_LABELS } from '../../days';
import {
  Calendar,
  ChevronRight,
  CircleCheck,
  Dumbbell,
  LogOut,
  MapPin,
  Plus,
  Trash,
  User,
} from '../../icons';
import { colors } from '../../theme';
import {
  AppShell,
  BackHeader,
  BottomNav,
  Btn,
  Card,
  Chip,
  EmptyState,
  Field,
  Header,
  ListRow,
  ScrollBody,
  Section,
  Segmented,
  AppearanceSettings,
} from '../../ui';

type Tab = 'today' | 'calendar' | 'checkin' | 'profile';

const MEMBER_NAV = [
  { key: 'today', label: 'Home', Icon: Dumbbell },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'checkin', label: 'Check-in', Icon: MapPin },
  { key: 'profile', label: 'Profile', Icon: User },
];

const QUOTES = [
  'Motion is lotion. A little today beats none.',
  'Strong body, clear mind. Show up.',
  'You do not need a perfect day. You need this set.',
  'Rest is part of training. So is the next rep.',
  'Consistency beats intensity you cannot repeat.',
  'Drink water. Breathe. Then lift.',
  'The work you skip today still waits tomorrow.',
];

function greetName(name?: string) {
  const h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0] || 'there';
  return `${hi}, ${first}`;
}

function quoteOfDay() {
  return QUOTES[new Date().getDate() % QUOTES.length];
}

function extraGroups(extras: any[] = []) {
  const map = new Map<number, { exercise: any; sets: any[] }>();
  for (const e of extras) {
    const cur = map.get(e.exerciseId) ?? { exercise: e.exercise, sets: [] };
    cur.sets.push(e);
    map.set(e.exerciseId, cur);
  }
  return [...map.values()];
}

function extraSetCount(session: any, exerciseId: number) {
  return (session?.extras ?? []).filter((e: any) => e.exerciseId === exerciseId).length;
}

function nextExtraSet(session: any, exerciseId: number) {
  const nums = (session?.extras ?? [])
    .filter((e: any) => e.exerciseId === exerciseId)
    .map((e: any) => e.setNumber);
  if (!nums.length) return 1;
  return Math.max(...nums) + 1;
}

function loggedSets(session: any, itemId: number) {
  return (session?.sets ?? []).filter((s: any) => s.programmeExerciseId === itemId);
}

function loggedSetNums(session: any, itemId: number) {
  return new Set(loggedSets(session, itemId).map((s: any) => s.setNumber));
}

function draftsFor(item: any, session: any) {
  const logged = loggedSets(session, item.id);
  return Array.from({ length: item.sets }, (_, i) => {
    const n = i + 1;
    const hit = logged.find((s: any) => s.setNumber === n);
    return {
      n,
      weight: hit?.weightKg != null ? String(hit.weightKg) : '',
      reps: hit?.reps != null ? String(hit.reps) : item.reps != null ? String(item.reps) : '',
    };
  });
}

function LogSetForm({
  item,
  rows,
  session,
  busy,
  doneToday,
  onSave,
}: {
  item: any;
  rows: LogSetsValues['sets'];
  session: any;
  busy: boolean;
  doneToday: boolean;
  onSave: (sets: LogSetsValues['sets']) => void | Promise<void>;
}) {
  const form = useAppForm<LogSetsValues>(logSetsSchema, { sets: rows });
  const logged = loggedSetNums(session, item.id);
  const [tab, setTab] = useState(() => rows.find((d) => !logged.has(d.n))?.n ?? 1);
  const i = Math.max(0, tab - 1);
  return (
    <Form form={form}>
      <View className="mb-lg items-center">
        <GifThumb uri={item.exercise.imageUrl} size={140} />
      </View>
      <Segmented
        options={rows.map((d) => ({
          key: String(d.n),
          label: logged.has(d.n) ? `Set ${d.n} ✓` : `Set ${d.n}`,
        }))}
        value={String(tab)}
        onChange={(k) => setTab(Number(k))}
      />
      <View className="mb-sm flex-row gap-sm">
        <FormField
          tight
          control={form.control}
          name={`sets.${i}.weight`}
          label="Weight (kg)"
          placeholder="e.g. 60"
          kind="decimal"
          maxLength={7}
        />
        <FormField
          tight
          control={form.control}
          name={`sets.${i}.reps`}
          label="Reps"
          placeholder="e.g. 12"
          kind="digits"
          maxLength={3}
        />
      </View>
      {doneToday ? null : (
        <FormSubmit
          label="Done"
          icon={CircleCheck}
          onValid={(v) => onSave(v.sets)}
          busy={busy}
        />
      )}
    </Form>
  );
}

export function MemberApp() {
  const { token, user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [dayOpen, setDayOpen] = useState(false);
  const [today, setToday] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [cal, setCal] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [pickedDay, setPickedDay] = useState<CalDay | null>(null);
  const [calPane, setCalPane] = useState<'month' | 'history'>('month');
  const [exercises, setExercises] = useState<any[]>([]);
  const [extraSheet, setExtraSheet] = useState(false);
  const [extraQ, setExtraQ] = useState('');
  const [activeExerciseId, setActiveExerciseId] = useState<number | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const items = useMemo(
    () => session?.day?.items ?? today?.day?.items ?? [],
    [session, today],
  );

  const loadToday = useCallback(async () => {
    const data = await api('/workouts/today', { token });
    setToday(data);
    setSession(data.session);
  }, [token]);

  const loadCalendar = useCallback(async () => {
    const data = await api(`/workouts/calendar?year=${calYear}&month=${calMonth}`, { token });
    setCal(data);
  }, [token, calYear, calMonth]);

  const loadStreak = useCallback(async () => {
    setStreak(await api('/workouts/streak', { token }));
  }, [token]);

  const loadNews = useCallback(async () => {
    setNews(await api('/announcements', { token }));
  }, [token]);

  const loadHistory = useCallback(async () => {
    setHistory(await api('/workouts/history', { token }));
  }, [token]);

  useEffect(() => {
    loadToday().catch((e) => pop.err('Today', e));
  }, [loadToday]);

  useEffect(() => {
    if (tab === 'calendar') {
      loadCalendar().catch((e) => pop.err('Calendar', e));
      loadStreak().catch(() => undefined);
      loadHistory().catch((e) => pop.err('History', e));
    }
    if (tab === 'today' || tab === 'profile') {
      loadNews().catch((e) => pop.err('News', e));
    }
    if (tab === 'profile') {
      loadStreak().catch(() => undefined);
    }
  }, [tab, loadCalendar, loadStreak, loadNews, loadHistory]);

  function goHome() {
    setDayOpen(false);
    setActiveExerciseId(null);
  }

  async function openTodayTask() {
    if (!today?.day || !today.gymOpen || today.programmeDone) return;
    setBusy(true);
    try {
      if (!session) {
        const data = await api('/workouts/start', {
          token,
          method: 'POST',
          body: { dayId: today.day.id },
        });
        setSession(data);
        await loadToday();
      }
      setDayOpen(true);
    } catch (e) {
      pop.err('Start failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function postSets(
    item: any,
    rows: { n: number; weight: string; reps: string }[],
  ) {
    if (!session) return;
    for (const d of rows) {
      await api(`/workouts/${session.id}/sets`, {
        token,
        method: 'POST',
        body: {
          programmeExerciseId: item.id,
          setNumber: d.n,
          weightKg: d.weight && Number(d.weight) >= 0 ? Number(d.weight) : undefined,
          reps:
            d.reps && Number.isInteger(Number(d.reps)) && Number(d.reps) >= 0 && Number(d.reps) <= 100
              ? Number(d.reps)
              : undefined,
        },
      });
    }
    await loadToday();
  }

  async function saveSets(sets: LogSetsValues['sets']) {
    if (!activeItem) return;
    setBusy(true);
    try {
      await postSets(activeItem, sets);
      setActiveExerciseId(null);
    } catch (e) {
      pop.err('Set failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function swipeComplete(item: any) {
    if (!session || today?.doneToday) return;
    const done = loggedSetNums(session, item.id);
    if (done.size >= item.sets) return;
    setBusy(true);
    try {
      await postSets(item, draftsFor(item, session));
    } catch (e) {
      pop.err('Set failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function swipeReopen(item: any) {
    if (!session || today?.doneToday) return;
    setBusy(true);
    try {
      await api(`/workouts/${session.id}/clear-sets`, {
        token,
        method: 'POST',
        body: { programmeExerciseId: item.id },
      });
      await loadToday();
    } catch (e) {
      pop.err('Couldn’t reopen', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!session) return;
    if (!allSetsDone) {
      pop.info('Finish sets first', 'Tick every prescribed set, then submit the task.');
      return;
    }
    setBusy(true);
    try {
      await api(`/workouts/${session.id}/complete`, { token, method: 'POST' });
      pop.ok('Task done', 'Today’s workout is locked.');
      await loadToday();
      loadStreak().catch(() => undefined);
      loadHistory().catch(() => undefined);
      goHome();
    } catch (e) {
      pop.err('Complete failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function openExtras() {
    try {
      const list = await api('/exercises', { token });
      setExercises(list);
      setExtraQ('');
      setExtraSheet(true);
    } catch (e) {
      pop.err('Library', e);
    }
  }

  async function addExtra(exercise: any) {
    if (!session) return;
    const setNumber = nextExtraSet(session, exercise.id);
    setBusy(true);
    try {
      await api(`/workouts/${session.id}/extras`, {
        token,
        method: 'POST',
        body: { exerciseId: exercise.id, setNumber },
      });
      await loadToday();
      pop.ok('Extra added', `${exercise.name} · set ${setNumber}`);
    } catch (e) {
      pop.err('Extra failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function removeExtra(exerciseId: number, name: string) {
    if (!session) return;
    const ok = await pop.ask('Remove extra?', `${name} — all sets today will be removed.`);
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/workouts/${session.id}/extras/${exerciseId}`, {
        token,
        method: 'DELETE',
      });
      await loadToday();
      pop.ok('Removed', name);
    } catch (e) {
      pop.err('Remove failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function checkIn() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        pop.info('Location needed', 'Allow location to check in at the gym.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      await api('/attendance/check-in', {
        token,
        method: 'POST',
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });
      pop.ok('Checked in', 'Attendance recorded for today.');
      await loadToday();
    } catch (e) {
      pop.err('Check-in failed', e);
    } finally {
      setBusy(false);
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(calYear, calMonth - 1 + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth() + 1);
    setPickedDay(null);
  }

  function openExercise(item: any) {
    setActiveExerciseId(item.id);
  }

  const activeItem = items.find((i: any) => i.id === activeExerciseId);
  const extras = useMemo(() => extraGroups(session?.extras), [session?.extras]);
  const extraRows = useMemo(() => {
    const q = extraQ.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) =>
      `${e.name} ${e.muscleGroup ?? ''} ${e.description ?? ''}`.toLowerCase().includes(q),
    );
  }, [exercises, extraQ]);
  const allSetsDone = items.length > 0 && items.every((item: any) => loggedSetNums(session, item.id).size >= item.sets);
  const monthTitle = new Date(calYear, calMonth - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const tabTitles: Record<Tab, string> = {
    today: 'Home',
    calendar: 'Calendar',
    checkin: 'Check-in',
    profile: 'Profile',
  };

  return (
    <AppShell
      footer={
        <BottomNav
          items={MEMBER_NAV}
          value={tab}
          onChange={(k) => {
            const next = k as Tab;
            setTab(next);
            if (next === 'today') goHome();
          }}
        />
      }
    >
      {tab === 'today' && dayOpen ? (
        <BackHeader
          title={today?.day?.name ?? 'Today'}
          subtitle={today?.programme?.name}
          onBack={goHome}
        />
      ) : tab !== 'today' ? (
        <Header title={tabTitles[tab]} />
      ) : null}

      <ScrollBody>
        {tab === 'today' && !dayOpen ? (
          <>
            <Text className="mb-sm text-[26px] font-bold text-ink">{greetName(user?.name)}</Text>
            <Text className="mb-xl text-[15px] italic leading-[22px] text-muted">{quoteOfDay()}</Text>

            <Section title="Today">
              {!today ? (
                <EmptyState title="Loading" body="Fetching today’s task." />
              ) : !today.gymOpen ? (
                <EmptyState
                  title={`Gym closed ${WEEKDAY_LABELS[today.weekday ?? 0]}`}
                  body={
                    today.nextOpenDate
                      ? `Next open day ${today.nextOpenDate}.`
                      : 'Admin has no open days set.'
                  }
                />
              ) : today.programmeDone ? (
                <EmptyState
                  title={`${today.programme?.name ?? 'Programme'} finished`}
                  body="Ask admin to assign the next programme."
                />
              ) : !today.day ? (
                <EmptyState
                  title="No task today"
                  body="Ask gym admin to assign a programme."
                />
              ) : (
                <Pressable
                  onPress={openTodayTask}
                  disabled={busy}
                  className={`flex-row items-center gap-md rounded-lg border-2 bg-surface2 p-lg ${today.doneToday ? 'border-success' : 'border-primary'}`}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="mb-xs text-[12px] font-bold uppercase tracking-[0.6px] text-primary">{today.doneToday ? 'Done' : 'Today’s task'}</Text>
                    <Text className="text-[20px] font-bold text-ink">{today.day.name}</Text>
                    <Text className="mt-xs text-[13px] text-muted">
                      {today.programme?.name ?? 'Programme'} · {items.length} exercise
                      {items.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <ChevronRight size={22} color={colors.primary} />
                </Pressable>
              )}
            </Section>

            {news[0] ? (
              <Card title={news[0].title} body={news[0].body} badge="News" />
            ) : null}
          </>
        ) : null}

        {tab === 'today' && dayOpen ? (
          <>
            {today?.doneToday ? (
              <Card title="Task submitted" body="Today is locked. Extras still ok." badge="Done" />
            ) : (
              <Btn
                label="Submit task completed"
                icon={CircleCheck}
                onPress={complete}
                busy={busy}
                disabled={!allSetsDone}
              />
            )}

            <Section title="Exercises">
              {items.map((item: any) => {
                const done = loggedSetNums(session, item.id);
                const complete = done.size >= item.sets;
                return (
                  <SwipeCompleteRow
                    key={item.id}
                    canComplete={!today?.doneToday && !complete && !!session}
                    canReopen={!today?.doneToday && complete && !!session}
                    onComplete={() => swipeComplete(item)}
                    onReopen={() => swipeReopen(item)}
                    onPress={() => openExercise(item)}
                  >
                    <View className="flex-row items-center gap-md border border-border p-md">
                      <GifThumb uri={item.exercise?.imageUrl} size={56} />
                      <View className="min-w-0 flex-1">
                        <Text className="text-[16px] font-semibold text-ink">{item.exercise?.name}</Text>
                        <Text className="mt-0.5 text-[13px] text-muted">
                          {item.sets}×{item.reps ?? '—'}
                          {item.restSeconds ? `  (${item.restSeconds}s rest)` : ''}
                          {`  ·  ${done.size}/${item.sets}`}
                        </Text>
                      </View>
                      {complete ? (
                        <CircleCheck size={22} color={colors.success} />
                      ) : (
                        <ChevronRight size={20} color={colors.muted} />
                      )}
                    </View>
                  </SwipeCompleteRow>
                );
              })}
            </Section>

            {session ? (
              <Section title="Extras">
                {extras.length === 0 ? (
                  <EmptyState title="None yet" body="Optional extra work. Does not change the programme." />
                ) : (
                  extras.map((g) => (
                    <View key={g.exercise.id} className="mb-sm flex-row items-center gap-md rounded-md border border-border bg-surface p-md">
                      <GifThumb uri={g.exercise.imageUrl} size={48} />
                      <View className="min-w-0 flex-1">
                        <Text className="text-[16px] font-semibold text-ink" numberOfLines={1}>
                          {g.exercise.name}
                        </Text>
                        <Text className="mt-0.5 text-[13px] text-muted">{g.sets.length} extra set(s)</Text>
                      </View>
                      <Pressable
                        className="h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface2"
                        onPress={() => removeExtra(g.exercise.id, g.exercise.name)}
                        hitSlop={8}
                      >
                        <Trash size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))
                )}
                <Btn label="Add extra" icon={Plus} variant="secondary" onPress={openExtras} />
              </Section>
            ) : null}
          </>
        ) : null}

        {tab === 'calendar' ? (
          <>
            {streak ? (
              <Text className="mb-md text-[13px] font-semibold text-muted">
                {streak.current} day streak · best {streak.best}
              </Text>
            ) : null}
            <Segmented
              options={[
                { key: 'month', label: 'Month' },
                { key: 'history', label: 'History' },
              ]}
              value={calPane}
              onChange={(k) => setCalPane(k as 'month' | 'history')}
            />
            {calPane === 'month' ? (
              <>
                {cal ? (
                  <MonthCalendar
                    title={monthTitle}
                    days={cal.days}
                    selected={pickedDay?.date}
                    onSelect={setPickedDay}
                    onPrev={() => shiftMonth(-1)}
                    onNext={() => shiftMonth(1)}
                  />
                ) : null}
                {pickedDay?.inMonth ? (
                  <Section title={pickedDay.date}>
                    <Card
                      title={pickedDay.gymOpen ? 'Gym open' : 'Gym closed'}
                      body={[
                        pickedDay.checkedIn ? 'Checked in' : 'No check-in',
                        pickedDay.workout
                          ? `${pickedDay.workout.name} · ${pickedDay.workout.status}${
                              pickedDay.workout.extraCount
                                ? ` · ${pickedDay.workout.extraCount} extras`
                                : ''
                            }`
                          : 'No workout logged',
                      ].join('\n')}
                    />
                  </Section>
                ) : null}
                <Section title="Coming up">
                  {(cal?.upcoming ?? []).length === 0 ? (
                    <EmptyState title="No upcoming days" body="Need an assigned programme + open gym days." />
                  ) : (
                    cal.upcoming.map((u: any) => (
                      <ListRow key={u.date} title={u.name} subtitle={u.date} />
                    ))
                  )}
                </Section>
              </>
            ) : (
              <Section title="Workouts">
                {history.length === 0 ? (
                  <EmptyState title="No workouts yet" body="Finished sessions show here." />
                ) : (
                  history.map((h) => (
                    <ListRow
                      key={h.id}
                      title={h.day?.name ?? 'Workout'}
                      subtitle={`${h.day?.programme?.name ?? 'Programme'} · ${h.dayKey}`}
                      right={`${h.sets?.length ?? 0} sets`}
                    />
                  ))
                )}
              </Section>
            )}
          </>
        ) : null}

        {tab === 'checkin' ? (
          <>
            {today?.checkedIn ? (
              <Card title="Already checked in" body="One attendance per day." badge="Done" />
            ) : !today?.gymOpen ? (
              <EmptyState title="Gym closed today" body="Check-in opens next gym day." />
            ) : (
              <Btn label="Check in now" icon={MapPin} onPress={checkIn} busy={busy} />
            )}
          </>
        ) : null}

        {tab === 'profile' ? (
          <>
            <Card title={user?.name ?? 'Member'} body={user?.email} badge={user?.role} />
            {streak ? (
              <StreakHeatmap cells={streak.cells} current={streak.current} best={streak.best} />
            ) : null}
            <Section title="Gym news">
              {news.length === 0 ? (
                <EmptyState title="No announcements" body="Admin posts show here." />
              ) : (
                news.map((n) => (
                  <Card key={n.id} title={n.title} body={n.body} badge={n.author?.name} />
                ))
              )}
            </Section>
            <AppearanceSettings />
            <Btn label="Log out" variant="danger" icon={LogOut} onPress={logout} />
          </>
        ) : null}
      </ScrollBody>

      <BottomSheet
        open={!!activeItem}
        title={activeItem?.exercise?.name ?? 'Exercise'}
        subtitle={
          activeItem
            ? `Target ${activeItem.sets}×${activeItem.reps ?? '—'} · ${activeItem.restSeconds ?? 0}s rest`
            : undefined
        }
        expand="auto"
        onClose={() => setActiveExerciseId(null)}
      >
        {activeItem ? (
          <LogSetForm
            key={activeItem.id}
            item={activeItem}
            rows={draftsFor(activeItem, session)}
            session={session}
            busy={busy}
            doneToday={!!today?.doneToday}
            onSave={saveSets}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={extraSheet}
        title="Add extra"
        subtitle="Tap a move — adds next set · today only"
        expand="full"
        fill
        onClose={() => setExtraSheet(false)}
      >
        <FlatList
          className="min-w-0 flex-1"
          data={extraRows}
          keyExtractor={(e) => String(e.id)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-lg pb-xxl"
          ListHeaderComponent={
            <View className="pb-sm">
              <Field
                tight
                hideLabel
                label="Search"
                placeholder="Search name or muscle"
                value={extraQ}
                onChangeText={setExtraQ}
              />
              <Text className="mt-1.5 text-[12px] font-semibold text-muted">
                {extraRows.length} move{extraRows.length === 1 ? '' : 's'} · tap to add set
              </Text>
            </View>
          }
          ListEmptyComponent={<EmptyState title="No matches" body="Try another search." />}
          renderItem={({ item: e }) => {
            const count = extraSetCount(session, e.id);
            return (
              <Pressable
                className="mb-sm flex-row items-center gap-md rounded-md border border-border bg-surface2 p-md"
                onPress={() => addExtra(e)}
                disabled={busy}
              >
                <GifThumb uri={e.imageUrl} size={52} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-bold leading-5 text-ink" numberOfLines={2}>
                    {e.name}
                  </Text>
                  <Text className="mt-[3px] text-[12px] text-muted" numberOfLines={1}>
                    {[e.muscleGroup, e.description].filter(Boolean).join(' · ') || 'Library'}
                  </Text>
                </View>
                <View className="min-w-[44px] items-end gap-0.5">
                  {count > 0 ? (
                    <Text className="text-[11px] font-bold text-primary">
                      {count} set{count === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                  <Plus size={20} color={colors.primary} />
                </View>
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </AppShell>
  );
}
