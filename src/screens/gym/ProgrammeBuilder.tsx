import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { GifThumb } from '../../components/GifThumb';
import { api } from '../../api';
import { pop } from '../../pop';
import { ChevronDown, ChevronRight, CircleCheck, GripVertical, Pencil, Plus, Trash, X } from '../../icons';
import { colors } from '../../theme';
import { digitsOnly } from '../../sanitize';
import { Form, FormField, FormSubmit, useAppForm } from '../../form';
import { programmeSchema, type ProgrammeValues } from '../../schemas';
import { Btn, Chip, EmptyState, Hint, ScrollBody, Section, Segmented } from '../../ui';

export const MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Glutes',
  'Calves',
  'Core',
  'Traps',
  'Other',
];

type DraftEx = {
  key: string;
  exerciseId: number;
  name: string;
  sets: string;
  reps: string;
  rest: string;
};

type DraftDay = { key: string; name: string; exercises: DraftEx[] };

export type ProgrammeDraft = {
  id?: number;
  name: string;
  mode: 'FIXED' | 'REPEAT';
  nextProgrammeId?: number | null;
  days: {
    name: string;
    items: {
      exercise?: { id: number; name: string };
      exerciseId?: number;
      sets: number;
      reps?: number;
      restSeconds?: number;
    }[];
  }[];
};

type UseErrors = { sets?: string; reps?: string; rest?: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function move<T>(list: T[], from: number, dir: -1 | 1) {
  const to = from + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function n(v: string) {
  return Number(v);
}

function validateUses(ex: DraftEx): UseErrors {
  const err: UseErrors = {};
  const sets = n(ex.sets);
  const reps = n(ex.reps);
  const rest = n(ex.rest);
  if (!ex.sets || !Number.isInteger(sets) || sets < 1 || sets > 50) err.sets = '1–50';
  if (!ex.reps || !Number.isInteger(reps) || reps < 1 || reps > 100) err.reps = '1–100';
  if (ex.rest === '' || !Number.isInteger(rest) || rest < 0 || rest > 600) err.rest = '0–600';
  return err;
}

function usesOk(err: UseErrors) {
  return !err.sets && !err.reps && !err.rest;
}

function clampUses(ex: DraftEx): DraftEx {
  return {
    ...ex,
    name: ex.name,
    exerciseId: ex.exerciseId,
    sets: String(Math.min(50, Math.max(1, n(ex.sets) || 1))),
    reps: String(Math.min(100, Math.max(1, n(ex.reps) || 1))),
    rest: String(Math.min(600, Math.max(0, Number.isFinite(n(ex.rest)) ? n(ex.rest) : 0))),
  };
}

function fromInitial(p?: ProgrammeDraft | null): DraftDay[] {
  if (!p?.days?.length) return [{ key: uid(), name: 'Day 1', exercises: [] }];
  return p.days.map((d, i) => ({
    key: uid(),
    name: d.name || `Day ${i + 1}`,
    exercises: (d.items ?? []).map((it) => ({
      key: uid(),
      exerciseId: it.exercise?.id ?? it.exerciseId ?? 0,
      name: it.exercise?.name ?? 'Exercise',
      sets: String(it.sets ?? 3),
      reps: String(it.reps ?? 10),
      rest: String(it.restSeconds ?? 60),
    })),
  }));
}

function DragHandle({ onMove }: { onMove: (dir: -1 | 1) => void }) {
  const cb = useRef(onMove);
  cb.current = onMove;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) cb.current(-1);
        else if (g.dy > 24) cb.current(1);
      },
    }),
  ).current;
  return (
    <View {...pan.panHandlers} className="h-12 w-8 items-center justify-center" accessibilityLabel="Reorder">
      <GripVertical size={18} color={colors.muted} />
    </View>
  );
}

function UseField({
  label,
  value,
  error,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  maxLength: number;
  onChange: (v: string) => void;
}) {
  return (
    <View className="min-w-0 flex-1">
      <Text className="mb-1.5 text-[12px] font-bold text-muted">{label}</Text>
      <TextInput
        className={`h-12 rounded-md border bg-surface p-0 text-center text-[18px] font-bold text-ink ${error ? 'border-danger' : 'border-primary'}`}
        value={value}
        onChangeText={(v) => onChange(digitsOnly(v))}
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={maxLength}
      />
      {error ? <Text className="mt-xs text-center text-[10px] font-semibold text-danger">{error}</Text> : null}
    </View>
  );
}

