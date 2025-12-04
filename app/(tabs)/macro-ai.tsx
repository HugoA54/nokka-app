import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuthStore } from '@store/authStore';
import { useMacroAIStore } from '@store/macroAIStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useNutritionStore } from '@store/nutritionStore';
import { MacroSummary } from '@components/dashboard/MacroSummary';
import { PhotoAnalyzer } from '@components/ai/PhotoAnalyzer';
import { Modal } from '@components/ui/Modal';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import type { AIMeal, AIMacroGoals } from '@types/index';

type TabView = 'today' | 'camera' | 'history';

function GoalsModal({
  visible,
  goals,
  onSave,
  onClose,
}: {
  visible: boolean;
  goals: AIMacroGoals;
  onSave: (g: AIMacroGoals) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(goals);
  useEffect(() => { setLocal(goals); }, [goals]);

  const fields: { key: keyof AIMacroGoals; label: string; unit: string; color: string }[] = [
    { key: 'calories', label: 'Calories', unit: 'kcal', color: '#f0f0f0' },
    { key: 'proteines', label: 'Protein', unit: 'g', color: '#60d4f0' },
    { key: 'glucides', label: 'Carbs', unit: 'g', color: '#f0c060' },
    { key: 'lipides', label: 'Fats', unit: 'g', color: '#f060a8' },
  ];

  return (
    <Modal visible={visible} onClose={onClose} title="Daily Goals" scrollable>
      {fields.map(({ key, label, unit, color }) => (
        <View key={key} style={goalStyles.field}>
          <View style={goalStyles.fieldLabel}>
            <View style={[goalStyles.dot, { backgroundColor: color }]} />
            <Text style={goalStyles.label}>{label} ({unit})</Text>
          </View>
          <TextInput
            style={goalStyles.input}
            value={String(local[key])}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              setLocal((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#3a3a4a"
          />
        </View>
      ))}
      <TouchableOpacity style={goalStyles.saveBtn} onPress={() => onSave(local)}>
        <Text style={goalStyles.saveBtnText}>Save Goals</Text>
      </TouchableOpacity>
    </Modal>
  );
}

const goalStyles = StyleSheet.create({
  field: { gap: 6, marginBottom: 14 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: '#0f0f12', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 14, paddingVertical: 12,
    color: '#f0f0f0', fontSize: 18, fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#c8f060', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { color: '#0f0f12', fontWeight: '700', fontSize: 16 },
});

function EditMealModal({
  meal,
  visible,
  onSave,
  onClose,
}: {
  meal: AIMeal | null;
  visible: boolean;
  onSave: (updates: Partial<AIMeal>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [proteines, setProteines] = useState('');
  const [glucides, setGlucides] = useState('');
  const [lipides, setLipides] = useState('');

  useEffect(() => {
    if (meal) {
      setName(meal.name);
      setCalories(String(meal.calories));
      setProteines(String(meal.proteines));
      setGlucides(String(meal.glucides));
      setLipides(String(meal.lipides));
    }
  }, [meal]);

  return (
    <Modal visible={visible} onClose={onClose} title="Edit Meal" scrollable>
      {[
        { label: 'Meal Name', value: name, onchange: setName, keyboard: 'default' as const, color: '#f0f0f0' },
        { label: 'Calories (kcal)', value: calories, onchange: setCalories, keyboard: 'number-pad' as const, color: '#f0f0f0' },
        { label: 'Protein (g)', value: proteines, onchange: setProteines, keyboard: 'number-pad' as const, color: '#60d4f0' },
        { label: 'Carbs (g)', value: glucides, onchange: setGlucides, keyboard: 'number-pad' as const, color: '#f0c060' },
        { label: 'Fats (g)', value: lipides, onchange: setLipides, keyboard: 'number-pad' as const, color: '#f060a8' },
      ].map(({ label, value, onchange, keyboard, color }) => (
        <View key={label} style={goalStyles.field}>
          <Text style={[goalStyles.label, { color }]}>{label}</Text>
          <TextInput
            style={goalStyles.input}
            value={value}
            onChangeText={onchange}
            keyboardType={keyboard}
            placeholderTextColor="#3a3a4a"
          />
        </View>
      ))}
      <TouchableOpacity
        style={goalStyles.saveBtn}
        onPress={() =>
          onSave({
            name,
            calories: parseInt(calories) || 0,
            proteines: parseInt(proteines) || 0,
            glucides: parseInt(glucides) || 0,
            lipides: parseInt(lipides) || 0,
          })
        }
      >
        <Text style={goalStyles.saveBtnText}>Save Changes</Text>
      </TouchableOpacity>
    </Modal>
  );
}

export default function MacroAIScreen() {
  const user = useAuthStore((s) => s.user);
  const {
    meals,
    goals,
    isLoadingMeals,
    fetchTodayMeals,
    loadGoals,
    updateGoals,
    deleteMeal,
    updateMeal,
  } = useMacroAIStore();
  const { userProfile, loadUserProfile, getDailyMetrics } = useWorkoutStore();
  const { todayLog, loadTodayLog } = useNutritionStore();
  const toast = useToast();
  const haptics = useHaptics();

  const [tab, setTab] = useState<TabView>('today');
  const [showGoals, setShowGoals] = useState(false);
  const [editingMeal, setEditingMeal] = useState<AIMeal | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Compute profile-based goals
  const dailyMetrics = useMemo(() => getDailyMetrics([]), [userProfile]);
  const profileGoals: AIMacroGoals | undefined = dailyMetrics
    ? {
        calories: Math.round(dailyMetrics.dailyGoal),
        proteines: Math.round(dailyMetrics.macros.protein),
        glucides: Math.round(dailyMetrics.macros.carbs),
        lipides: Math.round(dailyMetrics.macros.fats),
      }
    : undefined;

  const loadData = useCallback(async () => {
    if (!user) return;
    if (!userProfile) await loadUserProfile(user.id);
    const metrics = getDailyMetrics([]);
    const pGoals: AIMacroGoals | undefined = metrics
      ? {
          calories: Math.round(metrics.dailyGoal),
          proteines: Math.round(metrics.macros.protein),
          glucides: Math.round(metrics.macros.carbs),
          lipides: Math.round(metrics.macros.fats),
        }
      : undefined;
    await Promise.all([
      fetchTodayMeals(user.id),
      loadGoals(user.id, pGoals),
      loadTodayLog(user.id),
    ]);
  }, [user?.id, userProfile]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // AI meals totals
  const aiTotals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteines: acc.proteines + m.proteines,
      glucides: acc.glucides + m.glucides,
      lipides: acc.lipides + m.lipides,
    }),
    { calories: 0, proteines: 0, glucides: 0, lipides: 0 }
  );

  // Traditional log totals (from nutritionStore)
  const tradCal = todayLog?.calories ?? 0;
  const tradProtein = todayLog?.protein_grams ?? 0;
  const tradCarbs = todayLog?.carbs_grams ?? 0;
  const tradFats = todayLog?.fats_grams ?? 0;

  // Combined totals
  const totals = {
    calories: aiTotals.calories + tradCal,
    proteines: aiTotals.proteines + tradProtein,
    glucides: aiTotals.glucides + tradCarbs,
    lipides: aiTotals.lipides + tradFats,
  };

  const handleDeleteMeal = (meal: AIMeal) => {
    Alert.alert('Delete Meal', `Delete "${meal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await haptics.medium();
          await deleteMeal(user!.id, meal.id);
          toast.success('Meal deleted.');
        },
      },
    ]);
  };

  const handleSaveMealEdit = async (updates: Partial<AIMeal>) => {
    if (!editingMeal || !user) return;
    await updateMeal(user.id, editingMeal.id, updates);
    setEditingMeal(null);
    toast.success('Meal updated!');
  };

  const handleSaveGoals = async (newGoals: AIMacroGoals) => {
    if (!user) return;
    await updateGoals(user.id, newGoals);
    setShowGoals(false);
    toast.success('Goals saved!');
  };


  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'today', label: 'Today', icon: 'today-outline' },
          { key: 'camera', label: 'AI Camera', icon: 'camera-outline' },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={tab === t.key ? '#0f0f12' : '#7a7a90'}
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'camera' ? (
        <PhotoAnalyzer />
      ) : (
        <FlatList
          data={meals}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
          ListHeaderComponent={
            <View style={styles.header}>
              <MacroSummary
                totals={totals}
                goals={goals}
                onEditGoals={() => setShowGoals(true)}
                title="Daily Macros (Combined)"
              />
              <View style={styles.mealsHeader}>
                <Text style={styles.mealsTitle}>Today's Meals</Text>
                <TouchableOpacity
                  style={styles.cameraBtn}
                  onPress={() => setTab('camera')}
                >
                  <Ionicons name="camera" size={16} color="#0f0f12" />
                  <Text style={styles.cameraBtnText}>Analyze</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.mealCard}>
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.mealImage} contentFit="cover" />
              )}
              <View style={styles.mealContent}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealName}>{item.name}</Text>
                  <View style={styles.mealActions}>
                    <TouchableOpacity onPress={() => setEditingMeal(item)}>
                      <Ionicons name="pencil-outline" size={16} color="#7a7a90" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteMeal(item)}>
                      <Ionicons name="trash-outline" size={16} color="#f06060" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.mealCalories}>{item.calories} kcal</Text>
                <View style={styles.mealMacros}>
                  <Text style={[styles.mealMacro, { color: '#60d4f0' }]}>P{item.proteines}g</Text>
                  <Text style={[styles.mealMacro, { color: '#f0c060' }]}>C{item.glucides}g</Text>
                  <Text style={[styles.mealMacro, { color: '#f060a8' }]}>F{item.lipides}g</Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            !isLoadingMeals ? (
              <View style={styles.empty}>
                <Ionicons name="camera-outline" size={52} color="#2a2a35" />
                <Text style={styles.emptyTitle}>No meals logged today</Text>
                <Text style={styles.emptyText}>Take a photo to analyze your first meal</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setTab('camera')}>
                  <Ionicons name="camera-outline" size={18} color="#0f0f12" />
                  <Text style={styles.emptyBtnText}>Open AI Camera</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <GoalsModal
        visible={showGoals}
        goals={goals}
        onSave={handleSaveGoals}
        onClose={() => setShowGoals(false)}
      />
      <EditMealModal
        meal={editingMeal}
        visible={!!editingMeal}
        onSave={handleSaveMealEdit}
        onClose={() => setEditingMeal(null)}
      />
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
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 9,
  },
  tabActive: { backgroundColor: '#c8f060' },
  tabText: { color: '#7a7a90', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#0f0f12' },
  header: { gap: 20, marginBottom: 8 },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealsTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#c8f060', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  cameraBtnText: { color: '#0f0f12', fontSize: 13, fontWeight: '700' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  mealCard: {
    backgroundColor: '#16161c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    overflow: 'hidden',
  },
  mealImage: { width: '100%', height: 140 },
  mealContent: { padding: 14, gap: 6 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { flex: 1, color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  mealActions: { flexDirection: 'row', gap: 14 },
  mealCalories: { color: '#f0f0f0', fontSize: 22, fontWeight: '800' },
  mealMacros: { flexDirection: 'row', gap: 12 },
  mealMacro: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, padding: 24 },
  emptyTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#c8f060', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { color: '#0f0f12', fontWeight: '700', fontSize: 15 },
});
