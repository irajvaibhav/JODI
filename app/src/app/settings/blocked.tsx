import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Header, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { C } from '@/lib/theme';

type Blocked = { id: string; name: string | null; created_at: string };

export default function BlockedUsers() {
  const [list, setList] = useState<Blocked[] | null>(null);
  useEffect(() => { api<Blocked[]>('/blocks').then(setList).catch(() => setList([])); }, []);

  const unblock = (b: Blocked) => Alert.alert(`Unblock ${b.name ?? 'this user'}?`, 'They may appear in Discover again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unblock', onPress: async () => { await api(`/block/${b.id}`, { method: 'DELETE' }); setList(l => l?.filter(x => x.id !== b.id) ?? null); } },
  ]);

  return (
    <Screen scroll>
      <Header title="Blocked Users" />
      {!list ? <Loading /> : !list.length ? <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>You haven't blocked anyone.</Text> : list.map(b => (
        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15 }}>{b.name ?? 'Deleted user'}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>Blocked {new Date(b.created_at).toLocaleDateString()}</Text>
          </View>
          <Text onPress={() => unblock(b)} style={{ color: C.lilac }}>Unblock</Text>
        </View>
      ))}
    </Screen>
  );
}
