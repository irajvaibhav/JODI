import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Chip, ErrorText, Field, GradientButton, H1, Header, Loading, Progress, Screen, Sub } from '@/components/ui';
import { api, media } from '@/lib/api';
import { isEdit, useMeta } from '@/lib/meta';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

export default function Profile() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const edit = isEdit(params);
  const router = useRouter();
  const meta = useMeta();
  const { me, refresh } = useSession();
  const [f, setF] = useState({
    name: me?.name || '', gender: me?.gender || '', bio: me?.bio || '', city: me?.city || '',
    profession: me?.profession || '', education: me?.education || '', interests: me?.interests || [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: any) => setF({ ...f, [k]: v });
  const toggle = (i: string) => set('interests')(f.interests.includes(i) ? f.interests.filter(x => x !== i) : f.interests.length < 10 ? [...f.interests, i] : f.interests);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/me/profile', { method: 'PUT', body: f });
      await refresh();
      if (edit) router.back(); else router.push('/onboarding/personality');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (!meta) return <Screen><Loading /></Screen>;
  return (
    <Screen scroll>
      {edit ? <Header title="Edit Profile" /> : <Progress step={4} />}
      <H1>Create Your Profile</H1>
      <Sub>Tell us a little more about you (the fun part!). This helps us find your cosmic matches.</Sub>
      {me?.photos[0] ? (
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Image source={{ uri: media(me.photos[0]) }} style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: C.lilac }} />
          <Text onPress={() => router.push('/onboarding/photos?edit=1')} style={{ color: C.lilac, marginTop: 8 }}>Change Photo</Text>
        </View>
      ) : null}
      <Field label="Name" placeholder="Your first name" value={f.name} onChangeText={set('name')} maxLength={40} />
      <Text style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>I am a</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {meta.genders.map(g => <Chip key={g} label={g} active={f.gender === g} onPress={() => set('gender')(g)} />)}
      </View>
      <Field label="Bio" placeholder="Coffee lover | Dreamer | Books & Travel" value={f.bio} onChangeText={set('bio')} maxLength={300} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'right', marginTop: -10, marginBottom: 10 }}>{f.bio.length}/300</Text>
      <Field label="City you live in" placeholder="Delhi" value={f.city} onChangeText={set('city')} />
      <Field label="Profession (optional)" placeholder="Product Designer" value={f.profession} onChangeText={set('profession')} />
      <Field label="Education (optional)" placeholder="DU, B.Com" value={f.education} onChangeText={set('education')} />
      <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>Interests (pick 3–10) · {f.interests.length} selected</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {meta.interests.map(i => <Chip key={i} label={i} active={f.interests.includes(i)} onPress={() => toggle(i)} />)}
      </View>
      <ErrorText>{err}</ErrorText>
      <GradientButton title={edit ? 'Save' : 'Next'} onPress={save} loading={busy} disabled={!f.name.trim() || !f.gender || f.interests.length < 3 || !f.city.trim()} />
    </Screen>
  );
}
