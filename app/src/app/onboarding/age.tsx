import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GradientButton, H1, Progress, Screen, Sub } from '@/components/ui';
import { C } from '@/lib/theme';

function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 18 }} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: C.lilac, backgroundColor: on ? C.lilac : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Text style={{ color: C.ink, fontWeight: '800' }}>✓</Text> : null}
      </View>
      <Text style={{ color: C.text, flex: 1, fontSize: 15 }}>{children}</Text>
    </Pressable>
  );
}

export default function AgeGate() {
  const router = useRouter();
  const [adult, setAdult] = useState(false);
  const [fun, setFun] = useState(false);
  const [rules, setRules] = useState(false);
  return (
    <Screen>
      <Progress step={1} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>✦</Text>
        <H1 center>Before we begin</H1>
        <Sub center>Jodi is a space for adults to meet kindly and safely.</Sub>
        <Check on={adult} onPress={() => setAdult(!adult)}>I am 18 years or older</Check>
        <Check on={fun} onPress={() => setFun(!fun)}>I understand compatibility is for fun & discovery — not a prediction or guarantee</Check>
        <Check on={rules} onPress={() => setRules(!rules)}>I'll be respectful and follow the community guidelines</Check>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Your age is verified from your date of birth on the next step.</Text>
      </View>
      <GradientButton title="Continue" disabled={!(adult && fun && rules)} onPress={() => router.push('/onboarding/birth')} style={{ marginBottom: 16 }} />
    </Screen>
  );
}
