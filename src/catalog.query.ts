import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { queryClient } from './query';

export type CatalogItem = {
  sourceId: string;
  name: string;
  imageUrl: string | null;
  videoUrl: string | null;
  muscleGroup: string;
  equipment: string | null;
  inLibrary?: boolean;
};

export type CatalogPage = {
  items: CatalogItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export function catalogKey(search: string, bodyPart: string | null) {
  return ['catalog', search.trim(), bodyPart ?? ''] as const;
}

export function useBodyParts(token: string | null) {
  return useQuery({
    queryKey: ['catalog-bodyparts'],
    queryFn: () => api<string[]>('/exercises/catalog/bodyparts', { token }),
    enabled: !!token,
    staleTime: 60 * 60_000,
  });
}

export function useCatalogInfinite(
  token: string | null,
  search: string,
  bodyPart: string | null,
) {
  return useInfiniteQuery({
    queryKey: catalogKey(search, bodyPart),
    enabled: !!token,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      else if (bodyPart) qs.set('bodyPart', bodyPart);
      if (pageParam) qs.set('after', pageParam);
      return api<CatalogPage>(`/exercises/catalog?${qs}`, { token });
    },
    getNextPageParam: (last) => (last.hasNextPage ? last.nextCursor ?? undefined : undefined),
  });
}

export function markCatalogInLibrary(sourceId: string) {
  queryClient.setQueriesData({ queryKey: ['catalog'] }, (old: unknown) => {
    const data = old as { pages: CatalogPage[]; pageParams: unknown[] } | undefined;
    if (!data?.pages) return old;
    return {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.map((i) => (i.sourceId === sourceId ? { ...i, inLibrary: true } : i)),
      })),
    };
  });
}
