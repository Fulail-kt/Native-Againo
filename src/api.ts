import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { explain } from './err';

function defaultBase() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:3000`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

export const API_BASE = defaultBase();
const API = API_BASE;

if (!__DEV__ && !/^https:\/\//i.test(API)) {
  throw new Error('Release builds must use HTTPS.');
}

type Options = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

function messageOf(data: unknown): unknown {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as { message?: unknown; error?: unknown; conflicts?: unknown };
  if (d.message != null) return d.message;
  if (typeof d.error === 'string') return d.error;
  return undefined;
}

function conflictsOf(data: unknown) {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as { conflicts?: unknown; message?: { conflicts?: unknown } };
  if (Array.isArray(d.conflicts)) return d.conflicts;
  if (Array.isArray(d.message?.conflicts)) return d.message.conflicts;
  return undefined;
}

function fail(status: number, data: unknown): never {
  const err = new Error(explain(messageOf(data) || statusHint(status))) as Error & {
    conflicts?: unknown;
  };
  const conflicts = conflictsOf(data);
  if (conflicts) err.conflicts = conflicts;
  throw err;
}

function statusHint(status: number) {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return 'You’re not allowed to do that.';
  if (status === 404) return 'Nothing found for that.';
  if (status >= 500) return 'Server error. Try again in a moment.';
  return 'Something went wrong. Try again.';
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Can’t reach the server. Check your connection.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(res.status, data);
  return data as T;
}

export function photoUrl(shopId: number, customerId: number, file: string) {
  if (/^https?:\/\//i.test(file)) return file;
  return `${API}/uploads/s${shopId}/c${customerId}/${encodeURIComponent(file)}`;
}

export async function apiUpload<T = any>(
  path: string,
  token: string,
  file: { uri: string; name: string; type: string },
): Promise<T> {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error('Can’t reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(res.status, data);
  return data as T;
}
