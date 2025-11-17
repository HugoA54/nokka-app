import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Modal as RNModal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useNutritionStore } from '@store/nutritionStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useMacroAIStore } from '@store/macroAIStore';
import { MealCard } from '@components/nutrition/MealCard';
import { FoodSearchModal } from '@components/nutrition/FoodSearchModal';
import { BarcodeScanner } from '@components/nutrition/BarcodeScanner';
import { MacroBar } from '@components/ui/MacroBar';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';

type NutritionTab = 'diary' | 'meals' | 'planning';

export default function NutritionScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    meals,
    todayLog,
    todayMealEntries,
    isLoadingMeals,
    loadMeals,
    loadTodayLog,
    addMealToToday,
    removeMealFromToday,
    updateWaterCount,
  } = useNutritionStore();
  const { userProfile, loadUserProfile, getDailyMetrics } = useWorkoutStore();
  const { meals: aiMeals, fetchTodayMeals } = useMacroAIStore();
  const toast = useToast();
  const haptics = useHaptics();
  const [tab, setTab] = useState<NutritionTab>('diary');
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannedFood, setScannedFood] = useState<import('@types/index').Food | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Compute profile-based daily goals
  const dailyMetrics = useMemo(() => getDailyMetrics([]), [userProfile]);
  const profileGoals = dailyMetrics
    ? {
        calorie_goal: Math.round(dailyMetrics.dailyGoal),
        protein_goal: Math.round(dailyMetrics.macros.protein),
        carbs_goal: Math.round(dailyMetrics.macros.carbs),
        fats_goal: Math.round(dailyMetrics.macros.fats),
      }
    : undefined;

  const loadData = useCallback(async () => {
    if (!user) return;
    if (!userProfile) await loadUserProfile(user.id);
    const goals = getDailyMetrics([]);
    const goalsArg = goals
      ? {
          calorie_goal: Math.round(goals.dailyGoal),
          protein_goal: Math.round(goals.macros.protein),
          carbs_goal: Math.round(goals.macros.carbs),
          fats_goal: Math.round(goals.macros.fats),
        }
      : undefined;
    await Promise.all([
      loadTodayLog(user.id, goalsArg),
      loadMeals(user.id),
      fetchTodayMeals(user.id),
    ]);
  }, [user?.id, userProfile]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddMeal = async (mealId: string) => {
    if (!user) return;
    try {
      await addMealToToday(user.id, mealId, profileGoals);
      await haptics.success();
      toast.success('Meal added to today!');
      setTab('diary');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to add meal.');
    }
  };

  const handleRemoveEntry = async (entryId: string) => {
    try {
      await removeMealFromToday(entryId);
      await haptics.light();
      toast.success('Entry removed.');
    } catch {
      toast.error('Failed to remove entry.');
    }
  };

  const handleWater = async (count: number) => {
    if (!user) return;
    await updateWaterCount(user.id, count);
    await haptics.light();
  };

  // Traditional log totals — computed from entries (reactive) not from DB aggregate column
  const tradCal = todayMealEntries.reduce((s, e) => s + (e.calories ?? 0), 0);
  const tradProtein = todayMealEntries.reduce((s, e) => s + (e.protein ?? 0), 0);
  const tradCarbs = todayMealEntries.reduce((s, e) => s + (e.carbs ?? 0), 0);
  const tradFats = todayMealEntries.reduce((s, e) => s + (e.fats ?? 0), 0);

  // AI meals totals
  const aiCal = aiMeals.reduce((s, m) => s + m.calories, 0);
  const aiProtein = aiMeals.reduce((s, m) => s + m.proteines, 0);
  const aiCarbs = aiMeals.reduce((s, m) => s + m.glucides, 0);
  const aiFats = aiMeals.reduce((s, m) => s + m.lipides, 0);

  // Combined totals
  const cal = tradCal + aiCal;
  const protein = tradProtein + aiProtein;
  const carbs = tradCarbs + aiCarbs;
  const fats = tradFats + aiFats;

  // Goals: use profile if available, else stored log goals, else defaults
  const calGoal = profileGoals?.calorie_goal ?? todayLog?.calorie_goal ?? 2000;
  const proteinGoal = profileGoals?.protein_goal ?? todayLog?.protein_goal ?? 150;
  const carbsGoal = profileGoals?.carbs_goal ?? todayLog?.carbs_goal ?? 250;
  const fatsGoal = profileGoals?.fats_goal ?? todayLog?.fats_goal ?? 65;
  const water = todayLog?.water_count ?? 0;

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['diary', 'meals', 'planning'] as NutritionTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'diary' && (
        <FlatList
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* Calorie Summary */}
              <View style={styles.calCard}>
                <View style={styles.calRow}>
                  <View>
                    <Text style={styles.calValue}>{Math.round(cal)}</Text>
                    <Text style={styles.calLabel}>kcal eaten</Text>
                  </View>
                  <View style={styles.calCircle}>
                    <Text style={styles.calPercent}>
                      {calGoal > 0 ? Math.round((cal / calGoal) * 100) : 0}%
                    </Text>
                  </View>
                  <View style={styles.calRight}>
                    <Text style={styles.calRemainingValue}>{Math.max(0, calGoal - cal).toFixed(0)}</Text>
                    <Text style={styles.calLabel}>remaining</Text>
                  </View>
                </View>
                {/* Macro bars */}
                <View style={styles.macros}>
                  <MacroBar label="Protein" current={protein} goal={proteinGoal} color="#60d4f0" />
                  <MacroBar label="Carbs" current={carbs} goal={carbsGoal} color="#f0c060" />
                  <MacroBar label="Fats" current={fats} goal={fatsGoal} color="#f060a8" />
                </View>
              </View>

              {/* Water Tracker */}
              <View style={styles.waterCard}>
                <View style={styles.waterHeader}>
                  <Ionicons name="water" size={18} color="#60d4f0" />
                  <Text style={styles.waterTitle}>Water</Text>
                  <Text style={styles.waterCount}>{water} / 8 glasses</Text>
                </View>
                <View style={styles.waterGlasses}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.glass, i < water && styles.glassFilled]}
                      onPress={() => handleWater(i < water ? i : i + 1)}
                    >
                      <Ionicons
                        name="water"
                        size={18}
                        color={i < water ? '#60d4f0' : '#2a2a35'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Add Food Actions */}
              <View style={styles.addActions}>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowFoodSearch(true)}>
                  <Ionicons name="search" size={16} color="#0f0f12" />
                  <Text style={styles.addBtnText}>Search Food</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtnSecondary} onPress={() => setShowBarcodeScanner(true)}>
                  <Ionicons name="barcode-outline" size={16} color="#f0f0f0" />
                  <Text style={styles.addBtnSecondaryText}>Scan</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Today's Entries</Text>
            </View>
          }
          data={todayMealEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.entryCard}>
              <View style={styles.entryInfo}>
                <Text style={styles.entryName}>{item.meal?.name ?? 'Meal'}</Text>
                <Text style={styles.entryMacros}>
                  {Math.round(item.calories)} kcal  ·  P{item.protein.toFixed(0)}g  C{item.carbs.toFixed(0)}g  F{item.fats.toFixed(0)}g
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveEntry(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color="#7a7a90" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="nutrition-outline" size={40} color="#2a2a35" />
              <Text style={styles.emptyText}>No entries yet. Start by adding food!</Text>
            </View>
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {tab === 'meals' && (
        <FlatList
          data={meals}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
          ListHeaderComponent={
            <View style={styles.mealsHeader}>
              <TouchableOpacity
                style={styles.newMealBtn}
                onPress={() => router.push('/meal/editor')}
              >
                <Ionicons name="add" size={20} color="#0f0f12" />
                <Text style={styles.newMealBtnText}>Create Meal</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <MealCard
              meal={item}
              onAddToToday={() => handleAddMeal(item.id)}
              onEdit={() => router.push('/meal/editor')}
            />
          )}
          ListEmptyComponent={
            !isLoadingMeals ? (
              <View style={styles.empty}>
                <Ionicons name="restaurant-outline" size={52} color="#2a2a35" />
                <Text style={styles.emptyTitle}>No meals yet</Text>
                <Text style={styles.emptyText}>Create reusable meals from your food library</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {tab === 'planning' && (
        <View style={styles.planningContainer}>
          <TouchableOpacity
            style={styles.planningBtn}
            onPress={() => router.push('/meal/prep')}
          >
            <Ionicons name="calendar-outline" size={22} color="#0f0f12" />
            <Text style={styles.planningBtnText}>Open Meal Planner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shoppingBtn}
            onPress={() => router.push('/shopping-list')}
          >
            <Ionicons name="cart-outline" size={22} color="#f0f0f0" />
            <Text style={styles.shoppingBtnText}>Shopping List</Text>
          </TouchableOpacity>
        </View>
      )}

      <FoodSearchModal
        visible={showFoodSearch}
        onClose={() => { setShowFoodSearch(false); setScannedFood(null); }}
        onSelect={async (food, quantity) => {
          // Quick-add as nutrition log entry
          toast.info(`Added ${food.name} (${quantity}g)`);
          setShowFoodSearch(false);
          setScannedFood(null);
        }}
        preSelectedFood={scannedFood}
      />

      <RNModal visible={showBarcodeScanner} animationType="slide">
        <BarcodeScanner
          onFound={(food) => {
            setScannedFood(food);
            setShowBarcodeScanner(false);
            setShowFoodSearch(true);
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#c8f060' },
  tabText: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0f0f12' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  headerSection: { gap: 14, marginBottom: 8 },
  calCard: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  calRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calValue: { color: '#f0f0f0', fontSize: 32, fontWeight: '800' },
  calLabel: { color: '#7a7a90', fontSize: 12 },
  calCircle: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 3, borderColor: '#c8f060',
    alignItems: 'center', justifyContent: 'center',
  },
  calPercent: { color: '#c8f060', fontSize: 14, fontWeight: '700' },
  calRight: { alignItems: 'flex-end' },
  calRemainingValue: { color: '#f0f0f0', fontSize: 22, fontWeight: '700' },
  macros: { gap: 10 },
  waterCard: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  waterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waterTitle: { flex: 1, color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  waterCount: { color: '#7a7a90', fontSize: 13 },
  waterGlasses: { flexDirection: 'row', gap: 6 },
  glass: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: '#0f0f12', borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  glassFilled: { backgroundColor: 'rgba(96,212,240,0.1)', borderColor: '#60d4f0' },
  addActions: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 12, paddingVertical: 14,
  },
  addBtnText: { color: '#0f0f12', fontSize: 15, fontWeight: '700' },
  addBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#2a2a35', borderRadius: 12, paddingVertical: 14,
  },
  addBtnSecondaryText: { color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 10,
  },
  entryInfo: { flex: 1 },
  entryName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  entryMacros: { color: '#7a7a90', fontSize: 12, marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, padding: 24 },
  emptyTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
  mealsHeader: { marginBottom: 8 },
  newMealBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#c8f060', borderRadius: 14, paddingVertical: 14,
  },
  newMealBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
  planningContainer: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  planningBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#c8f060', borderRadius: 16, paddingVertical: 18,
  },
  planningBtnText: { color: '#0f0f12', fontSize: 17, fontWeight: '700' },
  shoppingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#2a2a35', borderRadius: 16, paddingVertical: 18,
  },
  shoppingBtnText: { color: '#f0f0f0', fontSize: 17, fontWeight: '600' },
});
