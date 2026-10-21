import { useState } from 'react';
import { Alert, Share, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, OutlineButton, Screen } from '@/components/ui';
import { api, saveToken } from '@/lib/api';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

const P = ({ children }: { children: string }) => <Text style={{ color: C.muted, lineHeight: 20, marginBottom: 10 }}>{children}</Text>;

export default function Privacy() {
  const router = useRouter();
  const { me, refresh, signOut } = useSession();
  const [visible, setVisible] = useState(me!.discoverable);

  const setDiscoverable = async (v: boolean) => {
    setVisible(v);
    await api('/me/settings', { method: 'PUT', body: { discoverable: v } }).catch(() => setVisible(!v));
    refresh();
  };

  const exportData = async () => {
    const data = await api('/me/export');
    await Share.share({ message: JSON.stringify(data, null, 2), title: 'My Jodi data' });
  };

  const deleteAstro = () => Alert.alert('Delete astrology data?', 'Your birth time, birth place and all signs will be deleted. Astro compatibility will show as neutral. Your date of birth is kept only to confirm you are 18+.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api('/me/astro', { method: 'DELETE' }); refresh(); Alert.alert('Done', 'Your astrology data has been deleted.'); } },
  ]);

  const deleteAccount = () => Alert.alert('Delete your account?', 'This permanently deletes your profile, photos, matches, messages and birth data. This can\'t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: async () => { await api('/me', { method: 'DELETE' }); await saveToken(null); await signOut(); router.replace('/'); } },
  ]);

  return (
    <Screen scroll>
      <Header title="Privacy & Safety" />
      <Text style={{ color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>🔒 Your birth data</Text>
      <P>Your exact date of birth, birth time and birth place are encrypted and never shown to anyone — not on your profile, not in compatibility explanations, not on share cards.</P>
      <P>Other people only see your age, city, photos, bio, interests, selected lifestyle and your Sun, Moon and Rising signs.</P>
      <P>Compatibility is an entertainment & discovery signal. Jodi never guarantees relationship outcomes, and never matches on caste, religion or other sensitive traits.</P>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginTop: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15 }}>Show me in Discover</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Turn off to take a break. Your matches & chats stay.</Text>
        </View>
        <Switch value={visible} onValueChange={setDiscoverable} trackColor={{ true: C.lilac }} />
      </View>

      <Text style={{ color: C.text, fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 8 }}>🛡 Staying safe</Text>
      <P>Never send money or share financial details. Meet in public places. Use ⋯ on any profile or chat to unmatch, block or report — reports are reviewed by our team.</P>

      <OutlineButton title="Export my data" onPress={exportData} style={{ marginTop: 14 }} />
      <OutlineButton title="Log out of all devices" onPress={async () => { await api('/auth/logout-all', { method: 'POST' }); await signOut(); router.replace('/'); }} style={{ marginTop: 12 }} />
      <OutlineButton title="Delete my astrology data" onPress={deleteAstro} style={{ marginTop: 12, borderColor: C.hot }} />
      <OutlineButton title="Delete account" onPress={deleteAccount} style={{ marginTop: 12, borderColor: C.danger }} />
    </Screen>
  );
}
