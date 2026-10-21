import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { io, type Socket } from 'socket.io-client';
import { API, api, loadToken, saveToken, setUnauthorizedHandler } from './api';

export type Me = {
  id: string; name?: string; age?: number; city?: string; bio?: string; gender?: string; profession?: string; education?: string;
  interests: string[]; lifestyle: Record<string, string>; personality: Record<string, number>; photos: string[]; photoIds: string[];
  astro?: { sun: string; moon?: string; rising?: string | null; nakshatra?: string | null } | null;
  onboarded: boolean; discoverable: boolean; dob?: string; birth?: { dob: string; time: string | null; place: string | null } | null;
  preferences: { genders: string[]; ageMin: number; ageMax: number; maxKm: number; intent?: string | null };
  notif: { matches: boolean; messages: boolean; daily: boolean; quietStart: number | null; quietEnd: number | null };
  phone?: string; email?: string;
};

type Ctx = {
  ready: boolean; signedIn: boolean; me: Me | null; socket: Socket | null;
  refresh: () => Promise<Me | null>; signIn: (token: string) => Promise<Me | null>; signOut: () => Promise<void>;
};
const SessionCtx = createContext<Ctx>(null as any);
export const useSession = () => useContext(SessionCtx);

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

async function registerPush() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return; // set after `eas init`
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api('/me/settings', { method: 'PUT', body: { pushToken } });
  } catch (e) {
    console.warn('push registration failed', e);
  }
}

/** Where an unfinished user should resume onboarding. */
export function nextOnboardingStep(me: Me): string {
  if (!me.dob) return '/onboarding/age';
  if (me.photos.length < 2) return '/onboarding/photos';
  if (!me.name || !me.gender || me.interests.length < 3) return '/onboarding/profile';
  if (!Object.keys(me.personality || {}).length) return '/onboarding/personality';
  if (!me.preferences.genders.length) return '/onboarding/prefs';
  return '/onboarding/astro';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const pushed = useRef(false);

  const refresh = useCallback(async () => {
    try { const m = await api<Me>('/me'); setMe(m); return m; } catch { return null; }
  }, []);

  const connect = useCallback((token: string) => {
    const s = io(API, { auth: { token }, transports: ['websocket'] });
    setSocket(s);
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    await saveToken(null);
    socket?.disconnect();
    setSocket(null); setMe(null); setSignedIn(false); pushed.current = false;
  }, [socket]);

  const signIn = useCallback(async (token: string) => {
    await saveToken(token);
    setSignedIn(true);
    connect(token);
    return refresh();
  }, [connect, refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => { saveToken(null); setSignedIn(false); setMe(null); });
    (async () => {
      const t = await loadToken();
      if (t) { setSignedIn(true); connect(t); await refresh(); }
      setReady(true);
    })();
  }, [connect, refresh]);

  useEffect(() => {
    if (me?.onboarded && !pushed.current) { pushed.current = true; registerPush(); }
  }, [me?.onboarded]);

  return <SessionCtx.Provider value={{ ready, signedIn, me, socket, refresh, signIn, signOut }}>{children}</SessionCtx.Provider>;
}

export function useSocketEvent<T = any>(event: string, handler: (data: T) => void) {
  const { socket } = useSession();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!socket) return;
    const fn = (d: T) => ref.current(d);
    socket.on(event, fn);
    return () => { socket.off(event, fn); };
  }, [socket, event]);
}
