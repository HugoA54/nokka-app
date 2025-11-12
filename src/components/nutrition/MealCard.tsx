import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@hooks/useHaptics';
import type { Meal } from '@types/index';

interface MealCardProps {
  meal: Meal;
  onPress?: () => void;
  onAddToToday?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  showActions?: boolean;
}

export function MealCard({
  meal,
  onPress,
  onAddToToday,
  onDelete,
  onEdit,
  showActions = true,
}: MealCardProps) {
  const haptics = useHaptics();
  const [expanded, setExpanded] = useState(false);

  const handleDelete = () => {
    Alert.alert('Delete Meal', `Delete "${meal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await haptics.medium();
          onDelete?.();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.main} onPress={() => { setExpanded(!expanded); onPress?.(); }} activeOpacity={0.85}>
        {/* Image or Icon */}
        <View style={styles.imageWrapper}>
          {meal.image_url ? (
            <Image
              source={{ uri: meal.image_url }}
              style={styles.image}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={styles.iconPlaceholder}>
              <Ionicons name="restaurant" size={22} color="#7a7a90" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{meal.name}</Text>
          <Text style={styles.calories}>{Math.round(meal.total_calories)} kcal</Text>
          <View style={styles.macroRow}>
            <Text style={[styles.macro, { color: '#60d4f0' }]}>P {meal.total_protein.toFixed(0)}g</Text>
            <Text style={[styles.macro, { color: '#f0c060' }]}>C {meal.total_carbs.toFixed(0)}g</Text>
            <Text style={[styles.macro, { color: '#f060a8' }]}>F {meal.total_fats.toFixed(0)}g</Text>
          </View>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#7a7a90"
        />
      </TouchableOpacity>

      {/* Actions */}
      {showActions && (
        <View style={styles.actions}>
          {onAddToToday && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => { await haptics.light(); onAddToToday(); }}
            >
              <Ionicons name="add-circle-outline" size={16} color="#c8f060" />
              <Text style={[styles.actionText, { color: '#c8f060' }]}>Add to Today</Text>
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => { await haptics.light(); onEdit(); }}
            >
              <Ionicons name="pencil-outline" size={16} color="#7a7a90" />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color="#f06060" />
              <Text style={[styles.actionText, { color: '#f06060' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    marginBottom: 10,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  imageWrapper: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2a35',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
  },
  calories: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '700',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macro: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2a2a35',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '600',
  },
});
