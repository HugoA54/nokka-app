import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useNutritionStore } from '@store/nutritionStore';
import { FoodSearchModal } from '@components/nutrition/FoodSearchModal';
import { FoodCard } from '@components/nutrition/FoodCard';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import type { Food, FoodWithQuantity } from '@types/index';

export default function MealEditorScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { createMeal, loadFoods, ensureFoodExists } = useNutritionStore();
  const toast = useToast();
  const haptics = useHaptics();

  const [mealName, setMealName] = useState('');
  const [foods, setFoods] = useState<FoodWithQuantity[]>([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) loadFoods(user.id);
  }, [user?.id]);

  const totals = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + f.computed_calories,
      protein: acc.protein + f.computed_protein,
      carbs: acc.carbs + f.computed_carbs,
      fats: acc.fats + f.computed_fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const handleAddFood = async (food: Food, quantity: number) => {
    if (!user) return;
    // Ensure food is in our DB
    let savedFood = food;
    if (food.id.startsWith('off_') || food.id.startsWith('popular_')) {
      savedFood = await ensureFoodExists(user.id, food);
    }

    const factor = quantity / 100;
    const withQty: FoodWithQuantity = {
      ...savedFood,
      quantity,
      computed_calories: Math.round(savedFood.calories_per_100g * factor),
      computed_protein: Math.round(savedFood.protein_per_100g * factor * 10) / 10,
      computed_carbs: Math.round(savedFood.carbs_per_100g * factor * 10) / 10,
      computed_fats: Math.round(savedFood.fats_per_100g * factor * 10) / 10,
    };

    setFoods((prev) => [...prev, withQty]);
    setShowFoodSearch(false);
  };

  const handleRemoveFood = (foodId: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== foodId));
  };

  const handleUpdateQuantity = (foodId: string, newQty: number) => {
    setFoods((prev) =>
      prev.map((f) => {
        if (f.id !== foodId) return f;
        const factor = newQty / 100;
        return {
          ...f,
          quantity: newQty,
          computed_calories: Math.round(f.calories_per_100g * factor),
          computed_protein: Math.round(f.protein_per_100g * factor * 10) / 10,
          computed_carbs: Math.round(f.carbs_per_100g * factor * 10) / 10,
          computed_fats: Math.round(f.fats_per_100g * factor * 10) / 10,
        };
      })
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (!mealName.trim()) { toast.error('Please enter a meal name.'); return; }
    if (foods.length === 0) { toast.error('Add at least one food item.'); return; }

    setIsSaving(true);
    try {
      await createMeal(
        user.id,
        {
          name: mealName.trim(),
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_carbs: totals.carbs,
          total_fats: totals.fats,
          image_url: null,
        },
        foods
      );
      await haptics.success();
      toast.success(`"${mealName}" saved!`);
      router.back();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save meal.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Meal Name */}
        <View style={styles.nameSection}>
          <Text style={styles.fieldLabel}>Meal Name</Text>
          <TextInput
            style={styles.nameInput}
            value={mealName}
            onChangeText={setMealName}
            placeholder="e.g. Post-Workout Chicken Bowl"
            placeholderTextColor="#3a3a4a"
            autoFocus
          />
        </View>

        {/* Totals Preview */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Total Nutrition</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{totals.calories}</Text>
              <Text style={styles.totalLabel}>kcal</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#60d4f0' }]}>{totals.protein.toFixed(1)}g</Text>
              <Text style={styles.totalLabel}>Protein</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#f0c060' }]}>{totals.carbs.toFixed(1)}g</Text>
              <Text style={styles.totalLabel}>Carbs</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, { color: '#f060a8' }]}>{totals.fats.toFixed(1)}g</Text>
              <Text style={styles.totalLabel}>Fats</Text>
            </View>
          </View>
        </View>

        {/* Food List */}
        <View style={styles.foodsSection}>
          <View style={styles.foodsHeader}>
            <Text style={styles.sectionTitle}>Foods ({foods.length})</Text>
            <TouchableOpacity
              style={styles.addFoodBtn}
              onPress={() => setShowFoodSearch(true)}
            >
              <Ionicons name="add" size={18} color="#0f0f12" />
              <Text style={styles.addFoodBtnText}>Add Food</Text>
            </TouchableOpacity>
          </View>

          {foods.length === 0 ? (
            <View style={styles.emptyFoods}>
              <Ionicons name="basket-outline" size={40} color="#2a2a35" />
              <Text style={styles.emptyFoodsText}>No foods added yet</Text>
            </View>
          ) : (
            foods.map((food) => (
              <View key={food.id} style={styles.foodRow}>
                <FoodCard food={food} quantity={food.quantity} showMacros compact />
                <View style={styles.foodRowActions}>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleUpdateQuantity(food.id, Math.max(10, food.quantity - 10))}
                    >
                      <Ionicons name="remove" size={14} color="#f0f0f0" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{food.quantity}g</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => handleUpdateQuantity(food.id, food.quantity + 10)}
                    >
                      <Ionicons name="add" size={14} color="#f0f0f0" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveFood(food.id)}>
                    <Ionicons name="trash-outline" size={18} color="#f06060" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#0f0f12" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#0f0f12" />
              <Text style={styles.saveBtnText}>Save Meal</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FoodSearchModal
        visible={showFoodSearch}
        onClose={() => setShowFoodSearch(false)}
        onSelect={handleAddFood}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20, gap: 20, paddingBottom: 100 },
  nameSection: { gap: 8 },
  fieldLabel: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
  nameInput: {
    backgroundColor: '#16161c', borderRadius: 14, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 16, paddingVertical: 16,
    color: '#f0f0f0', fontSize: 18, fontWeight: '700',
  },
  totalsCard: {
    backgroundColor: '#16161c', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2a2a35', gap: 12,
  },
  totalsTitle: { color: '#7a7a90', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalItem: { alignItems: 'center', gap: 4 },
  totalValue: { color: '#f0f0f0', fontSize: 20, fontWeight: '800' },
  totalLabel: { color: '#7a7a90', fontSize: 11 },
  foodsSection: { gap: 12 },
  foodsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  addFoodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#c8f060', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addFoodBtnText: { color: '#0f0f12', fontSize: 13, fontWeight: '700' },
  emptyFoods: {
    backgroundColor: '#16161c', borderRadius: 14, padding: 28,
    alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#2a2a35',
  },
  emptyFoodsText: { color: '#7a7a90', fontSize: 14 },
  foodRow: { gap: 6 },
  foodRowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2a2a35', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  qtyBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#3a3a4a', alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { color: '#f0f0f0', fontSize: 14, fontWeight: '600', minWidth: 40, textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, backgroundColor: '#0f0f12',
    borderTopWidth: 1, borderTopColor: '#2a2a35',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 14, paddingVertical: 16,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
});
