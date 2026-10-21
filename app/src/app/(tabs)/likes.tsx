import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { GradientButton, Loading, OutlineButton, Screen } from '@/components/ui';
import { api, media, type Card } from '@/lib/api';
import { C, SIGN_EMOJI } from '@/lib/theme';

export default function Likes() {
  const router = useRouter();
  const [likes, setLikes] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => { api<Card[]>('/likes').then(setLikes).catch(() => setLikes([])); }, []));

  const likeBack = async (c: Card) => {
    setBusy(true);
    try {
      const r = await api<{ matched: boolean; matchId?: string }>('/swipe', { body: { targetId: c.id, action: 'jodi' } });
      setLikes(l => l?.filter(x => x.id !== c.id) ?? null);
      if (r.matchId) router.push({ pathname: '/match/[id]', params: { id: r.matchId } });
    } finally { setBusy(false); }
  };

  if (!likes) return <Screen><Loading /></Screen>;
  const [hero, ...rest] = likes;
  if (!hero) return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 48 }}>💫</Text>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginVertical: 8 }}>No new likes yet</Text>
        <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 20 }}>When someone sends you a Jodi, they'll show up here.</Text>
        <GradientButton title="Keep discovering" onPress={() => router.push('/discover')} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', paddingTop: 16 }}>
        <Text style={{ color: C.pink, fontSize: 36 }}>✦</Text>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: '700', textAlign: 'center', marginTop: 6 }}>Someone's Interested in You!</Text>
        <Text style={{ color: C.muted, marginTop: 8, marginBottom: 22 }}>{hero.name}, {hero.age}, liked your profile.</Text>
        <Image source={{ uri: media(hero.photos[0]) }} style={{ width: 170, height: 170, borderRadius: 85, borderWidth: 3, borderColor: C.lilac }} />
        {hero.astro ? <Text style={{ color: C.text, marginTop: 12 }}>{SIGN_EMOJI[hero.astro.sun]} {hero.astro.sun}{hero.compat ? `  ·  ${hero.compat.overall}% match` : ''}</Text> : null}
      </View>
      <GradientButton title="Like Back" loading={busy} onPress={() => likeBack(hero)} style={{ marginTop: 26 }} />
      <OutlineButton title="View Profile" onPress={() => router.push({ pathname: '/user/[id]', params: { id: hero.id } })} style={{ marginTop: 12 }} />

      {rest.length ? <Text style={{ color: C.text, fontSize: 17, fontWeight: '700', marginTop: 30, marginBottom: 12 }}>Also liked you · {rest.length}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {rest.map(c => (
          <Pressable key={c.id} onPress={() => router.push({ pathname: '/user/[id]', params: { id: c.id } })} style={{ marginRight: 12, width: 120 }}>
            <Image source={{ uri: media(c.photos[0]) }} style={{ width: 120, height: 150, borderRadius: 16 }} />
            <Text style={{ color: C.text, marginTop: 6 }}>{c.name}, {c.age}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{c.compat?.overall}% match</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
