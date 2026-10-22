import { useEffect, useState } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { media, type Card } from '@/lib/api';
import { C, SIGN_EMOJI } from '@/lib/theme';

const W = Dimensions.get('window').width;
const THRESHOLD = W * 0.28;

export type SwipeHandle = { swipe: (dir: 'left' | 'right') => void };

export function SwipeCard({ card, onSwiped, onOpen, handleRef }: {
  card: Card; onSwiped: (dir: 'left' | 'right') => void; onOpen: () => void; handleRef?: React.MutableRefObject<SwipeHandle | null>;
}) {
  const [pos] = useState(() => new Animated.ValueXY());
  const fly = (dir: 'left' | 'right') =>
    Animated.timing(pos, { toValue: { x: (dir === 'right' ? 1.5 : -1.5) * W, y: 40 }, duration: 220, useNativeDriver: true }).start(() => onSwiped(dir));
  useEffect(() => { if (handleRef) handleRef.current = { swipe: fly }; });

  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > THRESHOLD) fly('right');
      else if (g.dx < -THRESHOLD) fly('left');
      else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 5 }).start();
    },
  }));

  const rotate = pos.x.interpolate({ inputRange: [-W, 0, W], outputRange: ['-12deg', '0deg', '12deg'] });
  const jodiOpacity = pos.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOpacity = pos.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }}>
      <Pressable onPress={onOpen} style={{ flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: C.card }}>
        <View style={{ flex: 1 }}>
          <Image source={{ uri: media(card.photos[0]) }} style={{ flex: 1 }} contentFit="cover" transition={150} />
          {card.compat ? (
            <View style={{ position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#F5A623', marginRight: 4 }}>✪</Text>
              <Text style={{ color: C.ink, fontWeight: '700', fontSize: 12 }}>{card.compat.overall}% Cosmic Match</Text>
            </View>
          ) : null}
          <Animated.Text style={{ position: 'absolute', top: 24, left: 20, opacity: jodiOpacity, color: C.green, borderColor: C.green, borderWidth: 3, borderRadius: 10, paddingHorizontal: 10, fontSize: 28, fontWeight: '900', transform: [{ rotate: '-15deg' }] }}>JODI ✨</Animated.Text>
          <Animated.Text style={{ position: 'absolute', top: 24, right: 20, opacity: passOpacity, color: C.danger, borderColor: C.danger, borderWidth: 3, borderRadius: 10, paddingHorizontal: 10, fontSize: 28, fontWeight: '900', transform: [{ rotate: '15deg' }] }}>PASS</Animated.Text>
        </View>
        <View style={{ padding: 14 }}>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '700' }}>{card.name}, {card.age}</Text>
          <Text style={{ color: C.inkMuted, fontSize: 12, marginBottom: 6 }}>{card.distanceKm != null ? `${card.distanceKm} km away · ` : ''}{card.city}</Text>
          {card.astro ? (
            <Text style={{ color: C.ink, fontSize: 13, marginBottom: 4 }}>
              <Text style={{ color: '#F5A623' }}>{SIGN_EMOJI[card.astro.sun]}</Text> {card.astro.sun}
              {card.astro.moon ? <Text>   <Text style={{ color: C.purple }}>☾</Text> {card.astro.moon} Moon</Text> : null}
            </Text>
          ) : null}
          <Text style={{ color: C.inkMuted, fontSize: 12 }} numberOfLines={1}>{card.interests.join(' • ')}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function NextCardPeek({ card }: { card?: Card }) {
  if (!card) return null;
  return (
    <View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: -8, borderRadius: 24, overflow: 'hidden', opacity: 0.5 }}>
      <Image source={{ uri: media(card.photos[0]) }} style={{ flex: 1 }} contentFit="cover" />
      <LinearGradient colors={['transparent', C.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
    </View>
  );
}
