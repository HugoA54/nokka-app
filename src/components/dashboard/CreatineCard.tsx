import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hasCreatineToday, markCreatineTaken, scheduleCreatineReminders } from '@services/creatineReminder';

export function CreatineCard() {
  const [taken, setTaken] = useState<boolean | null>(null);

  useEffect(() => {
    hasCreatineToday().then(setTaken);
  }, []);

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

  if (taken === null) return null;

  return (
    <View style={[styles.card, taken && styles.cardTaken]}>
      <View style={[styles.iconWrap, taken && styles.iconWrapTaken]}>
        <Ionicons
          name={taken ? 'checkmark-circle' : 'water'}
          size={22}
          color={taken ? '#60f090' : '#60d4f0'}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>Créatine</Text>
        <Text style={styles.subtitle}>
          {taken ? 'Prise aujourd\'hui ✓' : 'Rappel toutes les heures'}
        </Text>
      </View>
      {taken ? (
        <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
          <Text style={styles.undoText}>Annuler</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={handleTake} style={styles.takeBtn}>
          <Text style={styles.takeBtnText}>Pris ✓</Text>
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
