import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { C, GRADIENT, NIGHT } from '@/lib/theme';

export function Screen({ children, scroll, light, pad = true }: { children: ReactNode; scroll?: boolean; light?: boolean; pad?: boolean }) {
  const body = scroll
    ? <ScrollView contentContainerStyle={[pad && s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[{ flex: 1 }, pad && s.pad]}>{children}</View>;
  if (light) return <SafeAreaView style={{ flex: 1, backgroundColor: C.cardSoft }}>{body}</SafeAreaView>;
  return (
    <LinearGradient colors={NIGHT} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>{body}</SafeAreaView>
    </LinearGradient>
  );
}

export function Logo({ size = 48 }: { size?: number }) {
  return <Text style={{ color: C.lilac, fontSize: size, fontWeight: '200', letterSpacing: size / 5, textAlign: 'center' }}>J✦DI</Text>;
}

export function GradientButton({ title, onPress, loading, disabled, style }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[{ opacity: disabled ? 0.5 : 1 }, style]} accessibilityRole="button">
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
        {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>{title}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

export function OutlineButton({ title, onPress, dark, style }: { title: string; onPress: () => void; dark?: boolean; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={[s.btn, s.outline, dark && { borderColor: C.ink }, style]} accessibilityRole="button">
      <Text style={[s.btnText, { color: dark ? C.ink : C.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, light }: { label: string; active?: boolean; onPress?: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, light && s.chipLight, active && (light ? { backgroundColor: C.ink, borderColor: C.ink } : s.chipActive)]}>
      <Text style={{ color: active ? (light ? '#fff' : C.ink) : light ? C.ink : C.text, fontSize: 13, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, light, ...props }: TextInputProps & { label?: string; light?: boolean }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[s.label, light && { color: C.inkMuted }]}>{label}</Text> : null}
      <TextInput placeholderTextColor={light ? '#aaa' : C.muted} {...props} style={[s.input, light && s.inputLight, props.style]} />
    </View>
  );
}

export function H1({ children, center, dark }: { children: ReactNode; center?: boolean; dark?: boolean }) {
  return <Text style={{ color: dark ? C.ink : C.text, fontSize: 26, fontWeight: '700', marginBottom: 6, textAlign: center ? 'center' : 'left' }}>{children}</Text>;
}
export function Sub({ children, center, dark }: { children: ReactNode; center?: boolean; dark?: boolean }) {
  return <Text style={{ color: dark ? C.inkMuted : C.muted, fontSize: 14, lineHeight: 20, marginBottom: 18, textAlign: center ? 'center' : 'left' }}>{children}</Text>;
}

export function Header({ title, dark, right }: { title?: string; dark?: boolean; right?: ReactNode }) {
  const router = useRouter();
  return (
    <View style={s.header}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityLabel="Back">
        <Text style={{ color: dark ? C.ink : C.text, fontSize: 26 }}>‹</Text>
      </Pressable>
      <Text style={{ color: dark ? C.ink : C.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      <View style={{ minWidth: 26, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Progress({ step, total = 7 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 20 }}>
      {Array.from({ length: total }, (_, i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? C.lilac : C.border }} />)}
    </View>
  );
}

export const ErrorText = ({ children }: { children?: string | null }) => children ? <Text style={{ color: '#FF8A8A', marginBottom: 10, textAlign: 'center' }}>{children}</Text> : null;

export function ScoreBar({ label, value, dark }: { label: string; value: number; dark?: boolean }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: dark ? C.ink : C.text, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: dark ? C.ink : C.text, fontSize: 13, fontWeight: '700' }}>{value}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: dark ? '#E7E2FA' : C.border }}>
        <LinearGradient colors={[C.purple, C.hot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6, borderRadius: 3, width: `${value}%` }} />
      </View>
    </View>
  );
}

export const Loading = () => <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.lilac} size="large" /></View>;

const s = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 8 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { color: C.ink, fontSize: 16, fontWeight: '700' },
  outline: { borderWidth: 1.5, borderColor: C.text },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  chipLight: { borderColor: '#E1DBF5', backgroundColor: '#fff' },
  chipActive: { backgroundColor: C.lilac, borderColor: C.lilac },
  label: { color: C.muted, fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  inputLight: { borderColor: '#E1DBF5', backgroundColor: '#fff', color: C.ink },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
});
