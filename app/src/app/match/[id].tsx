import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GradientButton, Loading, OutlineButton, Screen } from '@/components/ui';
import { api, media, type Card } from '@/lib/api';
import { C, SIGN_EMOJI } from '@/lib/theme';

type Match = { id: string; me: Card; user: Card; vibe: { headline: string; reasons: string[] } };

const Avatar = ({ c }: { c: Card }) => (
  <View style={{ alignItems: 'center' }}>
    <Image source={{ uri: media(c.photos[0]) }} style={{ width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: C.lilac }} />
    {c.astro ? (
      <View style={{ marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff' }}>{SIGN_EMOJI[c.astro.sun]}</Text>
      </View>
    ) : null}
    <Text style={{ color: C.text, marginTop: 6 }}>{c.astro?.sun ?? c.name}</Text>
  </View>
);

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<Match | null>(null);
  useEffect(() => { api<Match>(`/matches/${id}`).then(setM).catch(() => router.back()); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return <Screen><Loading /></Screen>;
  const shared = m.me.interests.filter(i => m.user.interests.includes(i)).length;
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.pink, fontSize: 40 }}>✦</Text>
        <Text style={{ color: C.text, fontSize: 38, fontStyle: 'italic', fontWeight: '300', marginTop: 6 }}>IT'S A JODI ✨</Text>
        <Text style={{ color: C.muted, fontSize: 16, marginBottom: 30 }}>Your stars just aligned 🔥</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Avatar c={m.me} />
          <Avatar c={m.user} />
        </View>
        <Text style={{ color: C.text, textAlign: 'center', marginTop: 24, lineHeight: 22 }}>
          You and {m.user.name} share <Text style={{ fontWeight: '700', color: C.lilac }}>{m.user.compat?.overall}% cosmic compatibility</Text>
          {shared ? `\nand ${shared} common interest${shared > 1 ? 's' : ''}!` : '!'}
        </Text>
        <Text style={{ color: C.muted, textAlign: 'center', marginTop: 8, fontSize: 13 }}>{m.vibe.reasons[0]}</Text>
      </View>
      <GradientButton title="Chat Now" onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: m.id } })} />
      <OutlineButton title="Share your Jodi card ✨" style={{ marginTop: 12 }} onPress={() => router.push({ pathname: '/card/[id]', params: { id: m.id } })} />
      <Text onPress={() => router.back()} style={{ color: C.muted, textAlign: 'center', padding: 16 }}>Keep Exploring</Text>
    </Screen>
  );
}
