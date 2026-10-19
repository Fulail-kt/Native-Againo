import {
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  Settings,
  Trash,
  UserPlus,
  Users,
} from '../../icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { CatalogPicker } from '../../components/CatalogPicker';
import { GifThumb } from '../../components/GifThumb';
import { ViewToggle, type TileView } from '../../components/ViewToggle';
import { WEEKDAYS } from '../../days';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Form, FormField, FormSubmit, useAppForm } from '../../form';
import { pop } from '../../pop';
import {
  addExerciseSchema,
  addMemberSchema,
  announcementSchema,
  gymSettingsSchema,
  type AddExerciseValues,
  type AddMemberValues,
  type AnnouncementValues,
  type GymSettingsFormValues,
  type GymSettingsValues,
} from '../../schemas';
import { MUSCLES, ProgrammeBuilder } from './ProgrammeBuilder';
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
  Hint,
  ListRow,
  ScrollBody,
  Section,
  Segmented,
  StatGrid,
  AppearanceSettings,
} from '../../ui';

type Tab = 'dash' | 'members' | 'library' | 'settings';

const ADMIN_NAV = [
  { key: 'dash', label: 'Home', Icon: LayoutDashboard },
  { key: 'members', label: 'Members', Icon: Users },
  { key: 'library', label: 'Library', Icon: Dumbbell },
  { key: 'settings', label: 'Settings', Icon: Settings },
];
type Sheet = null | 'add-member' | 'member-detail' | 'add-exercise' | 'catalog';
type LibraryTab = 'exercises' | 'programmes';
type LibraryView = 'browse' | 'builder';

