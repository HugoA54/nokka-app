import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Food } from '@types/index';

interface FoodCardProps {
  food: Food;
  quantity?: number;
  onPress?: () => void;
  onAdd?: () => void;
  showMacros?: boolean;
  compact?: boolean;
}

export function FoodCard({
  food,
  quantity,
  onPress,
  onAdd,
  showMacros = true,
  compact = false,
}: FoodCardProps) {
  const factor = quantity ? quantity / 100 : 1;
  const cal = Math.round(food.calories_per_100g * factor);
  const protein = (food.protein_per_100g * factor).toFixed(1);
  const carbs = (food.carbs_per_100g * factor).toFixed(1);
  const fats = (food.fats_per_100g * factor).toFixed(1);

  return (
    <TouchableOpacity style={[styles.container, compact && styles.compact]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.icon}>
        <Ionicons
          name={food.source === 'openfoodfacts' ? 'barcode-outline' : 'restaurant-outline'}
          size={20}
          color="#7a7a90"
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{food.name}</Text>
        {food.brand && <Text style={styles.brand} numberOfLines={1}>{food.brand}</Text>}
        {quantity && (
          <Text style={styles.quantity}>{quantity}g serving</Text>
        )}
        {showMacros && (
          <View style={styles.macros}>
            <Text style={styles.calories}>{cal} kcal</Text>
            <Text style={styles.macroText}>
              <Text style={{ color: '#60d4f0' }}>P{protein}g </Text>
              <Text style={{ color: '#f0c060' }}>C{carbs}g </Text>
              <Text style={{ color: '#f060a8' }}>F{fats}g</Text>
            </Text>
          </View>
        )}
      </View>

      {onAdd && (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={18} color="#0f0f12" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 10,
  },
  compact: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2a2a35',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '600',
  },
  brand: {
    color: '#7a7a90',
    fontSize: 12,
  },
  quantity: {
    color: '#c8f060',
    fontSize: 12,
    fontWeight: '600',
  },
  macros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  calories: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '700',
  },
  macroText: {
    fontSize: 12,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#c8f060',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
