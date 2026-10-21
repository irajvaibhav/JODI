import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { media } from '@/lib/api';
import { useSession } from '@/lib/session';
import { C, SIGN_EMOJI } from '@/lib/theme';

const Row = ({ glyph, label, onPress, danger }: { glyph: string; label: string; onPress: () => void; danger?: boolean }) => (
  <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0EDF8' }}>
    <Text style={{ width: 30, fontSize: 16, color: danger ? C.danger : C.ink }}>{glyph}</Text>
    <Text style={{ flex: 1, color: danger ? C.danger : C.ink, fontSize: 15 }}>{label}</Text>
    <Text style={{ color: '#B0ABC7', fontSize: 18 }}>›</Text>
  </Pressable>
);

export default function Me() {
  const router = useRouter();
  const { me, refresh, signOut } = useSession();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  if (!me) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: C.ink, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 18 }}>Profile & Settings</Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', backgroundColor: C.cardSoft, borderRadius: 20, padding: 16, marginBottom: 12 }}>
          <Image source={{ uri: media(me.photos[0]) }} style={{ width: 72, height: 72, borderRadius: 36 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontSize: 18, fontWeight: '700' }}>{me.name}, {me.age}</Text>
            {me.astro ? <Text style={{ color: C.inkMuted, marginTop: 2 }}>{SIGN_EMOJI[me.astro.sun]} {me.astro.sun}{me.astro.moon ? ` · ☾ ${me.astro.moon}` : ''}</Text> : null}
            <Text style={{ color: C.inkMuted, marginTop: 2 }}>📍 {me.city}</Text>
          </View>
        </View>
        {!me.discoverable ? <Text style={{ color: C.hot, textAlign: 'center', marginBottom: 8 }}>You're hidden from Discover. Turn it back on in Privacy & Safety.</Text> : null}

        <Row glyph="✎" label="Edit Profile" onPress={() => router.push('/onboarding/profile?edit=1')} />
        <Row glyph="🖼" label="Photos" onPress={() => router.push('/onboarding/photos?edit=1')} />
        <Row glyph="☯" label="Personality & Lifestyle" onPress={() => router.push('/onboarding/personality?edit=1')} />
        <Row glyph="✧" label="Your Astro Details" onPress={() => router.push('/onboarding/astro?view=1')} />
        <Row glyph="🕐" label="Birth Details" onPress={() => router.push('/onboarding/birth?edit=1')} />
        <Row glyph="⚙" label="Dating Preferences" onPress={() => router.push('/onboarding/prefs?edit=1')} />
        <Row glyph="🔔" label="Notifications" onPress={() => router.push('/settings/notifications')} />
        <Row glyph="🔒" label="Privacy & Safety" onPress={() => router.push('/settings/privacy')} />
        <Row glyph="⛔" label="Blocked Users" onPress={() => router.push('/settings/blocked')} />
        <Row glyph="?" label="Help & Support" onPress={() => Alert.alert('Help & Support', 'Write to us at support@jodi.app — we usually reply within a day.')} />
        <Row glyph="⇥" label="Log Out" onPress={() => Alert.alert('Log out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', onPress: async () => { await signOut(); router.replace('/'); } }])} />
      </ScrollView>
    </SafeAreaView>
  );
}
