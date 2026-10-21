import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ErrorText, Field, GradientButton, H1, Header, Logo, Screen, Sub } from '@/components/ui';
import { api } from '@/lib/api';
import { googleEnabled, googleIdToken } from '@/lib/google';
import { nextOnboardingStep, useSession } from '@/lib/session';
import { C } from '@/lib/theme';

export default function Login() {
  const { signIn } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const request = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ devCode?: string }>('/auth/otp/request', { body: { phone } });
      setSent(true); setDevCode(r.devCode ?? null);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const google = async () => {
    setBusy(true); setErr(null);
    try {
      const idToken = await googleIdToken();
      if (!idToken) { setBusy(false); return; } // cancelled
      const r = await api<{ token: string }>('/auth/google', { body: { idToken } });
      const me = await signIn(r.token);
      router.replace((me?.onboarded ? '/discover' : me ? nextOnboardingStep(me) : '/') as any);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ token: string }>('/auth/otp/verify', { body: { phone, code } });
      const me = await signIn(r.token);
      router.replace((me?.onboarded ? '/discover' : me ? nextOnboardingStep(me) : '/') as any);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <Screen scroll>
      <Header />
      <Logo size={36} />
      <View style={{ height: 32 }} />
      <H1>{sent ? 'Enter your code' : 'What\'s your number?'}</H1>
      <Sub>{sent ? `We sent a 6-digit code to ${phone}.` : 'We\'ll text you a code to verify it\'s really you. Jodi is 18+ only.'}</Sub>
      {!sent ? (
        <>
          <Field label="Mobile number" placeholder="98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoFocus maxLength={14} />
          <ErrorText>{err}</ErrorText>
          <GradientButton title="Send code" onPress={request} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} />
          {googleEnabled ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                <Text style={{ color: C.muted }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              </View>
              <Pressable onPress={google} disabled={busy} accessibilityRole="button"
                style={{ height: 52, borderRadius: 26, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy ? 0.6 : 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#4285F4' }}>G</Text>
                <Text style={{ color: '#1F1F1F', fontSize: 16, fontWeight: '600' }}>Continue with Google</Text>
              </Pressable>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Field label="6-digit code" placeholder="••••••" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} autoFocus
            style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
          {devCode ? <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 12 }}>Test mode code: <Text style={{ color: C.lilac, fontWeight: '700' }}>{devCode}</Text></Text> : null}
          <ErrorText>{err}</ErrorText>
          <GradientButton title="Verify & continue" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Text onPress={() => { setSent(false); setCode(''); }} style={{ color: C.lilac, textAlign: 'center', marginTop: 18 }}>Change number / resend</Text>
        </>
      )}
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 32 }}>
        By continuing you agree to our Terms and Privacy Policy. Compatibility is for fun & discovery — not a guarantee.
      </Text>
    </Screen>
  );
}
