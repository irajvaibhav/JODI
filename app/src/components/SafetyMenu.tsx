import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { ErrorText, Field, GradientButton } from '@/components/ui';
import { api } from '@/lib/api';
import { useMeta } from '@/lib/meta';
import { C } from '@/lib/theme';

export function SafetyMenu({ userId, name, matchId, onDone, dark }: { userId: string; name: string; matchId?: string | null; onDone: () => void; dark?: boolean }) {
  const meta = useMeta();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = (title: string, msg: string, action: () => Promise<unknown>) =>
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: title, style: 'destructive', onPress: async () => { await action().catch(() => {}); onDone(); } }]);

  const open = () => Alert.alert(name, undefined, [
    ...(matchId ? [{ text: 'Unmatch', onPress: () => confirm('Unmatch', `You and ${name} won't be able to chat anymore.`, () => api(`/matches/${matchId}/unmatch`, { method: 'POST' })) }] : []),
    { text: 'Block', onPress: () => confirm('Block', `${name} won't see you and you won't see them.`, () => api('/block', { body: { userId } })) },
    { text: 'Report', style: 'destructive' as const, onPress: () => setReporting(true) },
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/report', { body: { userId, reason, details } });
      setReporting(false);
      Alert.alert('Thanks for telling us', `Our safety team will review this. ${name} has been blocked for you.`);
      onDone();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      <Pressable onPress={open} hitSlop={12} accessibilityLabel="Safety options">
        <Text style={{ color: dark ? C.ink : C.text, fontSize: 22, fontWeight: '700' }}>⋯</Text>
      </Pressable>
      <Modal visible={reporting} transparent animationType="slide" onRequestClose={() => setReporting(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Report {name}</Text>
            <Text style={{ color: C.muted, marginBottom: 14 }}>They won't know you reported them.</Text>
            {meta?.reportReasons.map(r => (
              <Pressable key={r} onPress={() => setReason(r)} style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.text }}>{r}</Text><Text style={{ color: C.lilac }}>{reason === r ? '●' : '○'}</Text>
              </Pressable>
            ))}
            <Field placeholder="Anything else we should know? (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
            <ErrorText>{err}</ErrorText>
            <GradientButton title="Submit report" onPress={submit} loading={busy} disabled={!reason} />
            <Text onPress={() => setReporting(false)} style={{ color: C.muted, textAlign: 'center', marginTop: 14 }}>Cancel</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
