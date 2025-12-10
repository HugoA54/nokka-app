import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChallengeStore } from '@store/challengeStore';

export function AchievementToast() {
  const newlyUnlocked = useChallengeStore((s) => s.newlyUnlocked);
  const clearNewlyUnlocked = useChallengeStore((s) => s.clearNewlyUnlocked);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!newlyUnlocked) return;

    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        clearNewlyUnlocked();
        translateY.setValue(-120);
        opacity.setValue(0);
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, [newlyUnlocked]);

  if (!newlyUnlocked) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <View style={[styles.iconWrap, { borderColor: newlyUnlocked.color }]}>
        <Ionicons name={newlyUnlocked.icon as any} size={24} color={newlyUnlocked.color} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Badge débloqué !</Text>
        <Text style={styles.title}>{newlyUnlocked.title}</Text>
        <Text style={styles.desc} numberOfLines={1}>{newlyUnlocked.description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 10000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1a22',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f12',
    flexShrink: 0,
  },
  textWrap: { flex: 1, gap: 2 },
  label: { color: '#7a7a90', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  desc: { color: '#5a5a70', fontSize: 12 },
});
