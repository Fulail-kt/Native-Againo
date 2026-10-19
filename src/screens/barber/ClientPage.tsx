import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Form, FormField, FormSubmit, useAppForm } from '../../form';
import { pop } from '../../pop';
import { api, apiUpload, photoUrl } from '../../api';
import * as ImagePicker from 'expo-image-picker';
import { clientDetailsSchema, type ClientDetailsValues } from '../../schemas';
import { BackHeader, Btn, Chip, EmptyState, ListRow, PairCtas, ScrollBody, Section } from '../../ui';
import { ChairChips, type Chair } from './chairs';
import { Plus, Trash } from '../../icons';
import { colors } from '../../theme';
import { apptLabel, formatDay, time12 } from './time';

const FOLLOW = [30, 45, 60, 90];
const PHOTO_CAP = 5;

export function ClientPage({
  token,
  shopId,
  customerId,
  defaultFollow,
  chairs,
  onBack,
  onChanged,
}: {
  token: string;
  shopId: number;
  customerId: number;
  defaultFollow: number;
  chairs?: Chair[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const form = useAppForm<ClientDetailsValues>(clientDetailsSchema, {
    name: '',
    phone: '',
    notes: '',
    followUpDays: defaultFollow,
    preferredChairId: null,
  });
  const follow = form.watch('followUpDays');
  const preferChair = form.watch('preferredChairId');

  const load = useCallback(async () => {
    const next = await api(`/shops/customers/${customerId}`, { token });
    setRow(next);
    form.reset({
      name: next.name ?? '',
      phone: String(next.phone ?? '').replace(/\D/g, ''),
      notes: next.notes ?? '',
      followUpDays: next.followUpDays ?? defaultFollow,
      preferredChairId: next.preferredChairId ?? null,
    });
  }, [token, customerId, defaultFollow]);

  useEffect(() => {
    load().catch((e) => pop.err('Client', e));
  }, [load]);

  async function save(values: ClientDetailsValues) {
    setBusy(true);
    try {
      await api(`/shops/customers/${customerId}`, {
        token,
        method: 'PATCH',
        body: {
          name: values.name.trim(),
          phone: values.phone,
          notes: values.notes.trim() || undefined,
          followUpDays: values.followUpDays,
          preferredChairId: values.preferredChairId,
        },
      });
      await Promise.all([load(), Promise.resolve(onChanged())]);
      pop.ok('Saved');
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await pop.ask('Delete client?', 'Gone for good. No visits on them.', {
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/shops/customers/${customerId}`, { token, method: 'DELETE' });
      onChanged();
      onBack();
      pop.ok('Deleted');
    } catch (e) {
      pop.err('Delete failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(on: boolean) {
    const values = form.getValues();
    setBusy(true);
    try {
      await api(`/shops/customers/${customerId}`, {
        token,
        method: 'PATCH',
        body: {
          name: values.name.trim(),
          phone: values.phone,
          notes: values.notes.trim() || undefined,
          followUpDays: values.followUpDays,
          preferredChairId: values.preferredChairId,
          isActive: on,
        },
      });
      await Promise.all([load(), Promise.resolve(onChanged())]);
      pop.ok(on ? 'Client on' : 'Client disabled');
    } catch (e) {
      pop.err('Save failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      pop.info('Photos', 'Allow library access to save a haircut photo.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.65,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (pick.canceled || !pick.assets[0]) return;
    const a = pick.assets[0];
    setBusy(true);
    try {
      const next = await apiUpload<{ photos: string[] }>(
        `/shops/customers/${customerId}/photos`,
        token,
        { uri: a.uri, name: a.fileName || 'cut.jpg', type: a.mimeType || 'image/jpeg' },
      );
      setRow((cur: any) => (cur ? { ...cur, photos: next.photos } : cur));
      pop.ok(next.photos.length >= PHOTO_CAP ? 'Saved · oldest replaced' : 'Photo saved');
    } catch (e) {
      pop.err('Photo failed', e);
    } finally {
      setBusy(false);
    }
  }

  async function dropPhoto(file: string) {
    const ok = await pop.ask('Remove photo?', undefined, { confirm: 'Remove', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await api(`/shops/customers/${customerId}/photos?file=${encodeURIComponent(file)}`, {
        token,
        method: 'DELETE',
      });
      setRow((cur: any) => (cur ? { ...cur, photos: next.photos } : cur));
    } catch (e) {
      pop.err('Remove failed', e);
    } finally {
      setBusy(false);
    }
  }

  const photos: string[] = row?.photos ?? [];
  const visits = row?.appointments ?? [];

  return (
    <>
      <BackHeader title={row?.name ?? 'Client'} subtitle={row?.phone} onBack={onBack} />
      <ScrollBody>
        <Section title="Details">
          <Text className="mb-sm text-[13px] text-muted">
            {row?.loyaltyPoints ?? 0} pts
            {row?.lastVisitAt ? ` · last ${formatDay(String(row.lastVisitAt).slice(0, 10))}` : ''}
          </Text>
          <Form form={form}>
            <FormField control={form.control} name="name" label="Name" maxLength={80} />
            <FormField
              control={form.control}
              name="phone"
              label="Phone"
              kind="digits"
              maxLength={15}
              placeholder="9876543210"
            />
            <FormField
              control={form.control}
              name="notes"
              label="Notes"
              placeholder="Optional"
              maxLength={500}
              multiline
            />
            <ChairChips
              chairs={chairs ?? []}
              value={preferChair}
              onPick={(id) => form.setValue('preferredChairId', id, { shouldDirty: true })}
              allowAny
              title="Preferred staff"
            />
            <View className="mb-sm flex-row flex-wrap">
              {FOLLOW.map((n) => (
                <Chip
                  key={n}
                  label={`${n}d`}
                  selected={follow === n}
                  onPress={() => form.setValue('followUpDays', n, { shouldDirty: true })}
                />
              ))}
            </View>
            <PairCtas
              hint={
                visits.length
                  ? "Can't delete — this client has visits. Disable to hide them from new books and reminders."
                  : undefined
              }
              left={
                visits.length ? (
                  <Btn
                    label={row?.isActive === false ? 'Enable' : 'Disable'}
                    variant="secondary"
                    inset
                    busy={busy}
                    onPress={() => setActive(row?.isActive === false)}
                  />
                ) : (
                  <Btn label="Delete" variant="danger" inset busy={busy} onPress={remove} />
                )
              }
              right={<FormSubmit label="Save" inset busy={busy} onValid={save} />}
            />
          </Form>
        </Section>

        <Section title={`Cuts · ${photos.length}/${PHOTO_CAP}`}>
          <View className="flex-row flex-wrap gap-sm">
            {photos.map((file) => (
              <View key={file} className="aspect-square w-[31%] overflow-hidden rounded-md bg-surface2">
                <Image source={{ uri: photoUrl(shopId, customerId, file) }} className="h-full w-full" />
                <Pressable
                  className="absolute right-[6px] top-[6px] h-[22px] w-[22px] items-center justify-center rounded-[11px] bg-black/55"
                  onPress={() => dropPhoto(file)}
                  hitSlop={8}
                >
                  <Trash size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < PHOTO_CAP ? (
              <Pressable
                className="aspect-square w-[31%] items-center justify-center gap-xs rounded-md border border-border bg-surface2"
                onPress={addPhoto}
              >
                <Plus size={22} color={colors.muted} />
                <Text className="text-[11px] font-semibold text-muted">Add</Text>
              </Pressable>
            ) : (
              <Pressable
                className="aspect-square w-[31%] items-center justify-center gap-xs rounded-md border border-border bg-surface2"
                onPress={addPhoto}
              >
                <Plus size={22} color={colors.muted} />
                <Text className="text-[11px] font-semibold text-muted">Replace oldest</Text>
              </Pressable>
            )}
          </View>
        </Section>

        <Section title="History">
          {visits.length === 0 ? (
            <EmptyState title="No visits yet" body="Bookings show up here after they are saved." />
          ) : (
            visits.map((a: any) => (
              <ListRow
                key={a.id}
                title={a.service?.name ?? 'Visit'}
                subtitle={`${formatDay(String(a.startAt).slice(0, 10))} · ${time12(a.startAt)}${a.chair?.name ? ` · ${a.chair.name}` : ''}`}
                right={apptLabel(a.status, a.startAt)}
              />
            ))
          )}
        </Section>
      </ScrollBody>
    </>
  );
}
