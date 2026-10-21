import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { ErrorText, GradientButton, Header, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

function HourPicker({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
      <Text style={{ color: C.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={() => onChange((value + 23) % 24)} hitSlop={10}><Text style={{ color: C.lilac, fontSize: 22 }}>‹</Text></Pressable>
        <Text style={{ color: C.text, width: 56, textAlign: 'center', fontWeight: '600' }}>{hour(value)}</Text>
        <Pressable onPress={() => onChange((value + 1) % 24)} hitSlop={10}><Text style={{ color: C.lilac, fontSize: 22 }}>›</Text></Pressable>
      </View>
    </View>
  );
}

export default function NotificationSettings() {
  const { me, refresh } = useSession();
  const [n, setN] = useState(me!.notif);
  const [quiet, setQuiet] = useState(n.quietStart != null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (k: 'matches' | 'messages' | 'daily', label: string, hint: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{hint}</Text>
      </View>
      <Switch value={n[k]} onValueChange={v => setN({ ...n, [k]: v })} trackColor={{ true: C.lilac }} />
    </View>
  );

  const save = async () => {
    setBusy(true);
    try {
      await api('/me/settings', { method: 'PUT', body: { notif: { ...n, quietStart: quiet ? n.quietStart ?? 23 : null, quietEnd: quiet ? n.quietEnd ?? 8 : null } } });
      await refresh(); setMsg('Saved ✓');
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <Screen scroll>
      <Header title="Notifications" />
      {toggle('matches', 'New Jodis & likes', 'When someone likes you or you match')}
      {toggle('messages', 'Messages', 'New chat messages')}
      {toggle('daily', 'Daily Cosmic Jodi', 'Your daily pick at 9 AM')}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15 }}>Quiet hours</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>No notifications during these hours (safety alerts still come through)</Text>
        </View>
        <Switch value={quiet} onValueChange={setQuiet} trackColor={{ true: C.lilac }} />
      </View>
      {quiet ? (
        <View style={{ backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 14, marginBottom: 10 }}>
          <HourPicker label="From" value={n.quietStart ?? 23} onChange={h => setN({ ...n, quietStart: h })} />
          <HourPicker label="To" value={n.quietEnd ?? 8} onChange={h => setN({ ...n, quietEnd: h })} />
        </View>
      ) : null}
      <ErrorText>{msg && !msg.startsWith('Saved') ? msg : null}</ErrorText>
      {msg?.startsWith('Saved') ? <Text style={{ color: C.green, textAlign: 'center', marginBottom: 10 }}>{msg}</Text> : null}
      <GradientButton title="Save" onPress={save} loading={busy} style={{ marginTop: 10 }} />
    </Screen>
  );
}
