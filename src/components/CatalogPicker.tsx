import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { api } from '../api';
import {
  markCatalogInLibrary,
  useBodyParts,
  useCatalogInfinite,
  type CatalogItem,
} from '../catalog.query';
import { Plus } from '../icons';
import { pop } from '../pop';
import { Chip, EmptyState, Field } from '../ui';
import { GifThumb } from './GifThumb';
import { ViewToggle, type TileView } from './ViewToggle';

function AddBtn({
  inLibrary,
  busy,
  onPress,
}: {
  inLibrary?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  if (inLibrary) {
    return (
      <Text className="mt-auto py-sm text-center text-[11px] font-bold uppercase text-success">
        In library
      </Text>
    );
  }
  return (
    <Pressable
      className="mt-auto min-h-[34px] flex-row items-center justify-center gap-xs rounded-sm bg-primary px-2.5 py-sm"
      onPress={onPress}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Plus size={14} color="#fff" />
          <Text className="text-[13px] font-bold text-white">Add</Text>
        </>
      )}
    </Pressable>
  );
}

function SkeletonCard() {
  return (
    <View className="mb-sm h-[268px] w-[48.5%] rounded-md border border-border bg-surface2 p-sm">
      <View className="mb-sm h-[132px] w-full rounded-sm bg-surface" />
      <View className="mb-sm h-3 rounded-[6px] bg-surface" />
      <View className="mb-sm h-3 rounded-[6px] bg-surface" style={{ width: '55%' }} />
      <View className="mt-auto h-[34px] rounded-sm bg-surface" />
    </View>
  );
}

function CardItem({
  item,
  busy,
  onAdd,
}: {
  item: CatalogItem;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <View
      className={`mb-sm h-[268px] flex-1 rounded-md border bg-surface2 p-sm ${item.inLibrary ? 'border-success' : 'border-border'}`}
    >
      <GifThumb uri={item.imageUrl} width="100%" height={132} style={{ borderRadius: 8, marginBottom: 8 }} />
      <Text className="mb-xs h-9 text-[13px] font-semibold leading-[18px] text-ink" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="mb-sm h-4 text-[12px] text-muted" numberOfLines={1}>
        {item.muscleGroup}
        {item.equipment ? ` · ${item.equipment}` : ''}
      </Text>
      <AddBtn inLibrary={item.inLibrary} busy={busy} onPress={onAdd} />
    </View>
  );
}

function RowItem({
  item,
  busy,
  onAdd,
}: {
  item: CatalogItem;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <View
      className={`mb-sm flex-row items-center gap-md rounded-md border bg-surface2 p-sm ${item.inLibrary ? 'border-success' : 'border-border'}`}
    >
      <GifThumb uri={item.imageUrl} size={64} />
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-ink" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="mb-sm h-4 text-[12px] text-muted" numberOfLines={1}>
          {item.muscleGroup}
          {item.equipment ? ` · ${item.equipment}` : ''}
        </Text>
      </View>
      <AddBtn inLibrary={item.inLibrary} busy={busy} onPress={onAdd} />
    </View>
  );
}

export function CatalogPicker({
  token,
  onImported,
}: {
  token: string | null;
  onImported: () => void;
}) {
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [body, setBody] = useState<string | null>(null);
  const [view, setView] = useState<TileView>('cards');
  const [busyId, setBusyId] = useState<string | null>(null);

  const partsQ = useBodyParts(token);
  const catalog = useCatalogInfinite(token, appliedQ, appliedQ.trim() ? null : body);
  const parts = partsQ.data ?? [];
  const items = useMemo(
    () => catalog.data?.pages.flatMap((p) => p.items) ?? [],
    [catalog.data],
  );

  useEffect(() => {
    if (
      catalog.isSuccess &&
      catalog.hasNextPage &&
      !catalog.isFetchingNextPage &&
      (catalog.data?.pages.length ?? 0) === 1
    ) {
      catalog.fetchNextPage().catch(() => undefined);
    }
  }, [
    catalog.isSuccess,
    catalog.hasNextPage,
    catalog.isFetchingNextPage,
    catalog.data?.pages.length,
    catalog.fetchNextPage,
  ]);

  useEffect(() => {
    if (catalog.isError) pop.err('Catalog', catalog.error);
  }, [catalog.isError, catalog.error]);

  async function addItem(item: CatalogItem) {
    if (item.inLibrary) {
      pop.info('Already in gym library', item.name);
      return;
    }
    setBusyId(item.sourceId);
    try {
      await api('/exercises/from-catalog', {
        token,
        method: 'POST',
        body: { sourceId: String(item.sourceId) },
      });
      markCatalogInLibrary(item.sourceId);
      pop.ok('Added', item.name);
      onImported();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (/already/i.test(msg)) markCatalogInLibrary(item.sourceId);
      pop.err('Library', msg);
    } finally {
      setBusyId(null);
    }
  }

  function search() {
    setAppliedQ(q);
  }

  const header = (
    <View className="pb-sm">
      <View className="mb-md flex-row items-center gap-sm">
        <Field
          label="Search"
          hideLabel
          tight
          placeholder="bench, squat…"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <Pressable className="h-11 items-center justify-center rounded-md bg-primary px-lg" onPress={search}>
          <Text className="text-[14px] font-bold text-white">Search</Text>
        </Pressable>
      </View>
      <View className="mb-sm flex-row items-center justify-between">
        <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-muted">Body part</Text>
        <ViewToggle value={view} onChange={setView} />
      </View>
      <View className="mb-md flex-row flex-wrap">
        <Chip
          label="All"
          selected={!body}
          onPress={() => {
            setQ('');
            setAppliedQ('');
            setBody(null);
          }}
        />
        {parts.map((p) => (
          <Chip
            key={p}
            label={p}
            selected={body === p}
            onPress={() => {
              setQ('');
              setAppliedQ('');
              setBody(p);
            }}
          />
        ))}
      </View>
    </View>
  );

  const footer = (
    <View className="pt-sm">
      {catalog.isFetchingNextPage ? (
        <View className="flex-row flex-wrap justify-between">
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : null}
      <Text className="mt-sm text-center text-[11px] text-muted">
        {items.length} shown
        {catalog.hasNextPage ? ' · loading ahead' : ''}
      </Text>
    </View>
  );

  if (catalog.isLoading) {
    return (
      <View className="flex-1">
        {header}
        <View className="flex-row flex-wrap justify-between">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1"
      data={items}
      key={view}
      numColumns={view === 'cards' ? 2 : 1}
      keyExtractor={(e) => e.sourceId}
      keyboardShouldPersistTaps="handled"
      onEndReachedThreshold={0.55}
      onEndReached={() => {
        if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
          catalog.fetchNextPage().catch(() => undefined);
        }
      }}
      columnWrapperClassName={view === 'cards' ? 'justify-between gap-sm' : undefined}
      contentContainerClassName="px-lg pb-xxl"
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <EmptyState title="No matches" body="Try another search or body part." />
      }
      renderItem={({ item }) =>
        view === 'cards' ? (
          <CardItem item={item} busy={busyId === item.sourceId} onAdd={() => addItem(item)} />
        ) : (
          <RowItem item={item} busy={busyId === item.sourceId} onAdd={() => addItem(item)} />
        )
      }
    />
  );
}
