import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorText, GradientButton, H1, Header, Loading, Progress, Screen, Sub } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { C, SIGN_EMOJI } from '@/lib/theme';

type Astro = { sun: string; moon: string; rising: string | null; nakshatra: string | null; timeKnown: boolean; summary: string; inLove: string; bestWith: string[] };

const Tile = ({ label, value, hint }: { label: string; value?: string | null; hint: string }) => (
  <View style={{ width: '48%', backgroundColor: C.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border }}>
    <Text style={{ color: C.muted, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginVertical: 4 }}>{value ? `${SIGN_EMOJI[value] ?? '✦'} ${value}` : '—'}</Text>
    <Text style={{ color: C.muted, fontSize: 11 }}>{hint}</Text>
  </View>
);

export default function AstroProfile() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const router = useRouter();
  const { refresh } = useSession();
  const [a, setA] = useState<Astro | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { setErr(null); api<Astro>('/me/astro').then(setA).catch(e => setErr(e.message)); }, []));

  const finish = async () => {
    setBusy(true); setErr(null);
    try { await api('/me/complete', { method: 'POST' }); await refresh(); router.replace('/discover'); } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  if (!a) return (
    <Screen>
      {err ? (
        <>
          <Header title={view ? 'Astro Insights' : undefined} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 44, textAlign: 'center', color: C.lilac, marginBottom: 12 }}>✦</Text>
            <ErrorText>{err}</ErrorText>
            <GradientButton title="Add birth details" onPress={() => router.push('/onboarding/birth?edit=1')} />
          </View>
        </>
      ) : <Loading />}
    </Screen>
  );
  return (
    <Screen scroll>
      {view ? <Header title="Astro Insights" /> : <Progress step={7} />}
      <Text style={{ fontSize: 44, textAlign: 'center', color: C.lilac, marginTop: 8 }}>✦</Text>
      <H1 center>Your Astro Profile</H1>
      <Sub center>Here's what the stars say about you — in plain words.</Sub>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 }}>
        <Tile label="Sun sign" value={a.sun} hint="Your core personality" />
        <Tile label="Moon sign (Rashi)" value={a.moon} hint={a.timeKnown ? 'How you feel & love' : 'Approximate (no birth time)'} />
        <Tile label="Rising sign (Lagna)" value={a.rising} hint={a.rising ? 'How others see you' : 'Needs birth time'} />
        <Tile label="Nakshatra" value={a.nakshatra} hint="Your lunar mansion" />
      </View>
      <View style={{ backgroundColor: C.card, borderRadius: 22, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: C.ink, fontWeight: '700', marginBottom: 6 }}>✨ You, in a nutshell</Text>
        <Text style={{ color: C.inkMuted, lineHeight: 20 }}>{a.summary}</Text>
        <Text style={{ color: C.ink, fontWeight: '700', marginTop: 14, marginBottom: 6 }}>💜 In love</Text>
        <Text style={{ color: C.inkMuted, lineHeight: 20 }}>{a.inLove}</Text>
        {a.bestWith?.length ? <Text style={{ color: C.inkMuted, marginTop: 12 }}>Often clicks with: <Text style={{ color: C.purple, fontWeight: '600' }}>{a.bestWith.join(', ')}</Text></Text> : null}
      </View>
      <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
        🔒 Others only see your Sun, Moon and Rising signs — never your birth date, time or place. Astrology is one signal among many, not a prediction.
      </Text>
      <ErrorText>{err}</ErrorText>
      {view ? null : <GradientButton title="Start discovering" onPress={finish} loading={busy} />}
    </Screen>
  );
}
