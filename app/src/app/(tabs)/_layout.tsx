import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;

export default function TabsLayout() {
  const { ready, signedIn, me } = useSession();
  if (ready && (!signedIn || (me && !me.onboarded))) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: C.purple, tabBarInactiveTintColor: '#9A96B5',
      tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0, height: 64, paddingTop: 6 }, tabBarLabelStyle: { fontSize: 11 },
    }}>
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('✦') }} />
      <Tabs.Screen name="likes" options={{ title: 'Likes', tabBarIcon: icon('♡') }} />
      <Tabs.Screen name="chats" options={{ title: 'Chat', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="me" options={{ title: 'Profile', tabBarIcon: icon('◉') }} />
    </Tabs>
  );
}
