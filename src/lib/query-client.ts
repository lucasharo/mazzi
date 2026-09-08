import { QueryClient, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/query-persist-client-core';

export const CACHE_POLICY = {
  long: {
    staleTime: 10 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
  },
  short: {
    staleTime: 45 * 1_000,
    gcTime: 30 * 60 * 1_000,
  },
  nextLesson: {
    staleTime: 20 * 1_000,
    gcTime: 15 * 60 * 1_000,
  },
  critical: {
    staleTime: 0,
    gcTime: 5 * 60 * 1_000,
  },
} as const;

const QUERY_CACHE_DB = 'mazzi-query-cache';
const QUERY_CACHE_STORE = 'persisted-client';

function openQueryCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUERY_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(QUERY_CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB indisponível'));
  });
}

const indexedDbStorage = typeof indexedDB === 'undefined'
  ? undefined
  : {
      getItem: async (key: string) => {
        const db = await openQueryCacheDb();
        return new Promise<string | null>((resolve, reject) => {
          const request = db.transaction(QUERY_CACHE_STORE, 'readonly').objectStore(QUERY_CACHE_STORE).get(key);
          request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
          request.onerror = () => reject(request.error || new Error('Não foi possível ler o cache persistido'));
        });
      },
      setItem: async (key: string, value: string) => {
        const db = await openQueryCacheDb();
        return new Promise<void>((resolve, reject) => {
          const request = db.transaction(QUERY_CACHE_STORE, 'readwrite').objectStore(QUERY_CACHE_STORE).put(value, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error || new Error('Não foi possível persistir o cache'));
        });
      },
      removeItem: async (key: string) => {
        const db = await openQueryCacheDb();
        return new Promise<void>((resolve, reject) => {
          const request = db.transaction(QUERY_CACHE_STORE, 'readwrite').objectStore(QUERY_CACHE_STORE).delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error || new Error('Não foi possível remover o cache persistido'));
        });
      },
    };

const appScope = (import.meta.env.MODE === 'instructor' ? 'provider' : import.meta.env.MODE === 'student' ? 'student' : 'web');

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 30 * 60 * 1_000,
      retry: (failureCount) => failureCount < 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryPersister: Persister = createAsyncStoragePersister({
  storage: indexedDbStorage,
  key: `mazzi-query-cache-v1-${appScope}`,
  throttleTime: 1_000,
});

export function shouldPersistQuery(query: Query): boolean {
  return query.meta?.persist === true;
}
