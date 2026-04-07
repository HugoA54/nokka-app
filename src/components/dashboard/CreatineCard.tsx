import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { hasCreatineToday, markCreatineTaken, scheduleCreatineReminders, getCreatineSettings, saveCreatineSettings } from '@services/creatineReminder';

export function CreatineCard() {
  const { t } = useTranslation();
  const [taken, setTaken] = useState<boolean | null>(null);
  const [subtitle, setSubtitle] = useState('');
  const [enabled, setEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      hasCreatineToday().then(setTaken);
      getCreatineSettings().then((s) => {
        setEnabled(s.enabled);
        if (!s.enabled) { setSubtitle(t('creatine_card.reminders_disabled')); return; }
        if (s.mode === 'fixed') setSubtitle(t('profile.creatine_fixed', { hour: s.fixedHour }));
        else setSubtitle(t('profile.creatine_interval', { hours: s.intervalHours }));
      });
    }, [t])
  );

  const handleTake = async () => {
    await markCreatineTaken();
    setTaken(true);
  };

  const handleUndo = async () => {
    // Undo: re-enable reminders
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const key = 'nokka_creatine_' + new Date().toLocaleDateString('en-CA');
    await AsyncStorage.removeItem(key);
    setTaken(false);
    await scheduleCreatineReminders();
  };

  const handleDisable = () => {
    Alert.alert(
      t('creatine_card.disable_confirm_title'),
      t('creatine_card.disable_confirm_msg'),
      [
        { text: t('creatine_card.disable_confirm_no'), style: 'cancel' },
        {
          text: t('creatine_card.disable_confirm_yes'),
          style: 'destructive',
          onPress: async () => {
            const current = await getCreatineSettings();
            await saveCreatineSettings({ ...current, enabled: false });
            setEnabled(false);
          },
        },
      ]
    );
  };

  if (taken === null || !enabled) return null;

  return (
    <View style={[styles.card, taken && styles.cardTaken]}>
      {!taken && (
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={handleDisable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={14} color="#3a3a4a" />
        </TouchableOpacity>
      )}
      <View style={[styles.iconWrap, taken && styles.iconWrapTaken]}>
        <Ionicons
          name={taken ? 'checkmark-circle' : 'water'}
          size={22}
          color={taken ? '#60f090' : '#60d4f0'}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{t('creatine_card.title')}</Text>
        <Text style={styles.subtitle}>
          {taken ? t('creatine_card.taken_today') : subtitle}
        </Text>
      </View>
      {taken ? (
        <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
          <Text style={styles.undoText}>{t('creatine_card.undo')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={handleTake} style={styles.takeBtn}>
          <Text style={styles.takeBtnText}>{t('creatine_card.taken_button')}</Text>
        </TouchableOpacity>
      )}
    </View>
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
    borderColor: '#1a3040',
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cardTaken: {
    borderColor: '#1a3a1a',
    backgroundColor: '#12181a',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(96,212,240,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapTaken: {
    backgroundColor: 'rgba(96,240,144,0.12)',
  },
  info: { flex: 1, gap: 2 },
  title: { color: '#f0f0f0', fontSize: 14, fontWeight: '700' },
  subtitle: { color: '#7a7a90', fontSize: 12 },
  takeBtn: {
    backgroundColor: '#60d4f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  takeBtnText: { color: '#0f0f12', fontWeight: '700', fontSize: 13 },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  undoText: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
});