export function ProgrammeBuilder({
  token,
  exercises,
  programmes,
  initial,
  onSaved,
}: {
  token: string | null;
  exercises: any[];
  programmes: any[];
  initial?: ProgrammeDraft | null;
  onSaved: () => void;
}) {
  const seed = fromInitial(initial);
  const form = useAppForm<ProgrammeValues>(programmeSchema, {
    name: initial?.name ?? '',
    mode: initial?.mode ?? 'REPEAT',
    nextProgrammeId: initial?.nextProgrammeId ?? null,
    days: seed,
  });
  const days = form.watch('days');
  const mode = form.watch('mode');
  const nextId = form.watch('nextProgrammeId');
  const [openDay, setOpenDay] = useState(seed[seed.length - 1]?.key ?? '');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [errs, setErrs] = useState<UseErrors>({});
  const [pickDayKey, setPickDayKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editKeyRef = useRef<string | null>(null);

  function setDays(next: DraftDay[] | ((prev: DraftDay[]) => DraftDay[])) {
    const cur = form.getValues('days');
    form.setValue('days', typeof next === 'function' ? next(cur) : next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of exercises) {
      const g = e.muscleGroup || 'Other';
      map.set(g, [...(map.get(g) ?? []), e]);
    }
    return [...map.entries()];
  }, [exercises]);

  const nextChoices = programmes.filter((p) => p.id !== initial?.id);
  const lastDay = days[days.length - 1];
  const canAddDay = !!lastDay && lastDay.exercises.length > 0;

  function patchDay(key: string, patch: Partial<DraftDay>) {
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function patchEx(dayKey: string, exKey: string, field: 'sets' | 'reps' | 'rest', raw: string) {
    if (editKeyRef.current !== exKey) return;
    setDays((ds) =>
      ds.map((d) =>
        d.key !== dayKey
          ? d
          : {
              ...d,
              exercises: d.exercises.map((x) => (x.key === exKey ? { ...x, [field]: raw } : x)),
            },
      ),
    );
    setErrs((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function startEdit(exKey: string) {
    editKeyRef.current = exKey;
    setEditKey(exKey);
    setErrs({});
  }

  function finishEdit(dayKey: string, ex: DraftEx) {
    const next = clampUses(ex);
    const err = validateUses(next);
    if (!usesOk(err)) {
      setErrs(err);
      return;
    }
    editKeyRef.current = null;
    setDays((ds) =>
      ds.map((d) =>
        d.key !== dayKey
          ? d
          : { ...d, exercises: d.exercises.map((x) => (x.key === ex.key ? next : x)) },
      ),
    );
    setErrs({});
    setEditKey(null);
  }

  function addExerciseToDay(dayKey: string, ex: any) {
    const row: DraftEx = {
      key: uid(),
      exerciseId: ex.id,
      name: ex.name || 'Exercise',
      sets: String(ex.defaultSets ?? 3),
      reps: String(ex.defaultReps ?? 10),
      rest: String(ex.defaultRestSeconds ?? 60),
    };
    setDays((ds) => ds.map((d) => (d.key === dayKey ? { ...d, exercises: [...d.exercises, row] } : d)));
    setPickDayKey(null);
  }

  function addDay() {
    if (!canAddDay) {
      pop.info('Finish this day first', 'Add at least one exercise, then you can add the next day.');
      if (lastDay) setOpenDay(lastDay.key);
      return;
    }
    const key = uid();
    setDays((ds) => [...ds, { key, name: `Day ${ds.length + 1}`, exercises: [] }]);
    setOpenDay(key);
  }

  async function save(values: ProgrammeValues) {
    const closed = values.days.map((d) => ({
      ...d,
      exercises: d.exercises.map(clampUses),
    }));
    editKeyRef.current = null;
    setEditKey(null);
    const body = {
      name: values.name.trim(),
      mode: values.mode,
      nextProgrammeId: values.mode === 'FIXED' ? values.nextProgrammeId ?? undefined : undefined,
      days: closed.map((d, i) => ({
        name: d.name.trim() || `Day ${i + 1}`,
        order: i,
        exercises: d.exercises.map((e, j) => ({
          exerciseId: e.exerciseId,
          order: j,
          sets: n(e.sets),
          reps: n(e.reps),
          restSeconds: n(e.rest),
        })),
      })),
    };
    setBusy(true);
    try {
      if (initial?.id) {
        try {
          await api(`/programmes/${initial.id}`, { token, method: 'PUT', body });
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          if (!/history/i.test(msg)) throw e;
          await api(`/programmes/${initial.id}`, {
            token,
            method: 'PATCH',
            body: {
              name: values.name.trim(),
              mode: values.mode,
              nextProgrammeId: values.mode === 'FIXED' ? values.nextProgrammeId : null,
            },
          });
          pop.info(
            'Name and type saved',
            'Days stay locked — members already trained this programme. Create a new one to change exercises.',
          );
          onSaved();
          return;
        }
      } else {
        await api('/programmes', { token, method: 'POST', body });
      }
      onSaved();
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Form form={form}>
      <ScrollBody>
        <FormField
          control={form.control}
          name="name"
          label="Name"
          placeholder="e.g. Beginner · Push Pull Legs"
          maxLength={80}
        />

        <Section title="Type">
          <View className="flex-row items-center gap-xs">
            <View className="flex-1">
              <Segmented
                options={[
                  { key: 'FIXED', label: 'Once' },
                  { key: 'REPEAT', label: 'Repeat' },
                ]}
                value={mode}
                onChange={(k) => form.setValue('mode', k as 'FIXED' | 'REPEAT', { shouldDirty: true, shouldValidate: true })}
              />
            </View>
            <Hint
              title="Once vs Repeat"
              body="Once: last day finishes, programme stops. Optionally auto-start another.\n\nRepeat: after last day, Day 1 starts again on the next gym-open day."
            />
          </View>
          {mode === 'FIXED' ? (
            <View className="mt-sm">
              <View className="flex-row items-center gap-xs">
                <Text className="flex-1 text-[12px] font-bold text-muted">Then start</Text>
                <Hint
                  title="What happens next"
                  body="Leave Wait if you will assign the next programme yourself."
                />
              </View>
              <View className="flex-row flex-wrap">
                <Chip label="Wait" selected={nextId == null} onPress={() => form.setValue('nextProgrammeId', null, { shouldDirty: true, shouldValidate: true })} />
                {nextChoices.map((p) => (
                  <Chip key={p.id} label={p.name} selected={nextId === p.id} onPress={() => form.setValue('nextProgrammeId', p.id, { shouldDirty: true, shouldValidate: true })} />
                ))}
              </View>
            </View>
          ) : null}
        </Section>

        <Section title="Workout days">
          {days.map((day, di) => {
            const open = openDay === day.key;
            const names = day.exercises.map((e) => e.name).join(', ');
            const label =
              day.name.trim() && day.name.trim() !== `Day ${di + 1}`
                ? `Day ${di + 1} · ${day.name.trim()}`
                : `Day ${di + 1}`;
            return (
              <View key={day.key} className={`mb-sm rounded-md border bg-surface ${open ? 'border-primary' : 'border-border'}`}>
                <View className="min-h-[56px] flex-row items-center pr-xs">
                  <DragHandle onMove={(dir) => setDays((ds) => move(ds, di, dir))} />
                  <Pressable className="min-w-0 flex-1 py-2.5" onPress={() => setOpenDay(open ? '' : day.key)}>
                    <Text className="text-[15px] font-bold text-ink" numberOfLines={1}>
                      {label}
                    </Text>
                    {!open ? (
                      <Text className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
                        {names || 'No exercises yet'}
                      </Text>
                    ) : null}
                  </Pressable>
                  {days.length > 1 ? (
                    <Pressable
                      onPress={() => {
                        const next = days.filter((d) => d.key !== day.key);
                        setDays(next);
                        setOpenDay(next[Math.min(di, next.length - 1)]?.key ?? '');
                      }}
                      hitSlop={8}
                      className="h-12 w-9 items-center justify-center"
                    >
                      <Trash size={16} color={colors.danger} />
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => setOpenDay(open ? '' : day.key)} hitSlop={8} className="h-12 w-9 items-center justify-center">
                    {open ? (
                      <ChevronDown size={18} color={colors.muted} />
                    ) : (
                      <ChevronRight size={18} color={colors.muted} />
                    )}
                  </Pressable>
                </View>

                {open ? (
                  <View className="px-md pb-md">
                    <FormField
                      control={form.control}
                      name={`days.${di}.name`}
                      label="Day name"
                      placeholder="Optional · e.g. Push"
                      maxLength={40}
                    />

                    {day.exercises.length === 0 ? (
                      <EmptyState title="Add exercises" body="Pick from library. Uses come from the exercise." />
                    ) : (
                      day.exercises.map((ex, ei) => {
                        const editing = editKey === ex.key;
                        return (
                          <View key={ex.key} className={`mb-sm rounded-md border bg-surface2 ${editing ? 'border-primary' : 'border-transparent'}`}>
                            <View className={`min-h-[52px] flex-row items-center pr-1.5 ${editing ? 'pl-md' : ''}`}>
                              {editing ? null : (
                                <DragHandle
                                  onMove={(dir) => patchDay(day.key, { exercises: move(day.exercises, ei, dir) })}
                                />
                              )}
                              <View className="min-w-0 flex-1 py-sm pr-xs">
                                <Text className="text-[14px] font-semibold text-ink" numberOfLines={1}>
                                  {ei + 1}. {ex.name}
                                </Text>
                                {editing ? null : (
                                  <Text className="mt-0.5 text-[12px] text-muted">
                                    {ex.sets}×{ex.reps} · {ex.rest}s
                                  </Text>
                                )}
                              </View>
                              {editing ? (
                                <Pressable
                                  onPress={() => finishEdit(day.key, ex)}
                                  hitSlop={10}
                                  className="h-11 w-11 items-center justify-center"
                                  accessibilityLabel="Done"
                                >
                                  <CircleCheck size={22} color={colors.success} />
                                </Pressable>
                              ) : (
                                <>
                                  <Pressable onPress={() => startEdit(ex.key)} hitSlop={8} className="h-12 w-9 items-center justify-center">
                                    <Pencil size={15} color={colors.muted} />
                                  </Pressable>
                                  <Pressable
                                    onPress={() =>
                                      patchDay(day.key, {
                                        exercises: day.exercises.filter((x) => x.key !== ex.key),
                                      })
                                    }
                                    hitSlop={8}
                                    className="h-12 w-9 items-center justify-center"
                                  >
                                    <X size={16} color={colors.muted} />
                                  </Pressable>
                                </>
                              )}
                            </View>
                            {editing ? (
                              <View className="flex-row gap-sm px-md pb-md">
                                <UseField
                                  label="Sets"
                                  value={ex.sets}
                                  error={errs.sets}
                                  maxLength={2}
                                  onChange={(v) => patchEx(day.key, ex.key, 'sets', v)}
                                />
                                <UseField
                                  label="Reps"
                                  value={ex.reps}
                                  error={errs.reps}
                                  maxLength={3}
                                  onChange={(v) => patchEx(day.key, ex.key, 'reps', v)}
                                />
                                <UseField
                                  label="Rest s"
                                  value={ex.rest}
                                  error={errs.rest}
                                  maxLength={3}
                                  onChange={(v) => patchEx(day.key, ex.key, 'rest', v)}
                                />
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                    <Btn
                      label="Add exercise"
                      icon={Plus}
                      variant="secondary"
                      inset
                      onPress={() => setPickDayKey(day.key)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          <Btn
            label="Add workout day"
            icon={Plus}
            variant="secondary"
            disabled={!canAddDay}
            onPress={addDay}
          />
          {!canAddDay ? (
            <Text className="-mt-xs mb-md text-[12px] text-muted">Finish this day’s exercises before adding another day.</Text>
          ) : null}
        </Section>
        <FormSubmit
          label={initial?.id ? 'Save changes' : 'Save programme'}
          onValid={save}
          busy={busy}
        />
      </ScrollBody>
      </Form>

      <BottomSheet
        open={!!pickDayKey}
        title="Add exercise"
        expand="full"
        onClose={() => setPickDayKey(null)}
      >
        {exercises.length === 0 ? (
          <EmptyState title="Empty library" body="Create exercises first." />
        ) : (
          grouped.map(([group, list]) => (
            <Section key={group} title={group}>
              {list.map((e) => (
                <Pressable
                  key={e.id}
                  className="mb-sm flex-row items-center gap-md rounded-md border border-border bg-surface p-sm"
                  onPress={() => pickDayKey && addExerciseToDay(pickDayKey, e)}
                >
                  <GifThumb uri={e.imageUrl} size={44} />
                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-ink">{e.name}</Text>
                    <Text className="mt-0.5 text-[13px] text-muted">
                      {e.defaultSets ?? 3}×{e.defaultReps ?? 10} · {e.defaultRestSeconds ?? 60}s
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Section>
          ))
        )}
      </BottomSheet>
    </>
  );
}
