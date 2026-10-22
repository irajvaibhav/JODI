import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafetyMenu } from '@/components/SafetyMenu';
import { Loading } from '@/components/ui';
import { api, authedImage, imageForm, media, track, type Card } from '@/lib/api';
import { pickAndShrink } from '@/lib/images';
import { useSession, useSocketEvent } from '@/lib/session';
import { C } from '@/lib/theme';

type Msg = { id: string; matchId: string; senderId: string; body: string | null; image: string | null; createdAt: string };
const time = (s: string) => new Date(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me, socket } = useSession();
  const [other, setOther] = useState<Card | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [ice, setIce] = useState<string[] | null>(null);
  const [iceLoading, setIceLoading] = useState(false);
  const [fromIce, setFromIce] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadIce = useCallback(async () => {
    setIceLoading(true);
    try { setIce((await api<{ icebreakers: string[] }>(`/matches/${id}/icebreakers`)).icebreakers); } catch {}
    setIceLoading(false);
  }, [id]);

  useEffect(() => {
    api<{ user: Card }>(`/matches/${id}`).then(m => setOther(m.user)).catch(() => router.back());
    api<Msg[]>(`/matches/${id}/messages`).then(m => { setMsgs(m); if (!m.length) loadIce(); }).catch(() => setMsgs([]));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent<Msg>('message', m => { if (m.matchId === id) { setMsgs(x => [...(x ?? []), m]); setTyping(false); } });
  useSocketEvent<{ matchId: string }>('typing', t => {
    if (t.matchId !== id) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  });
  useSocketEvent<{ matchId: string }>('unmatch', u => { if (u.matchId === id) { Alert.alert('This chat has ended'); router.replace('/chats'); } });

  const send = async (body = text, image?: string) => {
    if (!body.trim() && !image) return;
    setSending(true);
    try {
      const m = image
        ? await api<Msg>(`/matches/${id}/messages`, { form: imageForm('image', image) })
        : await api<Msg>(`/matches/${id}/messages`, { body: { body: body.trim(), icebreaker: fromIce } });
      setMsgs(x => [...(x ?? []), m]);
      if (!image) { setText(''); setIce(null); setFromIce(false); }
    } catch (e: any) { Alert.alert('Not sent', e.message); }
    setSending(false);
  };

  const sendImage = async () => { const uri = await pickAndShrink(false); if (uri) send('', uri); };

  const onType = (t: string) => {
    setText(t);
    if (other) socket?.emit('typing', { matchId: id, to: other.id });
  };

  if (!other || !msgs) return <View style={{ flex: 1, backgroundColor: '#fff' }}><Loading /></View>;
  const reversed = [...msgs].reverse();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EDF8' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={{ fontSize: 28, color: C.ink }}>‹</Text></Pressable>
        <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: other.id } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={{ uri: media(other.photos[0]) }} style={{ width: 38, height: 38, borderRadius: 19 }} />
          <View>
            <Text style={{ color: C.ink, fontWeight: '700' }}>{other.name}</Text>
            <Text style={{ color: typing ? C.purple : C.inkMuted, fontSize: 12 }}>{typing ? 'typing…' : `${other.compat?.overall}% cosmic match`}</Text>
          </View>
        </Pressable>
        <SafetyMenu dark userId={other.id} name={other.name} matchId={id} onDone={() => router.replace('/chats')} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          inverted
          data={reversed}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16 }}
          ListFooterComponent={<Text style={{ textAlign: 'center', color: C.inkMuted, fontSize: 12, marginBottom: 16 }}>You matched with {other.name} ✨ Be kind, be yourself.</Text>}
          renderItem={({ item: m }) => {
            const mine = m.senderId === me?.id;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', marginBottom: 10 }}>
                <View style={{ backgroundColor: mine ? '#E9E4FF' : '#F4F3F8', borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4, padding: m.image ? 4 : 12 }}>
                  {m.image ? <Image source={authedImage(m.image)} style={{ width: 200, height: 250, borderRadius: 14 }} contentFit="cover" /> : null}
                  {m.body ? <Text style={{ color: C.ink, fontSize: 15, lineHeight: 20 }}>{m.body}</Text> : null}
                </View>
                <Text style={{ color: '#B0ABC7', fontSize: 10, marginTop: 3, alignSelf: mine ? 'flex-end' : 'flex-start' }}>{time(m.createdAt)}</Text>
              </View>
            );
          }}
        />

        {ice || iceLoading ? (
          <View style={{ margin: 12, marginTop: 0, backgroundColor: C.cardSoft, borderRadius: 18, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: C.purple, fontWeight: '700' }}>✨ Suggested Icebreakers</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Text onPress={loadIce} style={{ color: C.purple }}>↻ New</Text>
                <Text onPress={() => setIce(null)} style={{ color: C.inkMuted }}>✕</Text>
              </View>
            </View>
            {iceLoading ? <ActivityIndicator color={C.purple} /> : ice?.map((t, i) => (
              <Pressable key={i} onPress={() => { setText(t); setFromIce(true); track('icebreaker_picked'); }} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 6 }}>
                <Text style={{ color: C.ink, fontSize: 13 }}>{t}</Text>
              </Pressable>
            ))}
            {!iceLoading ? <Text style={{ color: C.inkMuted, fontSize: 11 }}>Tap one to edit it before sending.</Text> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#F0EDF8' }}>
          <Pressable onPress={sendImage} hitSlop={8} accessibilityLabel="Send photo"><Text style={{ fontSize: 22 }}>🖼</Text></Pressable>
          {!ice && !iceLoading ? <Pressable onPress={loadIce} hitSlop={8} accessibilityLabel="Icebreakers"><Text style={{ fontSize: 20, color: C.purple }}>✨</Text></Pressable> : null}
          <TextInput value={text} onChangeText={onType} placeholder="Type a message…" placeholderTextColor="#aaa" multiline maxLength={2000}
            style={{ flex: 1, backgroundColor: '#F4F3F8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: C.ink, maxHeight: 110 }} />
          <Pressable onPress={() => send()} disabled={sending || !text.trim()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? C.purple : '#D6D1EA', alignItems: 'center', justifyContent: 'center' }}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 18 }}>➤</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
