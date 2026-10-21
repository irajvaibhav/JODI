import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession, useSocketEvent } from '@/lib/session';
import { C } from '@/lib/theme';

function Global() {
  const router = useRouter();
  const { me } = useSession();
  // Someone Jodi'd us back while we're in the app -> celebrate immediately.
  useSocketEvent<{ matchId: string }>('match', ({ matchId }) => router.push({ pathname: '/match/[id]', params: { id: matchId } }));
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(r => {
      const d = r.notification.request.content.data as any;
      if (!me?.onboarded) return;
      if (d?.type === 'message' && d.matchId) router.push({ pathname: '/chat/[id]', params: { id: d.matchId } });
      else if (d?.type === 'match' && d.matchId) router.push({ pathname: '/match/[id]', params: { id: d.matchId } });
      else if (d?.type === 'like') router.push('/likes');
      else if (d?.type === 'daily') router.push('/daily');
    });
    return () => sub.remove();
  }, [me?.onboarded, router]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SessionProvider>
        <StatusBar style="light" />
        <Global />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="match/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        </Stack>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
