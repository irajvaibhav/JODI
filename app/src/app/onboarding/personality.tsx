import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Chip, ErrorText, GradientButton, H1, Header, Loading, Progress, Screen, Sub } from '@/components/ui';
import { api } from '@/lib/api';
import { isEdit, useMeta } from '@/lib/meta';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

export default function Personality() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const edit = isEdit(params);
  const router = useRouter();
  const meta = useMeta();
  const { me, refresh } = useSession();
  const [answers, setAnswers] = useState<Record<string, number>>(me?.personality || {});
  const [life, setLife] = useState<Record<string, string>>(me?.lifestyle || {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!meta) return <Screen><Loading /></Screen>;
  const done = meta.personality.every(p => answers[p.key]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/me/profile', { method: 'PUT', body: { personality: answers, lifestyle: life } });
      await refresh();
      if (edit) router.back(); else router.push('/onboarding/prefs');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <Screen scroll>
      {edit ? <Header title="Personality & lifestyle" /> : <Progress step={5} />}
      <H1>Your vibe check ✨</H1>
      <Sub>Quick, no wrong answers. We use this with your stars to explain why you might vibe with someone.</Sub>
      {meta.personality.map(p => (
        <View key={p.key} style={{ marginBottom: 22 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 10 }}>{p.q}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(v => (
              <Pressable key={v} onPress={() => setAnswers({ ...answers, [p.key]: v })} hitSlop={6} accessibilityLabel={`${p.q} ${v} of 5`}
                style={{ width: 22 + Math.abs(3 - v) * 6, height: 22 + Math.abs(3 - v) * 6, borderRadius: 30, borderWidth: 2, borderColor: v < 3 ? C.purple : v > 3 ? C.hot : C.muted, backgroundColor: answers[p.key] === v ? (v < 3 ? C.purple : v > 3 ? C.hot : C.muted) : 'transparent' }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>{p.low}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{p.high}</Text>
          </View>
        </View>
      ))}
      <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginVertical: 10 }}>Lifestyle</Text>
      {Object.entries(meta.lifestyle).map(([k, v]) => (
        <View key={k} style={{ marginBottom: 14 }}>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>{v.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {v.options.map(o => <Chip key={o} label={o} active={life[k] === o} onPress={() => setLife({ ...life, [k]: o })} />)}
          </View>
        </View>
      ))}
      <ErrorText>{err}</ErrorText>
      <GradientButton title={edit ? 'Save' : 'Next'} onPress={save} loading={busy} disabled={!done} style={{ marginTop: 10 }} />
    </Screen>
  );
}
