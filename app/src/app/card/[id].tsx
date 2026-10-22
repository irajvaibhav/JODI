import { useEffect, useRef, useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GradientButton, Header, Loading, Logo, OutlineButton, Screen } from '@/components/ui';
import { API, api, track, type Card } from '@/lib/api';
import { C, SIGN_EMOJI } from '@/lib/theme';

type Match = { id: string; shareCode: string; me: Card; user: Card; vibe: { headline: string; reasons: string[] } };

// signs instead of photos: the other person didn't agree to their face being shared
const Sign = ({ c, color }: { c: Card; color: string }) => (
  <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: color, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
    <Text style={{ color, fontSize: 40 }}>{c.astro ? SIGN_EMOJI[c.astro.sun] : '✦'}</Text>
    <Text style={{ color: C.muted, fontSize: 11 }}>{c.astro?.sun}</Text>
  </View>
);

export default function ShareCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<Match | null>(null);
  const ref = useRef<any>(null);
  useEffect(() => { api<Match>(`/matches/${id}`).then(setM).catch(() => {}); }, [id]);

  const link = m ? `${API}/c/${m.shareCode}` : '';
  const shareImage = async () => {
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Jodi card' });
      track('card_shared', { kind: 'image' });
    } catch (e: any) { Alert.alert('Could not share', e.message); }
  };
  const shareLink = async () => {
    await Share.share({ message: `${m!.me.name} + ${m!.user.name} = ${m!.user.compat?.overall}% cosmic Jodi ✨ See why: ${link}` });
    track('card_shared', { kind: 'link' });
  };

  if (!m) return <Screen><Loading /></Screen>;
  return (
    <Screen scroll>
      <Header title="Your Jodi Card" />
      <View ref={ref} collapsable={false} style={{ borderRadius: 28, overflow: 'hidden', marginTop: 8 }}>
        <LinearGradient colors={['#3B2A6B', '#1A1440', '#0B0A1F']} style={{ padding: 24, alignItems: 'center' }}>
          <Logo size={30} />
          <View style={{ flexDirection: 'row', marginTop: 22, alignItems: 'center' }}>
            <Sign c={m.me} color={C.lilac} />
            <Text style={{ color: C.pink, fontSize: 26, marginHorizontal: 8 }}>✦</Text>
            <Sign c={m.user} color={C.pink} />
          </View>
          <Text style={{ color: C.text, fontSize: 18, marginTop: 12 }}>{m.me.name}  +  {m.user.name}</Text>
          <Text style={{ color: C.lilac, fontSize: 64, fontWeight: '800', marginTop: 4 }}>{m.user.compat?.overall}%</Text>
          <Text style={{ color: C.muted, marginBottom: 16 }}>cosmic compatibility</Text>
          {m.vibe.reasons.slice(0, 3).map((r, i) => <Text key={i} style={{ color: C.text, alignSelf: 'stretch', marginBottom: 8, lineHeight: 20 }}>✨ {r}</Text>)}
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 14 }}>Find your Jodi · Dating, written in the stars</Text>
        </LinearGradient>
      </View>
      <GradientButton title="Share card image" onPress={shareImage} style={{ marginTop: 22 }} />
      <OutlineButton title="Share link" onPress={shareLink} style={{ marginTop: 12 }} />
      <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 14 }}>🔒 Cards never include birth dates, times or places.</Text>
    </Screen>
  );
}
