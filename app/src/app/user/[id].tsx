import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorText, GradientButton, Loading, OutlineButton, ScoreBar } from '@/components/ui';
import { SafetyMenu } from '@/components/SafetyMenu';
import { api, media, type Card } from '@/lib/api';
import { C, SIGN_EMOJI } from '@/lib/theme';

type Detail = Card & { vibe: { headline: string; reasons: string[]; tip: string }; swiped: string | null; matchId: string | null };
const W = Dimensions.get('window').width;
const TABS = ['Astro', 'Personality', 'Hobbies'] as const;

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [u, setU] = useState<Detail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Astro');
  const [photo, setPhoto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api<Detail>(`/users/${id}`).then(setU).catch(e => setErr(e.message)); }, [id]);

  const swipe = async (action: 'jodi' | 'pass') => {
    setBusy(true);
    try {
      const r = await api<{ matched: boolean; matchId?: string }>('/swipe', { body: { targetId: id, action } });
      if (r.matched && r.matchId) router.replace({ pathname: '/match/[id]', params: { id: r.matchId } });
      else router.back();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  if (!u) return <View style={{ flex: 1, backgroundColor: C.cardSoft, justifyContent: 'center' }}>{err ? <ErrorText>{err}</ErrorText> : <Loading />}</View>;
  const c = u.compat!;
  const tabBody = {
    Astro: (
      <>
        <ScoreBar dark label="Astro" value={c.astro} />
        {u.astro ? <Text style={{ color: C.inkMuted, marginBottom: 6 }}>{SIGN_EMOJI[u.astro.sun]} Sun in {u.astro.sun}{u.astro.moon ? ` · ☾ Moon in ${u.astro.moon}` : ''}{u.astro.rising ? ` · ↑ ${u.astro.rising} rising` : ''}{u.astro.nakshatra ? ` · ${u.astro.nakshatra} nakshatra` : ''}</Text> : null}
      </>
    ),
    Personality: (
      <>
        <ScoreBar dark label="Personality" value={c.personality} />
        <ScoreBar dark label="Lifestyle" value={c.lifestyle} />
        <Text style={{ color: C.inkMuted }}>{Object.values(u.lifestyle || {}).join(' · ')}{u.intent ? `\nLooking for: ${u.intent}` : ''}</Text>
      </>
    ),
    Hobbies: (
      <>
        <ScoreBar dark label="Interests" value={c.interests} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {u.interests.map(i => <Text key={i} style={{ backgroundColor: '#EFE9FF', color: C.purple, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, fontSize: 12 }}>{i}</Text>)}
        </View>
      </>
    ),
  }[tab];

  return (
    <View style={{ flex: 1, backgroundColor: C.cardSoft }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ width: W, height: W * 1.05 }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={e => setPhoto(Math.round(e.nativeEvent.contentOffset.x / W))}>
            {u.photos.map(p => <Image key={p} source={{ uri: media(p) }} style={{ width: W, height: W * 1.05 }} contentFit="cover" />)}
          </ScrollView>
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }} />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ color: '#fff', fontSize: 30 }}>‹</Text></Pressable>
            <SafetyMenu userId={u.id} name={u.name} matchId={u.matchId} onDone={() => router.replace('/discover')} />
          </SafeAreaView>
          <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 5 }}>
            {u.photos.map((p, i) => <View key={p} style={{ width: i === photo ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: '#fff', opacity: i === photo ? 1 : 0.6 }} />)}
          </View>
        </View>

        <View style={{ backgroundColor: '#fff', marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
          <Text style={{ color: C.ink, fontSize: 24, fontWeight: '700' }}>{u.name}, {u.age}</Text>
          <Text style={{ color: C.inkMuted, marginBottom: 8 }}>📍 {u.distanceKm != null ? `${u.distanceKm} km away · ` : ''}{u.city}{u.profession ? ` · ${u.profession}` : ''}</Text>
          {u.bio ? <Text style={{ color: C.ink, marginBottom: 12, lineHeight: 20 }}>{u.bio}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <View style={{ backgroundColor: '#EFE9FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 }}><Text style={{ color: C.purple, fontWeight: '700' }}>{c.overall}% Overall Compatibility</Text></View>
          </View>
          <Text style={{ color: C.inkMuted, fontSize: 12, marginBottom: 14 }}>Astro {c.astro}% · Interests {c.interests}% · Personality {c.personality}% · Lifestyle {c.lifestyle}%</Text>

          <View style={{ flexDirection: 'row', backgroundColor: C.cardSoft, borderRadius: 20, padding: 4, marginBottom: 14 }}>
            {TABS.map(t => (
              <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 8, borderRadius: 16, backgroundColor: tab === t ? C.ink : 'transparent' }}>
                <Text style={{ textAlign: 'center', color: tab === t ? '#fff' : C.inkMuted, fontWeight: '600', fontSize: 13 }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {tabBody}

          <Text style={{ color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 4 }}>Why You Might Vibe</Text>
          <Text style={{ color: C.purple, marginBottom: 10 }}>{u.vibe.headline}</Text>
          {u.vibe.reasons.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <Text style={{ color: [C.green, C.purple, C.green, C.hot][i % 4], fontSize: 16 }}>●</Text>
              <Text style={{ color: C.ink, flex: 1, lineHeight: 20 }}>{r}</Text>
            </View>
          ))}
          <LinearGradient colors={['#FBEFFA', '#EEE6FF']} style={{ borderRadius: 18, padding: 16, marginTop: 10, flexDirection: 'row', gap: 12 }}>
            <Text style={{ fontSize: 22, color: C.purple }}>✧</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '700', marginBottom: 2 }}>Cosmic Tip</Text>
              <Text style={{ color: C.inkMuted }}>{u.vibe.tip}</Text>
            </View>
          </LinearGradient>
          <Text style={{ color: C.inkMuted, fontSize: 11, marginTop: 14, textAlign: 'center' }}>Compatibility is a fun discovery signal, not a guarantee.</Text>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: '#fff', flexDirection: 'row', gap: 12 }}>
        {u.matchId ? (
          <GradientButton title="Open chat" style={{ flex: 1 }} onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: u.matchId! } })} />
        ) : u.swiped === 'jodi' ? (
          <Text style={{ flex: 1, textAlign: 'center', color: C.inkMuted, paddingVertical: 16 }}>You sent a Jodi ✨ Waiting for them…</Text>
        ) : (
          <>
            <OutlineButton dark title="Pass" style={{ flex: 1 }} onPress={() => swipe('pass')} />
            <GradientButton title="Jodi ✨" style={{ flex: 2 }} loading={busy} onPress={() => swipe('jodi')} />
          </>
        )}
      </View>
    </View>
  );
}
