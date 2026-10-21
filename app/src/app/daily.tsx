import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ErrorText, Header, Loading, Screen } from '@/components/ui';
import { api, media, type Card } from '@/lib/api';
import { C } from '@/lib/theme';

type Daily = { day: string; title: string; message: string; loveTip: string; why: string; jodi: Card | null; highlights: { bestSigns: string[]; luckyColor: string; luckyNumber: number } };

const Highlight = ({ glyph, bg, title, value }: { glyph: string; bg: string; title: string; value: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EDF8' }}>
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text>{glyph}</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.ink, fontSize: 13, fontWeight: '600' }}>{title}</Text>
      <Text style={{ color: C.inkMuted, fontSize: 12 }}>{value}</Text>
    </View>
  </View>
);

export default function DailyCosmic() {
  const router = useRouter();
  const [d, setD] = useState<Daily | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Daily>('/daily').then(setD).catch(e => setErr(e.message)); }, []);

  if (!d) return <Screen>{err ? <><Header /><ErrorText>{err}</ErrorText></> : <Loading />}</Screen>;
  const date = new Date(d.day).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Screen scroll>
      <Header title="Your Daily Cosmic" />
      <Text style={{ color: C.muted, textAlign: 'center', marginTop: -6, marginBottom: 14 }}>{date}</Text>
      <LinearGradient colors={['#FBD3EE', '#F3B5E3', '#D9C3FF']} style={{ borderRadius: 22, padding: 18, marginBottom: 14 }}>
        <Text style={{ fontSize: 26 }}>💛</Text>
        <Text style={{ color: C.ink, fontSize: 18, fontWeight: '700', marginTop: 6 }}>{d.title}</Text>
        <Text style={{ color: C.ink, marginTop: 6, lineHeight: 20 }}>{d.message}</Text>
      </LinearGradient>

      {d.jodi ? (
        <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: d.jodi!.id } })} style={{ backgroundColor: C.surface, borderRadius: 22, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center', borderWidth: 1, borderColor: C.lilac, marginBottom: 14 }}>
          <Image source={{ uri: media(d.jodi.photos[0]) }} style={{ width: 76, height: 92, borderRadius: 14 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.lilac, fontSize: 12, fontWeight: '700' }}>TODAY'S COSMIC JODI ✨</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{d.jodi.name}, {d.jodi.age}</Text>
            <Text style={{ color: C.text }}>{d.jodi.compat?.overall}% cosmic match</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{d.why || d.jodi.compat?.reasons[0]}</Text>
          </View>
          <Text style={{ color: C.lilac, fontSize: 22 }}>›</Text>
        </Pressable>
      ) : (
        <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 14 }}>No Cosmic Jodi today — check back tomorrow ✨</Text>
      )}

      <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 16 }}>
        <Text style={{ color: C.ink, fontWeight: '700', marginBottom: 4 }}>Today's Highlights</Text>
        {d.highlights.bestSigns.length ? <Highlight glyph="✦" bg="#FFF2CC" title="Best Match Signs" value={d.highlights.bestSigns.join(', ')} /> : null}
        <Highlight glyph="🎨" bg="#EFE9FF" title="Lucky Color" value={d.highlights.luckyColor} />
        <Highlight glyph={String(d.highlights.luckyNumber)} bg="#E3EEFF" title="Lucky Number" value={String(d.highlights.luckyNumber)} />
        <Highlight glyph="💗" bg="#FFE3F1" title="Love Tip" value={d.loveTip} />
      </View>
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 14 }}>For fun & reflection — not a prediction.</Text>
    </Screen>
  );
}
