import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useNutritionStore } from '@store/nutritionStore';
import { Modal } from '@components/ui/Modal';
import { MealCard } from '@components/nutrition/MealCard';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import type { MealTime, MealPlan } from '@types/index';

const MEAL_TIMES: { value: MealTime; label: string; icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { value: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
  { value: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { value: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

function getNext14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

export default function MealPrepScreen() {
  const user = useAuthStore((s) => s.user);
  const {
    meals,
    mealPlans,
    loadMeals,
    loadMealPlans,
    assignMealToPlan,
    removeMealFromPlan,
    completeMealPlan,
    generateShoppingList,
  } = useNutritionStore();
  const toast = useToast();
  const haptics = useHaptics();
  const [selectedDate, setSelectedDate] = useState(getNext14Days()[0]);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime>('breakfast');
  const [generatingList, setGeneratingList] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    await Promise.all([loadMeals(user.id), loadMealPlans(user.id)]);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const plansForDate = mealPlans.filter((p) => p.date === selectedDate);

  const handleAssignMeal = async (mealId: string) => {
    if (!user) return;
    await assignMealToPlan(user.id, selectedDate, selectedMealTime, mealId);
    setShowMealPicker(false);
    await haptics.success();
    toast.success('Meal planned!');
  };

  const handleGenerateShopping = async () => {
    if (!user) return;
    setGeneratingList(true);
    try {
      const dates = getNext14Days();
      await generateShoppingList(user.id, dates[0], dates[dates.length - 1]);
      await haptics.success();
      toast.success('Shopping list generated!');
    } catch {
      toast.error('Failed to generate shopping list.');
    } finally {
      setGeneratingList(false);
    }
  };

  const days = getNext14Days();

  return (
    <View style={styles.container}>
      {/* Day Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayScroll}
        contentContainerStyle={styles.dayScrollContent}
      >
        {days.map((date) => {
          const d = new Date(date);
          const isToday = date === days[0];
          const isSelected = date === selectedDate;
          const hasPlans = mealPlans.some((p) => p.date === date);
          return (
            <TouchableOpacity
              key={date}
              style={[styles.dayChip, isSelected && styles.dayChipActive]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>
                {isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
                {d.getDate()}
              </Text>
              {hasPlans && <View style={[styles.planDot, isSelected && styles.planDotActive]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected Date Meals */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.dateHeader}>
          <Text style={styles.dateTitle}>
            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {MEAL_TIMES.map((mt) => {
          const plansForTime = plansForDate.filter((p) => p.meal_time === mt.value);
          return (
            <View key={mt.value} style={styles.mealTimeSection}>
              <View style={styles.mealTimeHeader}>
                <Ionicons name={mt.icon as any} size={16} color="#7a7a90" />
                <Text style={styles.mealTimeLabel}>{mt.label}</Text>
                <TouchableOpacity
                  style={styles.addMealTimeBtn}
                  onPress={() => {
                    setSelectedMealTime(mt.value);
                    setShowMealPicker(true);
                  }}
                >
                  <Ionicons name="add" size={16} color="#c8f060" />
                </TouchableOpacity>
              </View>

              {plansForTime.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptySlot}
                  onPress={() => {
                    setSelectedMealTime(mt.value);
                    setShowMealPicker(true);
                  }}
                >
                  <Text style={styles.emptySlotText}>+ Add {mt.label.toLowerCase()}</Text>
                </TouchableOpacity>
              ) : (
                plansForTime.map((plan) => (
                  <View key={plan.id} style={styles.planCard}>
                    <View style={styles.planCardLeft}>
                      {plan.is_completed && (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#60f090" />
                          <Text style={styles.completedText}>Done</Text>
                        </View>
                      )}
                      <Text style={styles.planMealName}>{plan.meal?.name ?? 'Meal'}</Text>
                      <Text style={styles.planMealCalories}>
                        {plan.meal?.total_calories.toFixed(0)} kcal
                      </Text>
                    </View>
                    <View style={styles.planCardActions}>
                      {!plan.is_completed && (
                        <TouchableOpacity
                          style={styles.completeBtn}
                          onPress={async () => {
                            await completeMealPlan(plan.id);
                            await haptics.success();
                          }}
                        >
                          <Ionicons name="checkmark" size={14} color="#60f090" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={async () => {
                          await removeMealFromPlan(plan.id);
                          await haptics.light();
                        }}
                      >
                        <Ionicons name="close" size={14} color="#f06060" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}

        {/* Generate Shopping List */}
        <TouchableOpacity
          style={styles.shoppingBtn}
          onPress={handleGenerateShopping}
          disabled={generatingList}
        >
          <Ionicons name="cart-outline" size={20} color="#0f0f12" />
          <Text style={styles.shoppingBtnText}>
            {generatingList ? 'Generating…' : 'Generate Shopping List (14 days)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Meal Picker Modal */}
      <Modal visible={showMealPicker} onClose={() => setShowMealPicker(false)} title={`Choose ${selectedMealTime.charAt(0).toUpperCase() + selectedMealTime.slice(1)}`} fullHeight scrollable>
        {meals.length === 0 ? (
          <View style={styles.noMeals}>
            <Text style={styles.noMealsText}>No meals created yet. Create meals in the Nutrition tab first.</Text>
          </View>
        ) : (
          meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              showActions={false}
              onPress={() => handleAssignMeal(meal.id)}
            />
          ))
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  dayScroll: { maxHeight: 90 },
  dayScrollContent: { padding: 16, gap: 8, paddingBottom: 0 },
  dayChip: {
    width: 60, alignItems: 'center', paddingVertical: 8,
    backgroundColor: '#16161c', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a35',
  },
  dayChipActive: { backgroundColor: '#c8f060', borderColor: '#c8f060' },
  dayName: { color: '#7a7a90', fontSize: 11, fontWeight: '600' },
  dayNameActive: { color: '#0f0f12' },
  dayNum: { color: '#f0f0f0', fontSize: 18, fontWeight: '800', marginTop: 2 },
  dayNumActive: { color: '#0f0f12' },
  planDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#c8f060', marginTop: 4 },
  planDotActive: { backgroundColor: '#0f0f12' },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 16, paddingBottom: 48 },
  dateHeader: { paddingBottom: 4 },
  dateTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  mealTimeSection: { gap: 8 },
  mealTimeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  mealTimeLabel: { flex: 1, color: '#7a7a90', fontSize: 14, fontWeight: '600' },
  addMealTimeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(200,240,96,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a2a35',
  },
  emptySlot: {
    backgroundColor: '#16161c', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a35', borderStyle: 'dashed', alignItems: 'center',
  },
  emptySlotText: { color: '#3a3a4a', fontSize: 14, fontWeight: '600' },
  planCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16161c', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  planCardLeft: { flex: 1, gap: 2 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completedText: { color: '#60f090', fontSize: 11, fontWeight: '600' },
  planMealName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  planMealCalories: { color: '#7a7a90', fontSize: 12 },
  planCardActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  completeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(96,240,144,0.1)', borderWidth: 1, borderColor: 'rgba(96,240,144,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  shoppingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#c8f060', borderRadius: 16, paddingVertical: 16, marginTop: 8,
  },
  shoppingBtnText: { color: '#0f0f12', fontSize: 15, fontWeight: '700' },
  noMeals: { padding: 24, alignItems: 'center' },
  noMealsText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
});