function fmtDate(v?: string | Date | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminApp() {
  const { token, user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('dash');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('exercises');
  const [libraryView, setLibraryView] = useState<LibraryView>('browse');
  const [libTiles, setLibTiles] = useState<TileView>('cards');
  const [libQ, setLibQ] = useState('');
  const [previewProg, setPreviewProg] = useState<any>(null);
  const [editProg, setEditProg] = useState<any>(null);
  const [assignId, setAssignId] = useState<number | null>(null);
  const [assignCustom, setAssignCustom] = useState(false);
  const [assignMode, setAssignMode] = useState<'inherit' | 'FIXED' | 'REPEAT'>('inherit');
  const [assignNext, setAssignNext] = useState<number | null>(null);

  const [dash, setDash] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [gym, setGym] = useState<any>(null);

  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const settingsForm = useAppForm<GymSettingsFormValues>(gymSettingsSchema, {
    lat: null,
    lng: null,
    radius: '150',
    openDays: [0, 1, 2, 3, 4, 5, 6],
  });

  const memberForm = useAppForm(addMemberSchema, { name: '', email: '', password: 'secret123' });

  const exerciseForm = useAppForm(addExerciseSchema, {
    name: '',
    how: '',
    muscle: 'Chest',
    sets: '3',
    reps: '10',
    rest: '60',
  });

  const announceForm = useAppForm(announcementSchema, { message: '' });

  const settingsLat = settingsForm.watch('lat');
  const settingsLng = settingsForm.watch('lng');
  const settingsRadius = settingsForm.watch('radius');
  const settingsOpenDays = settingsForm.watch('openDays');
  const exerciseMuscle = exerciseForm.watch('muscle');

  const refreshDash = useCallback(async () => {
    const [d, g] = await Promise.all([
      api('/gyms/dashboard', { token }),
      api('/gyms/me', { token }),
    ]);
    setDash(d);
    setGym(g);
  }, [token]);

  useEffect(() => {
    if (!gym || tab !== 'settings' || settingsForm.formState.isDirty) return;
    settingsForm.reset({
      lat: gym.lat != null ? Number(gym.lat) : null,
      lng: gym.lng != null ? Number(gym.lng) : null,
      radius: String(gym.attendanceRadiusMeters ?? 150),
      openDays: Array.isArray(gym.openDays) ? gym.openDays : [0, 1, 2, 3, 4, 5, 6],
    });
  }, [gym, tab, settingsForm.formState.isDirty]);

  const loadMembers = useCallback(async () => {
    setMembers(await api('/members', { token }));
  }, [token]);

  const loadLibrary = useCallback(async () => {
    const [ex, pr] = await Promise.all([
      api('/exercises', { token }),
      api('/programmes', { token }),
    ]);
    setExercises(ex);
    setProgrammes(pr);
  }, [token]);

  useEffect(() => {
    refreshDash().catch((e) => pop.err('Dashboard', e));
  }, [refreshDash]);

  useEffect(() => {
    if (tab === 'members') {
      loadMembers().catch((e) => pop.err('Members', e));
      api('/programmes', { token }).then(setProgrammes).catch(() => undefined);
    }
    if (tab === 'library') loadLibrary().catch((e) => pop.err('Library', e));
    if (tab === 'settings') refreshDash().catch((e) => pop.err('Settings', e));
  }, [tab, loadMembers, loadLibrary, refreshDash, token]);

  function switchTab(next: Tab) {
    setTab(next);
    setSheet(null);
    setLibraryView('browse');
    setSelectedMemberId(null);
    setMemberProfile(null);
    setEditProg(null);
  }

  useEffect(() => {
    if (sheet === 'add-member') {
      memberForm.reset({ name: '', email: '', password: 'secret123' });
    }
    if (sheet === 'add-exercise') {
      exerciseForm.reset({ name: '', how: '', muscle: 'Chest', sets: '3', reps: '10', rest: '60' });
    }
  }, [sheet]);

  function closeSheet() {
    setSheet(null);
    setAssignId(null);
    setAssignCustom(false);
    setAssignMode('inherit');
    setAssignNext(null);
  }

  async function loadMemberProfile(id: number) {
    setMemberProfile(await api(`/members/${id}`, { token }));
  }

  async function openMember(m: any) {
    setSelectedMemberId(m.id);
    setMemberProfile(null);
    setSheet('member-detail');
    try {
      await loadMemberProfile(m.id);
    } catch (e) {
      pop.err('Member', e);
    }
  }

  async function createMember(values: AddMemberValues) {
    setBusy(true);
    try {
      await api('/members', {
        token,
        method: 'POST',
        body: values,
      });
      pop.ok('Done', 'Member created. Share login details with them.');
      memberForm.reset({ name: '', email: '', password: 'secret123' });
      closeSheet();
      await loadMembers();
    } catch (e) {
      pop.err('Create failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMember(m: any) {
    try {
      await api(`/members/${m.id}`, {
        token,
        method: 'PATCH',
        body: { status: m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
      });
      closeSheet();
      await loadMembers();
    } catch (e) {
      pop.err('Update failed', e);
    }
  }

  async function confirmDeleteMember(m: any) {
    const ok = await pop.ask(
      'Delete this member?',
      `${m.name} · ${m.email}. Wipes login, workouts, check-ins, and assignments. Cannot undo.`,
      { confirm: 'Delete', danger: true },
    );
    if (!ok) return;
    try {
      await api(`/members/${m.id}`, { token, method: 'DELETE' });
      if (selectedMemberId === m.id) {
        setSelectedMemberId(null);
        closeSheet();
      }
      pop.ok('Deleted', m.name);
      await loadMembers();
      await refreshDash();
    } catch (e) {
      pop.err('Delete failed', e);
    }
  }

  async function assignProgramme(programmeId: number) {
    if (!selectedMemberId) return;
    setBusy(true);
    try {
      await api(`/members/${selectedMemberId}/programmes`, {
        token,
        method: 'POST',
        body: {
          programmeId,
          mode: assignMode === 'inherit' ? undefined : assignMode,
          nextProgrammeId: assignMode === 'FIXED' ? assignNext ?? undefined : undefined,
        },
      });
      pop.ok('Assigned', 'Member can now see this workout on Today tab.');
      await loadMemberProfile(selectedMemberId);
      await loadMembers();
      setAssignId(null);
      setAssignCustom(false);
      setAssignMode('inherit');
      setAssignNext(null);
    } catch (e) {
      pop.err('Assign failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function createExercise(values: AddExerciseValues) {
    setBusy(true);
    try {
      await api('/exercises', {
        token,
        method: 'POST',
        body: {
          name: values.name,
          instructions: values.how,
          muscleGroup: values.muscle,
          defaultSets: Number(values.sets) || 3,
          defaultReps: Number(values.reps) || 10,
          defaultRestSeconds: Number(values.rest) || 60,
        },
      });
      pop.ok('Saved', 'Exercise added.');
      exerciseForm.reset({ name: '', how: '', muscle: 'Chest', sets: '3', reps: '10', rest: '60' });
      closeSheet();
      await loadLibrary();
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function openProgramme(id: number) {
    try {
      setPreviewProg(await api(`/programmes/${id}`, { token }));
    } catch (e) {
      pop.err('Programme', e);
    }
  }

  async function sendAnnouncement(values: AnnouncementValues) {
    setBusy(true);
    try {
      await api('/announcements', {
        token,
        method: 'POST',
        body: { title: 'Gym update', body: values.message },
      });
      pop.ok('Sent', 'Announcement posted.');
      announceForm.reset({ message: '' });
    } catch (e) {
      pop.err('Send failed', e);
    } finally {
      setBusy(false);
    }
  }

  function startNewProgramme() {
    setEditProg(null);
    setLibraryView('builder');
  }

  async function startEditProgramme(id: number) {
    try {
      const full = await api(`/programmes/${id}`, { token });
      setPreviewProg(null);
      setEditProg(full);
      setLibraryView('builder');
    } catch (e) {
      pop.err('Programme', e);
    }
  }

  async function confirmDeleteExercise(e: any) {
    const ok = await pop.ask('Remove from library?', e.name, {
      confirm: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/exercises/${e.id}`, { token, method: 'DELETE' });
      closeSheet();
      await loadLibrary();
    } catch (err) {
      pop.err('Remove failed', err);
    }
  }

  async function confirmDeleteProgramme(p: any) {
    const ok = await pop.ask('Delete this programme?', p.name, {
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/programmes/${p.id}`, { token, method: 'DELETE' });
      setPreviewProg(null);
      closeSheet();
      await loadLibrary();
    } catch (err) {
      pop.err('Delete failed', err);
    }
  }

  function toggleOpenDay(day: number) {
    const next = settingsOpenDays.includes(day)
      ? settingsOpenDays.filter((d) => d !== day)
      : [...settingsOpenDays, day].sort((a, b) => a - b);
    settingsForm.setValue('openDays', next, { shouldDirty: true, shouldValidate: true });
  }

  async function saveGymSettings(values: {
    lat: number | null;
    lng: number | null;
    radius: string;
    openDays: number[];
  }) {
    if (values.lat == null || values.lng == null) return;
    setBusy(true);
    try {
      const g = await api('/gyms/me', {
        token,
        method: 'PATCH',
        body: {
          lat: values.lat,
          lng: values.lng,
          attendanceRadiusMeters: Number(values.radius),
          openDays: values.openDays,
        },
      });
      setGym(g);
      settingsForm.reset(values);
      pop.ok('Saved', 'Gym settings updated.');
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  const selectedMember =
    memberProfile && memberProfile.id === selectedMemberId
      ? memberProfile
      : members.find((m) => m.id === selectedMemberId);

  const shownExercises = exercises.filter((e) => {
    const q = libQ.trim().toLowerCase();
    return !q || String(e.name).toLowerCase().includes(q);
  });

  const tabTitles: Record<Tab, string> = {
    dash: 'Dashboard',
    members: 'Members',
    library: 'Library',
    settings: 'Settings',
  };

  return (
    <AppShell
      footer={
        <BottomNav
          items={ADMIN_NAV}
          value={tab}
          onChange={(k) => switchTab(k as Tab)}
        />
      }
    >
      {tab === 'library' && libraryView === 'builder' ? (
        <BackHeader
          title={editProg?.id ? 'Edit programme' : 'New programme'}
          onBack={() => {
            setLibraryView('browse');
            setEditProg(null);
          }}
        />
      ) : (
        <Header title={tabTitles[tab]} />
      )}

      {tab === 'library' && libraryView === 'builder' ? (
        <ProgrammeBuilder
          key={editProg?.id ?? 'new'}
          token={token}
          exercises={exercises}
          programmes={programmes}
          initial={editProg}
          onSaved={async () => {
            setLibraryView('browse');
            setLibraryTab('programmes');
            setEditProg(null);
            await loadLibrary();
          }}
        />
      ) : (
      <ScrollBody>
        {tab === 'dash' ? (
          <>
            <StatGrid
              items={[
                { label: 'Members', value: dash?.members ?? 0 },
                { label: 'Check-ins today', value: dash?.checkInsToday ?? 0 },
                { label: 'Workouts today', value: dash?.workoutsToday ?? 0 },
                { label: 'Join code', value: gym?.code ?? '—' },
              ]}
            />
            <Section title="Announce to members">
              <Form form={announceForm}>
                <FormField
                  control={announceForm.control}
                  name="message"
                  label="Message"
                  placeholder="Class cancelled tomorrow…"
                  multiline
                  maxLength={2000}
                />
                <FormSubmit
                  label="Send announcement"
                  icon={Megaphone}
                  onValid={sendAnnouncement}
                  busy={busy}
                  inset
                />
              </Form>
            </Section>
          </>
        ) : null}

        {tab === 'members' ? (
          <>
            <Btn label="Add new member" icon={UserPlus} onPress={() => setSheet('add-member')} />
            <Section title={`All members (${members.length})`}>
              {members.length === 0 ? (
                <EmptyState title="No members yet" body="Tap Add new member above." />
              ) : (
                members.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#151922',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: '#2a3140',
                      gap: 10,
                    }}
                  >
                    <Pressable
                      onPress={() => openMember(m)}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <Text style={{ color: '#f4f6fb', fontSize: 15, fontWeight: '600' }}>{m.name}</Text>
                      <Text style={{ color: '#8b95a8', fontSize: 13, marginTop: 2 }}>
                        {m.email}
                        {m.createdAt ? ` · joined ${fmtDate(m.createdAt)}` : ''}
                      </Text>
                    </Pressable>
                    <Text style={{ color: '#8b95a8', fontSize: 12, fontWeight: '700' }}>{m.status}</Text>
                    <Pressable onPress={() => confirmDeleteMember(m)} hitSlop={8} style={{ padding: 6 }}>
                      <Trash size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                ))
              )}
            </Section>
          </>
        ) : null}

        {tab === 'library' ? (
          <>
            <Segmented
              options={[
                { key: 'exercises', label: 'Exercises' },
                { key: 'programmes', label: 'Programmes' },
              ]}
              value={libraryTab}
              onChange={(k) => setLibraryTab(k as LibraryTab)}
            />
            {libraryTab === 'exercises' ? (
              <>
                <Btn label="Browse catalog" icon={Plus} onPress={() => setSheet('catalog')} />
                <Btn
                  label="Create custom"
                  variant="ghost"
                  onPress={() => {
                    exerciseForm.reset({
                      name: '',
                      how: '',
                      muscle: 'Chest',
                      sets: '3',
                      reps: '10',
                      rest: '60',
                    });
                    setSheet('add-exercise');
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#8b95a8', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
                    VIEW
                  </Text>
                  <ViewToggle value={libTiles} onChange={setLibTiles} />
                </View>
                <Field
                  label="Search library"
                  hideLabel
                  placeholder="bench, squat…"
                  value={libQ}
                  onChangeText={setLibQ}
                  returnKeyType="search"
                />
                <Section title={`Gym library (${shownExercises.length})`}>
                  {shownExercises.length === 0 ? (
                    <EmptyState
                      title={exercises.length === 0 ? 'No exercises' : 'No matches'}
                      body={
                        exercises.length === 0
                          ? 'Browse the catalog and add moves this gym uses.'
                          : 'Try another search.'
                      }
                    />
                  ) : (
                    MUSCLES.filter((g) =>
                      shownExercises.some((e) => (e.muscleGroup || 'Other') === g),
                    ).map((g) => {
                      const list = shownExercises.filter((e) => (e.muscleGroup || 'Other') === g);
                      return (
                        <Section key={g} title={g}>
                          {libTiles === 'cards' ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                              }}
                            >
                              {list.map((e) => (
                                <View
                                  key={e.id}
                                  style={{
                                    width: '48.5%',
                                    height: 248,
                                    backgroundColor: '#1e2430',
                                    borderRadius: 12,
                                    padding: 8,
                                    borderWidth: 1,
                                    borderColor: '#2a3140',
                                    marginBottom: 8,
                                  }}
                                >
                                  <GifThumb
                                    uri={e.imageUrl}
                                    width="100%"
                                    height={124}
                                    style={{ width: '100%', height: 124, borderRadius: 8, marginBottom: 8 }}
                                  />
                                  <Text
                                    style={{
                                      color: '#f4f6fb',
                                      fontSize: 13,
                                      fontWeight: '600',
                                      lineHeight: 18,
                                      height: 36,
                                    }}
                                    numberOfLines={2}
                                  >
                                    {e.name}
                                  </Text>
                                  <View
                                    style={{
                                      marginTop: 'auto',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Text style={{ color: '#8b95a8', fontSize: 12, flex: 1 }}>
                                      {e.defaultSets ?? 3}×{e.defaultReps ?? 10} · {e.defaultRestSeconds ?? 60}s
                                    </Text>
                                    <Pressable
                                      onPress={() => confirmDeleteExercise(e)}
                                      hitSlop={8}
                                      style={{ padding: 6 }}
                                    >
                                      <Trash size={18} color="#ef4444" />
                                    </Pressable>
                                  </View>
                                </View>
                              ))}
                            </View>
                          ) : (
                            list.map((e) => (
                              <View
                                key={e.id}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 10,
                                  backgroundColor: '#151922',
                                  borderRadius: 12,
                                  padding: 8,
                                  marginBottom: 8,
                                  borderWidth: 1,
                                  borderColor: '#2a3140',
                                }}
                              >
                                <GifThumb uri={e.imageUrl} size={64} />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: '#f4f6fb', fontSize: 15, fontWeight: '600' }}>
                                    {e.name}
                                  </Text>
                                  <Text style={{ color: '#8b95a8', fontSize: 13, marginTop: 2 }}>
                                    {e.defaultSets ?? 3}×{e.defaultReps ?? 10} · {e.defaultRestSeconds ?? 60}s
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => confirmDeleteExercise(e)}
                                  hitSlop={8}
                                  style={{ padding: 6 }}
                                >
                                  <Trash size={18} color="#ef4444" />
                                </Pressable>
                              </View>
                            ))
                          )}
                        </Section>
                      );
                    })
                  )}
                </Section>
              </>
            ) : (
              <>
                <Btn label="Create programme" icon={Plus} onPress={startNewProgramme} />
                <Section title={`Programmes (${programmes.length})`}>
                  {programmes.length === 0 ? (
                    <EmptyState title="No programmes" body="Create Warming Up (fixed) or PPL (repeat)." />
                  ) : (
                    programmes.map((p) => (
                      <View
                        key={p.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#151922',
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: '#2a3140',
                          gap: 10,
                        }}
                      >
                        <Pressable onPress={() => openProgramme(p.id)} style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: '#f4f6fb', fontSize: 15, fontWeight: '600' }}>{p.name}</Text>
                          <Text style={{ color: '#8b95a8', fontSize: 13, marginTop: 2 }}>
                            {p.mode === 'FIXED' ? 'Once' : 'Repeat'} · {p.days?.length ?? 0} day(s)
                            {p.nextProgramme ? ` → ${p.nextProgramme.name}` : ''}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDeleteProgramme(p)}
                          hitSlop={8}
                          style={{ padding: 6 }}
                        >
                          <Trash size={18} color="#ef4444" />
                        </Pressable>
                      </View>
                    ))
                  )}
                </Section>
              </>
            )}
          </>
        ) : null}

        {tab === 'settings' ? (
          <>
            <Card title={gym?.name ?? 'Your gym'} body={`Join code: ${gym?.code ?? '—'}`} />
            <Form form={settingsForm}>
              <Section title="Open days">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <Hint
                    title="Open days"
                    body="Members cannot check in or start a workout on a closed day. Closed days do not break their streak."
                  />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {WEEKDAYS.map((d) => (
                    <Chip
                      key={d.key}
                      label={d.short}
                      selected={settingsOpenDays.includes(d.key)}
                      onPress={() => toggleOpenDay(d.key)}
                    />
                  ))}
                </View>
                {settingsForm.formState.errors.openDays ? (
                  <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>
                    {settingsForm.formState.errors.openDays.message}
                  </Text>
                ) : null}
              </Section>
              <Section title="Check-in zone">
                <LocationMapPicker
                  lat={settingsLat}
                  lng={settingsLng}
                  radiusMeters={Number(settingsRadius) || 150}
                  onChange={(a, b) => {
                    settingsForm.setValue('lat', a, { shouldDirty: true, shouldValidate: true });
                    settingsForm.setValue('lng', b, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                {settingsForm.formState.errors.lat ? (
                  <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>
                    {settingsForm.formState.errors.lat.message}
                  </Text>
                ) : null}
                <FormField
                  control={settingsForm.control}
                  name="radius"
                  label="Radius (meters)"
                  hint="How close members must be to check in"
                  kind="digits"
                  maxLength={4}
                />
                <FormSubmit
                  label="Save settings"
                  onValid={saveGymSettings}
                  busy={busy}
                  inset
                />
              </Section>
            </Form>
            <Section title="Account">
              <Card title={user?.name ?? 'Admin'} body={user?.email} />
              <AppearanceSettings />
              <Btn label="Log out" variant="danger" icon={LogOut} onPress={logout} inset />
            </Section>
          </>
        ) : null}
      </ScrollBody>
      )}

      <BottomSheet
        open={sheet === 'add-member'}
        title="New member"
        onClose={closeSheet}
      >
        <Form form={memberForm}>
          <FormField control={memberForm.control} name="name" label="Name" placeholder="Member name" maxLength={80} />
          <FormField
            control={memberForm.control}
            name="email"
            label="Email"
            placeholder="member@email.com"
            keyboardType="email-address"
            maxLength={120}
          />
          <FormField
            control={memberForm.control}
            name="password"
            label="Temp password"
            hint="Share with member for first login"
            placeholder="Min 6 characters"
            secure
            maxLength={72}
          />
          <FormSubmit
            label="Create member"
            icon={UserPlus}
            onValid={createMember}
            busy={busy}
            inset
          />
        </Form>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'member-detail' && !!selectedMember}
        title={selectedMember?.name ?? 'Member'}
        subtitle={
          selectedMember
            ? `${selectedMember.email} · ${selectedMember.status}`
            : undefined
        }
        onClose={closeSheet}
      >
        {selectedMember ? (
          <>
            <Text style={{ color: '#8b95a8', fontSize: 13, marginBottom: 12 }}>
              Joined {fmtDate(selectedMember.createdAt)}
              {selectedMember.activeProgramme
                ? ` · ${selectedMember.activeProgramme.name}`
                : ' · no programme'}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {[
                { n: selectedMember.stats?.completedWorkouts ?? 0, l: 'Workouts' },
                { n: selectedMember.stats?.attendanceCount ?? 0, l: 'Check-ins' },
                { n: fmtDate(selectedMember.stats?.lastCheckIn), l: 'Last in' },
              ].map((s) => (
                <View
                  key={s.l}
                  style={{
                    flex: 1,
                    backgroundColor: '#1e2430',
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#f4f6fb', fontSize: 15, fontWeight: '700' }}>{s.n}</Text>
                  <Text style={{ color: '#8b95a8', fontSize: 11, marginTop: 2 }}>{s.l}</Text>
                </View>
              ))}
            </View>

            <Section title="Recent">
              {(selectedMember.recentWorkouts ?? []).length === 0 &&
              (selectedMember.recentAttendance ?? []).length === 0 ? (
                <EmptyState title="No activity yet" body="Workouts and check-ins show here." />
              ) : (
                <>
                  {(selectedMember.recentWorkouts ?? []).slice(0, 4).map((h: any) => (
                    <ListRow
                      key={`w-${h.id}`}
                      title={h.name}
                      subtitle={fmtDate(h.dayKey)}
                      right={h.status === 'COMPLETED' ? `${h.sets} sets` : 'Open'}
                    />
                  ))}
                  {(selectedMember.recentAttendance ?? []).slice(0, 3).map((a: any) => (
                    <ListRow
                      key={`a-${a.id}`}
                      title="Check-in"
                      subtitle={fmtDate(a.checkedInAt)}
                    />
                  ))}
                </>
              )}
            </Section>

            <Section title="Programme">
              {programmes.length === 0 ? (
                <EmptyState title="No programmes" body="Create one in Library first." />
              ) : (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {programmes.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.name}
                        selected={assignId === p.id || selectedMember.activeProgramme?.id === p.id}
                        onPress={() => setAssignId(p.id)}
                      />
                    ))}
                  </View>
                  {assignCustom ? (
                    <>
                      <Segmented
                        options={[
                          { key: 'inherit', label: 'Programme' },
                          { key: 'FIXED', label: 'Once' },
                          { key: 'REPEAT', label: 'Repeat' },
                        ]}
                        value={assignMode}
                        onChange={(k) => setAssignMode(k as 'inherit' | 'FIXED' | 'REPEAT')}
                      />
                      {assignMode === 'FIXED' ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          <Chip label="Wait" selected={assignNext == null} onPress={() => setAssignNext(null)} />
                          {programmes
                            .filter((p) => p.id !== assignId)
                            .map((p) => (
                              <Chip
                                key={p.id}
                                label={p.name}
                                selected={assignNext === p.id}
                                onPress={() => setAssignNext(p.id)}
                              />
                            ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Btn
                        label="Assign"
                        inset
                        disabled={!assignId}
                        busy={busy}
                        onPress={() => assignId && assignProgramme(assignId)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn
                        label={assignCustom ? 'Less' : 'Options'}
                        variant="ghost"
                        inset
                        onPress={() => setAssignCustom((v) => !v)}
                      />
                    </View>
                  </View>
                </>
              )}
            </Section>

            <Btn
              label={selectedMember.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              variant="ghost"
              onPress={() => toggleMember(selectedMember)}
              inset
            />
            <Btn
              label="Delete member"
              variant="danger"
              icon={Trash}
              onPress={() => confirmDeleteMember(selectedMember)}
              inset
            />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={sheet === 'catalog'}
        title="Exercise catalog"
        subtitle="Add moves · GIF included"
        expand="full"
        fill
        onClose={closeSheet}
      >
        <CatalogPicker
          token={token}
          onImported={async () => {
            await loadLibrary();
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'add-exercise'}
        title="New exercise"
        subtitle="Library move"
        onClose={closeSheet}
      >
        <Form form={exerciseForm}>
          <FormField
            control={exerciseForm.control}
            name="name"
            label="Name"
            placeholder="Decline Bench Press"
            maxLength={80}
          />
          <Section title="Muscle group">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {MUSCLES.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  selected={exerciseMuscle === g}
                  onPress={() =>
                    exerciseForm.setValue('muscle', g, { shouldDirty: true, shouldValidate: true })
                  }
                />
              ))}
            </View>
          </Section>
          <Section title="Uses">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <FormField
                tight
                control={exerciseForm.control}
                name="sets"
                label="Sets"
                kind="digits"
                maxLength={2}
              />
              <FormField
                tight
                control={exerciseForm.control}
                name="reps"
                label="Reps"
                kind="digits"
                maxLength={3}
              />
              <FormField
                tight
                control={exerciseForm.control}
                name="rest"
                label="Rest s"
                kind="digits"
                maxLength={3}
              />
            </View>
          </Section>
          <FormField
            control={exerciseForm.control}
            name="how"
            label="Instructions"
            placeholder="How to perform…"
            multiline
            maxLength={2000}
          />
          <FormSubmit
            label="Save exercise"
            icon={Plus}
            onValid={createExercise}
            busy={busy}
            inset
          />
        </Form>
      </BottomSheet>

      <BottomSheet
        open={!!previewProg}
        title={previewProg?.name ?? 'Programme'}
        expand="full"
        subtitle={
          previewProg
            ? `${previewProg.mode === 'FIXED' ? 'Fixed (ends)' : 'Repeat cycle'} · ${previewProg.days?.length ?? 0} days`
            : undefined
        }
        onClose={() => setPreviewProg(null)}
      >
        {previewProg?.days?.map((d: any, i: number) => (
          <Section key={d.id} title={`Day ${i + 1} — ${d.name}`}>
            {(d.items ?? []).map((it: any, j: number) => (
              <ListRow
                key={it.id}
                title={`${j + 1}. ${it.exercise?.name}`}
                subtitle={`${it.sets} × ${it.reps ?? '—'} · rest ${it.restSeconds ?? 0}s`}
              />
            ))}
          </Section>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Btn
              label="Edit"
              variant="secondary"
              icon={Pencil}
              inset
              onPress={() => previewProg && startEditProgramme(previewProg.id)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Btn
              label="Delete"
              variant="danger"
              icon={Trash}
              inset
              onPress={() => previewProg && confirmDeleteProgramme(previewProg)}
            />
          </View>
        </View>
      </BottomSheet>
    </AppShell>
  );
}
