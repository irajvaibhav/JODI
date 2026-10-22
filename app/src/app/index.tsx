import { Redirect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { GradientButton, Loading, Logo, Screen } from '@/components/ui';
import { nextOnboardingStep, useSession } from '@/lib/session';
import { C } from '@/lib/theme';

const STARS = Array.from({ length: 40 }, (_, i) => ({ top: (i * 37) % 70, left: (i * 53) % 100, size: (i % 3) + 1 }));

export default function Splash() {
  const { ready, signedIn, me, refresh } = useSession();
  const router = useRouter();
  if (!ready) return <Screen><Loading /></Screen>;
  // Signed in but /me failed (server waking up, bad network): offer a retry instead of spinning forever.
  if (signedIn && !me) return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 20 }}>Couldn't reach Jodi. Check your connection and try again.</Text>
        <GradientButton title="Try again" onPress={refresh} />
      </View>
    </Screen>
  );
  if (signedIn && me) return <Redirect href={(me.onboarded ? '/discover' : nextOnboardingStep(me)) as any} />;

  return (
    <Screen>
      {STARS.map((s, i) => <View key={i} style={{ position: 'absolute', top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, borderRadius: 2, backgroundColor: '#fff', opacity: 0.6 }} />)}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Logo size={64} />
        <Text style={{ color: C.text, textAlign: 'center', fontSize: 16, marginTop: 12 }}>Same Stars. Better Matches.</Text>
        <Text style={{ color: C.muted, textAlign: 'center', fontSize: 13, marginTop: 8 }}>Dating, written in the stars.</Text>
      </View>
      <Text style={{ fontSize: 72, textAlign: 'center', marginBottom: 24, color: C.pink, opacity: 0.85 }}>☾ ✦</Text>
      <GradientButton title="Get Started" onPress={() => router.push('/login')} />
      <Pressable onPress={() => router.push('/login')} style={{ padding: 18 }}>
        <Text style={{ color: C.muted, textAlign: 'center' }}>Already have an account? <Text style={{ color: C.lilac }}>Log In</Text></Text>
      </Pressable>
    </Screen>
  );
}
