import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAbsSettings, hasAbsRoutineToday, getAbsStreak } from '@services/absRoutine';
import type { AbsLevel } from '@types/index';

const LEVEL_LABEL_KEYS: Record<AbsLevel, string> = {
  beginner: 'abs.level.beginner',
  intermediate: 'abs.level.intermediate',
  advanced: 'abs.level.advanced',
};

export function AbsRoutineCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [done, setDone] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState<AbsLevel>('beginner');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const settings = await getAbsSettings();
        setEnabled(settings.enabled);
        setLevel(settings.level);
        if (settings.enabled) {
          setDone(await hasAbsRoutineToday());
          setStreak(await getAbsStreak());
        }
      })();
    }, [])
  );

  if (!enabled || done === null) return null;

  return (
    <TouchableOpacity
      style={[styles.card, done && styles.cardDone]}
      onPress={() => router.push('/abs-routine' as any)}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'fitness'}
          size={22}
          color={done ? '#60f090' : '#f060a8'}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{t('abs.card.title')}</Text>
        <Text style={styles.subtitle}>
          {done
            ? t('abs.card.done_today')
            : t('abs.card.cta', { level: t(LEVEL_LABEL_KEYS[level]) })}
        </Text>
      </View>
      {streak > 0 && (
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={12} color="#f0a060" />
          <Text style={styles.streakText}>{streak}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color="#7a7a90" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3a1a30',
  },
  cardDone: {
    borderColor: '#1a3a1a',
    backgroundColor: '#12181a',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240,96,168,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDone: {
    backgroundColor: 'rgba(96,240,144,0.12)',
  },
  info: { flex: 1, gap: 2 },
  title: { color: '#f0f0f0', fontSize: 14, fontWeight: '700' },
  subtitle: { color: '#7a7a90', fontSize: 12 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(240,160,96,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakText: { color: '#f0a060', fontSize: 12, fontWeight: '700' },
});
