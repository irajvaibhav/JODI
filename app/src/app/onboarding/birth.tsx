import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ErrorText, Field, GradientButton, H1, Header, Progress, Screen, Sub } from '@/components/ui';
import { api } from '@/lib/api';
import { isEdit } from '@/lib/meta';
import { useSession } from '@/lib/session';
import { C } from '@/lib/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const showDate = (s: string) => s.split('-').reverse().join(' / ');
const showTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${pad(h % 12 || 12)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };

export default function Birth() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const edit = isEdit(params);
  const router = useRouter();
  const { me, refresh } = useSession();
  const [dob, setDob] = useState(me?.birth?.dob || '');
  const [time, setTime] = useState(me?.birth?.time || '');
  const [unknown, setUnknown] = useState(!!me?.birth && !me.birth.time);
  const [place, setPlace] = useState(me?.birth?.place || '');
  const [places, setPlaces] = useState<{ label: string }[]>([]);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locked = !!me?.dob;

  useEffect(() => {
    if (place.length < 2 || places.some(p => p.label === place)) return;
    const t = setTimeout(() => api<{ label: string }[]>(`/places?q=${encodeURIComponent(place.split(',')[0])}`).then(setPlaces).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [place]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/me/birth', { method: 'PUT', body: { dob, time: unknown ? null : time, place } });
      await refresh();
      if (edit) router.back(); else router.push('/onboarding/photos');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <Screen scroll>
      {edit ? <Header title="Birth details" /> : <Progress step={2} />}
      <Text style={{ fontSize: 40, textAlign: 'center', color: C.lilac }}>✧</Text>
      <H1 center>Your Cosmic Journey Begins</H1>
      <Sub center>Enter your birth details to unlock personalised matches, insights and more.</Sub>

      <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 18 }}>
        <Text style={{ color: C.inkMuted, fontSize: 13, marginBottom: 6 }}>Date of Birth</Text>
        <Pressable onPress={() => !locked && setPicker('date')} style={box}>
          <Text style={{ color: dob ? C.ink : '#aaa' }}>{dob ? showDate(dob) : 'DD / MM / YYYY'}</Text><Text>📅</Text>
        </Pressable>
        {locked ? <Text style={{ color: C.inkMuted, fontSize: 11, marginTop: -8, marginBottom: 10 }}>Your age comes from your date of birth and can't be changed.</Text> : null}

        <Text style={{ color: C.inkMuted, fontSize: 13, marginBottom: 6 }}>Time of Birth</Text>
        <Pressable onPress={() => !unknown && setPicker('time')} style={[box, unknown && { opacity: 0.4 }]}>
          <Text style={{ color: time && !unknown ? C.ink : '#aaa' }}>{time && !unknown ? showTime(time) : 'HH : MM  AM/PM'}</Text><Text>🕐</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: -6 }}>
          <Text style={{ color: C.inkMuted, fontSize: 13 }}>I don't know my birth time</Text>
          <Switch value={unknown} onValueChange={setUnknown} trackColor={{ true: C.lilac }} />
        </View>

        <Field light label="Place of Birth" placeholder="City, State, Country" value={place} onChangeText={setPlace} />
        {places.length > 0 && !places.some(p => p.label === place) ? (
          <View style={{ marginTop: -8, marginBottom: 10, borderRadius: 12, backgroundColor: C.cardSoft }}>
            {places.map(p => (
              <Pressable key={p.label} onPress={() => { setPlace(p.label); setPlaces([]); }} style={{ padding: 12 }}>
                <Text style={{ color: C.ink }}>📍 {p.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <ErrorText>{err}</ErrorText>
        <GradientButton title={edit ? 'Save' : 'Next'} onPress={save} loading={busy} disabled={!dob || (!unknown && !time) || place.length < 2} />
        <Text onPress={() => setWhy(!why)} style={{ color: C.purple, textAlign: 'center', marginTop: 14, fontSize: 13 }}>Why do we need this?</Text>
        {why ? (
          <Text style={{ color: C.inkMuted, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
            We use your birth details to calculate your Sun, Moon and Rising signs and your Nakshatra. Your exact date, time and place of birth are
            encrypted and never shown to anyone — others only see your age and high-level signs. You can delete your astrology data any time in Settings.
          </Text>
        ) : null}
      </View>

      {picker ? (
        <DateTimePicker
          value={picker === 'date' ? (dob ? new Date(dob) : new Date(2000, 0, 1)) : new Date(`2000-01-01T${time || '12:00'}:00`)}
          mode={picker}
          maximumDate={picker === 'date' ? new Date() : undefined}
          onChange={(e, d) => {
            setPicker(null);
            if (e.type !== 'set' || !d) return;
            if (picker === 'date') setDob(isoDate(d)); else setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          }}
        />
      ) : null}
    </Screen>
  );
}

const box = { borderWidth: 1, borderColor: '#E1DBF5', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 } as const;
