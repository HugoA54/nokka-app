import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function MealCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={52} height={52} borderRadius={12} />
        <View style={styles.info}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={styles.macros}>
        <Skeleton width="22%" height={10} />
        <Skeleton width="22%" height={10} />
        <Skeleton width="22%" height={10} />
        <Skeleton width="22%" height={10} />
      </View>
    </View>
  );
}

export function SessionCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={18} />
      <Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
      <View style={styles.row2}>
        <Skeleton width={60} height={28} borderRadius={8} />
        <Skeleton width={60} height={28} borderRadius={8} />
      </View>
    </View>
  );
}

export function MacroSummarySkeleton() {
  return (
    <View style={styles.summaryCard}>
      <Skeleton width="40%" height={20} />
      <Skeleton width="100%" height={12} style={{ marginTop: 16 }} borderRadius={6} />
      <Skeleton width="100%" height={12} style={{ marginTop: 10 }} borderRadius={6} />
      <Skeleton width="100%" height={12} style={{ marginTop: 10 }} borderRadius={6} />
      <Skeleton width="100%" height={12} style={{ marginTop: 10 }} borderRadius={6} />
    </View>
  );
}

export function AIAnalyzingOverlay() {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
      <Skeleton width={200} height={16} style={{ marginTop: 24 }} />
      <Skeleton width={140} height={12} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#2a2a35',
  },
  card: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 8,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  summaryCard: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 10,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  spinner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#2a2a35',
    borderTopColor: '#c8f060',
  },
});
