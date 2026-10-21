import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Set EXPO_PUBLIC_API_URL in .env (e.g. https://jodi-api.onrender.com). 10.0.2.2 = host machine from the Android emulator.
export const API = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000').replace(/\/$/, '');

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const getToken = () => token;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

// SecureStore has no web implementation; the web build is only a preview, so localStorage is fine there.
const web = Platform.OS === 'web';
export async function loadToken() {
  token = web ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (web) return t ? localStorage.setItem('token', t) : localStorage.removeItem('token');
  if (t) await SecureStore.setItemAsync('token', t);
  else await SecureStore.deleteItemAsync('token');
}

export const media = (p?: string | null) => (p ? (p.startsWith('http') ? p : API + p) : undefined);
/** Chat images need auth; profile images don't (but sending the header is harmless). */
export const authedImage = (p?: string | null) => (p ? { uri: media(p)!, headers: token ? { authorization: `Bearer ${token}` } : undefined } : undefined);

type Opts = { method?: string; body?: unknown; form?: FormData };

export async function api<T = any>(path: string, { method, body, form }: Opts = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API + path, {
      method: method ?? (body !== undefined || form ? 'POST' : 'GET'),
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('No internet connection. Please try again.');
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) onUnauthorized?.();
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data as T;
}

export function imageForm(field: string, uri: string, extra: Record<string, string> = {}) {
  const f = new FormData();
  f.append(field, { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
}

export const track = (name: string, props: Record<string, unknown> = {}) => { api('/events', { body: { name, props } }).catch(() => {}); };

export type Card = {
  id: string; name: string; age: number; city?: string; bio?: string; profession?: string; education?: string;
  interests: string[]; lifestyle: Record<string, string>; intent?: string; photos: string[]; distanceKm?: number | null;
  astro?: { sun: string; moon?: string; rising?: string | null; element?: string; nakshatra?: string | null } | null;
  compat?: { overall: number; astro: number; interests: number; personality: number; lifestyle: number; reasons: string[] };
};
