import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { GradientButton, Loading, Screen } from '@/components/ui';
import { api, media } from '@/lib/api';
import { useSocketEvent } from '@/lib/session';
import { C } from '@/lib/theme';

type Row = { id: string; score: number; user: { id: string; name: string; photo?: string }; last: { body: string; mine: boolean; at: string } | null };

export default function Chats() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => { api<Row[]>('/matches').then(setRows).catch(() => setRows([])); }, []);
  useFocusEffect(load);
  useSocketEvent('message', load);
  useSocketEvent('match', load);

  if (!rows) return <Screen><Loading /></Screen>;
  const fresh = rows.filter(r => !r.last), convos = rows.filter(r => r.last);
  return (
    <Screen>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', marginVertical: 10 }}>Your Jodis</Text>
      {!rows.length ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 48 }}>💬</Text>
          <Text style={{ color: C.muted, textAlign: 'center', marginVertical: 12 }}>No Jodis yet. When you and someone both Jodi each other, you can chat here.</Text>
          <GradientButton title="Discover people" onPress={() => router.push('/discover')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={r => r.id}
          ListHeaderComponent={fresh.length ? (
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: C.muted, marginBottom: 10 }}>New Jodis — say hi! ✨</Text>
              <FlatList horizontal data={fresh} keyExtractor={r => r.id} showsHorizontalScrollIndicator={false} renderItem={({ item: r }) => (
                <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: r.id } })} style={{ alignItems: 'center', marginRight: 14 }}>
                  <Image source={{ uri: media(r.user.photo) }} style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: C.lilac }} />
                  <Text style={{ color: C.text, marginTop: 4, fontSize: 12 }}>{r.user.name}</Text>
                </Pressable>
              )} />
            </View>
          ) : undefined}
          renderItem={({ item: r }) => (
            <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: r.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <Image source={{ uri: media(r.user.photo) }} style={{ width: 54, height: 54, borderRadius: 27 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 16 }}>{r.user.name} <Text style={{ color: C.lilac, fontSize: 12 }}>· {r.score}%</Text></Text>
                <Text style={{ color: C.muted }} numberOfLines={1}>{r.last!.mine ? 'You: ' : ''}{r.last!.body}</Text>
              </View>
              <Text style={{ color: C.muted, fontSize: 11 }}>{new Date(r.last!.at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
