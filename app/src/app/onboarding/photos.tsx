import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorText, GradientButton, H1, Header, Progress, Screen, Sub } from '@/components/ui';
import { api, imageForm, media } from '@/lib/api';
import { pickAndShrink } from '@/lib/images';
import { isEdit } from '@/lib/meta';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

export default function Photos() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const edit = isEdit(params);
  const router = useRouter();
  const { me, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photos = me?.photos ?? [];
  const ids = me?.photoIds ?? [];

  const add = async () => {
    setErr(null);
    const uri = await pickAndShrink();
    if (!uri) return;
    setBusy(true);
    try { await api('/me/photos', { form: imageForm('photo', uri) }); await refresh(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const remove = (i: number) => {
    if (edit && photos.length <= 2) return Alert.alert('Keep at least 2 photos', 'Add another photo before removing this one.');
    Alert.alert('Remove photo?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api(`/me/photos/${ids[i]}`, { method: 'DELETE' }); refresh(); } },
    ]);
  };

  const makeMain = async (i: number) => {
    if (i === 0) return;
    await api('/me/photos/order', { method: 'PUT', body: { ids: [ids[i], ...ids.filter((_, j) => j !== i)] } });
    refresh();
  };

  return (
    <Screen scroll>
      {edit ? <Header title="Photos" /> : <Progress step={3} />}
      <H1>Show your best side</H1>
      <Sub>Add 2–6 photos. Clear photos of your face get more Jodis. Tap a photo to make it your main one, long-press to remove.</Sub>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Pressable key={i} onPress={() => (photos[i] ? makeMain(i) : add())} onLongPress={() => photos[i] && remove(i)}
            style={{ width: '31%', aspectRatio: 0.8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderStyle: photos[i] ? 'solid' : 'dashed', borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
            {photos[i] ? <Image source={{ uri: media(photos[i]) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : busy && i === photos.length ? <ActivityIndicator color={C.lilac} /> : <Text style={{ color: C.lilac, fontSize: 28 }}>+</Text>}
            {i === 0 && photos[0] ? <Text style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: C.lilac, color: C.ink, fontSize: 10, paddingHorizontal: 6, borderRadius: 6, fontWeight: '700' }}>MAIN</Text> : null}
          </Pressable>
        ))}
      </View>
      <View style={{ height: 24 }} />
      <ErrorText>{err}</ErrorText>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>Photos are checked against our community guidelines before anyone sees them.</Text>
      <GradientButton title={edit ? 'Done' : 'Next'} disabled={photos.length < 2} onPress={() => (edit ? router.back() : router.push('/onboarding/profile'))} />
    </Screen>
  );
}
