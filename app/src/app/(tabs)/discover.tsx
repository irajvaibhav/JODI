import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Chip, ErrorText, GradientButton, Loading, Logo, Screen } from '@/components/ui';
import { NextCardPeek, SwipeCard, type SwipeHandle } from '@/components/SwipeCard';
import { api, track, type Card } from '@/lib/api';
import { C } from '@/lib/theme';

const FILTERS = [['all', 'All'], ['same_zodiac', 'Same Zodiac'], ['kundli', 'Kundli Match'], ['hobbies', 'Hobbies']] as const;

const Quick = ({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFE9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
      <Text style={{ color: C.purple, fontSize: 16 }}>{glyph}</Text>
    </View>
    <Text style={{ color: C.ink, fontSize: 11 }}>{label}</Text>
  </Pressable>
);

const RoundBtn = ({ glyph, onPress, bg, color, size = 56, label }: { glyph: string; onPress: () => void; bg: string; color: string; size?: number; label: string }) => (
  <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 }}>
    <Text style={{ color, fontSize: size * 0.42, fontWeight: '700' }}>{glyph}</Text>
  </Pressable>
);

export default function Discover() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [cards, setCards] = useState<Card[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const handle = useRef<SwipeHandle | null>(null);

  const fetchCards = useCallback((f: string) => api<Card[]>(`/discover?filter=${f}`)
    .then(c => { setCards(c); setErr(null); })
    .catch(e => { setErr(e.message); setCards([]); }), []);
  const load = (f = filter) => { setCards(null); fetchCards(f); };

  useEffect(() => { fetchCards(filter); }, [filter, fetchCards]);

  const top = cards?.[0];
  const onSwiped = async (dir: 'left' | 'right') => {
    if (!top) return;
    setCards(c => c?.slice(1) ?? null);
    try {
      const r = await api<{ matched: boolean; matchId?: string }>('/swipe', { body: { targetId: top.id, action: dir === 'right' ? 'jodi' : 'pass' } });
      if (r.matched && r.matchId) router.push({ pathname: '/match/[id]', params: { id: r.matchId } });
    } catch (e: any) { setErr(e.message); }
    if (cards && cards.length <= 3) api<Card[]>(`/discover?filter=${filter}`).then(more => setCards(c => [...(c ?? []), ...more.filter(m => !c?.some(x => x.id === m.id) && m.id !== top.id)])).catch(() => {});
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 26 }} />
        <Logo size={28} />
        <Pressable onPress={() => router.push('/me')} hitSlop={10}><Text style={{ color: C.text, fontSize: 20 }}>⚙</Text></Pressable>
      </View>

      <LinearGradient colors={['#F8E1F4', '#DCCBFF', '#B9A4FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 14, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontSize: 12, fontWeight: '600' }}>Your Cosmic Match Score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: C.ink, fontSize: 32, fontWeight: '300' }}>{top?.compat ? `${top.compat.overall}%` : '—'}</Text>
            <Text style={{ color: C.inkMuted, fontSize: 11, flex: 1 }}>{top?.compat ? top.compat.reasons[0] : 'Swipe to discover people you might vibe with'}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 36, opacity: 0.6 }}>🔮</Text>
      </LinearGradient>

      <View style={{ backgroundColor: '#fff', borderRadius: 18, marginTop: 10, flexDirection: 'row' }}>
        <Quick glyph="♥" label="Matches" onPress={() => router.push('/chats')} />
        <Quick glyph="✺" label="Daily Cosmic" onPress={() => router.push('/daily')} />
        <Quick glyph="☾" label="Astro Insights" onPress={() => router.push('/onboarding/astro?view=1')} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 10 }}>
        {FILTERS.map(([k, l]) => <Chip key={k} label={l} active={filter === k} onPress={() => { if (k !== filter) { setCards(null); setFilter(k); } }} />)}
      </View>

      <View style={{ flex: 1, marginBottom: 76 }}>
        {cards === null ? <Loading /> : top ? (
          <>
            <NextCardPeek card={cards[1]} />
            <SwipeCard key={top.id} card={top} handleRef={handle} onSwiped={onSwiped}
              onOpen={() => { track('card_opened'); router.push({ pathname: '/user/[id]', params: { id: top.id } }); }} />
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 48 }}>🌙</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginVertical: 8, textAlign: 'center' }}>You've seen everyone for now</Text>
            <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 20 }}>Try another filter, widen your preferences, or come back tomorrow for your Daily Cosmic Jodi.</Text>
            <ErrorText>{err}</ErrorText>
            <GradientButton title="Widen preferences" onPress={() => router.push('/onboarding/prefs?edit=1')} style={{ alignSelf: 'stretch' }} />
            <Text onPress={() => load()} style={{ color: C.lilac, marginTop: 16 }}>Refresh</Text>
          </View>
        )}
      </View>

      {top ? (
        <View style={{ position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22 }}>
          <RoundBtn glyph="✕" label="Pass" bg="#fff" color={C.green} onPress={() => handle.current?.swipe('left')} />
          <RoundBtn glyph="★" label="Why you might vibe" bg="#FFD66B" color="#fff" size={48} onPress={() => router.push({ pathname: '/user/[id]', params: { id: top.id } })} />
          <RoundBtn glyph="✦" label="Jodi" bg={C.lilac} color="#fff" onPress={() => handle.current?.swipe('right')} />
        </View>
      ) : null}
    </Screen>
  );
}
