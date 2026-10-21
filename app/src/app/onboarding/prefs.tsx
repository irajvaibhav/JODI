import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Chip, ErrorText, GradientButton, H1, Header, Loading, Progress, Screen, Sub } from '@/components/ui';
import { api } from '@/lib/api';
import { isEdit, useMeta } from '@/lib/meta';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

const DISTANCES = [[10, '10 km'], [25, '25 km'], [50, '50 km'], [100, '100 km'], [1000, 'Anywhere']] as const;

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const btn = (d: number, t: string) => (
    <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} hitSlop={8}
      style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.text, fontSize: 18 }}>{t}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {btn(-1, '−')}<Text style={{ color: C.text, fontSize: 22, fontWeight: '700', minWidth: 30, textAlign: 'center' }}>{value}</Text>{btn(1, '+')}
      </View>
    </View>
  );
}

export default function Prefs() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const edit = isEdit(params);
  const router = useRouter();
  const meta = useMeta();
  const { me, refresh } = useSession();
  const [p, setP] = useState({ genders: [] as string[], ageMin: 21, ageMax: 32, maxKm: 50, intent: null as string | null, ...(me?.preferences.genders.length ? me.preferences : {}) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/me/preferences', { method: 'PUT', body: p });
      await refresh();
      if (edit) router.back(); else router.push('/onboarding/astro');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (!meta) return <Screen><Loading /></Screen>;
  return (
    <Screen scroll>
      {edit ? <Header title="Dating preferences" /> : <Progress step={6} />}
      <H1>Who would you like to meet?</H1>
      <Sub>You can change this anytime in Settings.</Sub>
      <Text style={label}>Show me</Text>
      <View style={row}>
        {meta.genders.map(g => <Chip key={g} label={g} active={p.genders.includes(g)} onPress={() => setP({ ...p, genders: p.genders.includes(g) ? p.genders.filter(x => x !== g) : [...p.genders, g] })} />)}
      </View>
      <Text style={label}>Age range</Text>
      <View style={[row, { backgroundColor: C.surface, borderRadius: 18, padding: 14 }]}>
        <Stepper label="From" value={p.ageMin} min={18} max={p.ageMax} onChange={v => setP({ ...p, ageMin: v })} />
        <Stepper label="To" value={p.ageMax} min={p.ageMin} max={99} onChange={v => setP({ ...p, ageMax: v })} />
      </View>
      <Text style={label}>Maximum distance</Text>
      <View style={row}>
        {DISTANCES.map(([v, l]) => <Chip key={v} label={l} active={p.maxKm === v} onPress={() => setP({ ...p, maxKm: v })} />)}
      </View>
      <Text style={label}>I'm looking for</Text>
      <View style={row}>
        {meta.intents.map(i => <Chip key={i} label={i} active={p.intent === i} onPress={() => setP({ ...p, intent: i })} />)}
      </View>
      <ErrorText>{err}</ErrorText>
      <GradientButton title={edit ? 'Save' : 'Reveal my Astro Profile ✨'} onPress={save} loading={busy} disabled={!p.genders.length || !p.intent} style={{ marginTop: 10 }} />
    </Screen>
  );
}

const label = { color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 10 } as const;
const row = { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 } as const;
