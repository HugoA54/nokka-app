import { create } from 'zustand';
import { supabase } from '@services/supabase';
import { openFoodFactsService } from '@services/openFoodFactsService';
import type {
  Food,
  FoodWithQuantity,
  Meal,
  MealFood,
  MealPlan,
  NutritionLog,
  NutritionLogMeal,
  ShoppingItem,
  ShoppingCategory,
  MealTime,
} from '@types/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMacros(food: Food, quantity: number): Omit<FoodWithQuantity, keyof Food | 'quantity'> {
  const factor = quantity / 100;
  return {
    computed_calories: Math.round(food.calories_per_100g * factor),
    computed_protein: Math.round(food.protein_per_100g * factor * 10) / 10,
    computed_carbs: Math.round(food.carbs_per_100g * factor * 10) / 10,
    computed_fats: Math.round(food.fats_per_100g * factor * 10) / 10,
  };
}

function categorizeFood(name: string): ShoppingCategory {
  const lower = name.toLowerCase();
  if (/chicken|beef|pork|fish|turkey|salmon|tuna|egg|tofu|shrimp/.test(lower)) return 'proteins';
  if (/spinach|broccoli|carrot|tomato|lettuce|pepper|onion|garlic|cucumber|zucchini/.test(lower)) return 'vegetables';
  if (/apple|banana|orange|berry|grape|mango|strawberry|blueberry/.test(lower)) return 'fruits';
  if (/milk|cheese|yogurt|butter|cream|whey/.test(lower)) return 'dairy';
  if (/rice|pasta|bread|oat|quinoa|flour|cereal/.test(lower)) return 'grains';
  if (/sauce|oil|vinegar|salt|pepper|spice|ketchup|mustard/.test(lower)) return 'condiments';
  return 'other';
}

function getWeekStart(date?: Date): string {
  const d = date ?? new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toLocaleDateString('en-CA');
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface NutritionState {
  foods: Food[];
  meals: Meal[];
  mealFoods: MealFood[];
  mealPlans: MealPlan[];
  shoppingList: ShoppingItem[];
  todayLog: NutritionLog | null;
  todayMealEntries: NutritionLogMeal[];
  selectedMeal: Meal | null;
  isLoadingFoods: boolean;
  isLoadingMeals: boolean;
  isSearchingFoods: boolean;
  foodRefreshTrigger: number;

  // Foods
  loadFoods: (userId: string) => Promise<void>;
  createFood: (userId: string, foodData: Omit<Food, 'id' | 'user_id' | 'times_used' | 'created_at' | 'updated_at'>) => Promise<Food>;
  updateFood: (foodId: string, updates: Partial<Food>) => Promise<void>;
  deleteFood: (foodId: string) => Promise<void>;
  searchFoods: (query: string, userId: string) => Promise<Food[]>;
  scanBarcode: (barcode: string, userId: string) => Promise<Food | null>;
  ensureFoodExists: (userId: string, item: Partial<Food>) => Promise<Food>;

  // Meals
  loadMeals: (userId: string) => Promise<void>;
  createMeal: (userId: string, mealData: Omit<Meal, 'id' | 'user_id' | 'created_at'>, foodsList: FoodWithQuantity[]) => Promise<Meal>;
  updateMeal: (mealId: string, updates: Partial<Meal>, foodsList?: FoodWithQuantity[]) => Promise<void>;
  deleteMeal: (mealId: string) => Promise<void>;
  loadMealFoods: (mealId: string) => Promise<MealFood[]>;
  setSelectedMeal: (meal: Meal | null) => void;

  // Daily Log
  loadTodayLog: (userId: string, dailyGoals?: { calorie_goal: number; protein_goal: number; carbs_goal: number; fats_goal: number }) => Promise<void>;
  addMealToToday: (userId: string, mealId: string, dailyGoals?: { calorie_goal: number; protein_goal: number; carbs_goal: number; fats_goal: number }) => Promise<void>;
  quickAddFood: (userId: string, food: FoodWithQuantity) => Promise<void>;
  removeMealFromToday: (entryId: string) => Promise<void>;
  updateWaterCount: (userId: string, count: number) => Promise<void>;
  updateNutritionLog: (
    userId: string,
    calories: number,
    waterCount: number,
    goal: number,
    macros: { protein: number; carbs: number; fats: number },
    macroGoals: { protein: number; carbs: number; fats: number }
  ) => Promise<void>;

  // Meal Plans
  loadMealPlans: (userId: string) => Promise<void>;
  assignMealToPlan: (userId: string, date: string, mealTime: MealTime, mealId: string) => Promise<void>;
  removeMealFromPlan: (planId: string) => Promise<void>;
  completeMealPlan: (planId: string) => Promise<void>;

  // Shopping List
  loadShoppingList: (userId: string) => Promise<void>;
  generateShoppingList: (userId: string, startDate: string, endDate: string) => Promise<void>;
  togglePurchased: (itemId: string) => Promise<void>;
  removeShoppingItem: (itemId: string) => Promise<void>;
  clearShoppingList: (userId: string) => Promise<void>;
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  foods: [],
  meals: [],
  mealFoods: [],
  mealPlans: [],
  shoppingList: [],
  todayLog: null,
  todayMealEntries: [],
  selectedMeal: null,
  isLoadingFoods: false,
  isLoadingMeals: false,
  isSearchingFoods: false,
  foodRefreshTrigger: 0,

  // ── Foods ──────────────────────────────────────────────────────────────────

  loadFoods: async (userId: string) => {
    set({ isLoadingFoods: true });
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('user_id', userId)
        .order('times_used', { ascending: false });
      if (error) throw error;
      set({ foods: data ?? [] });
    } catch (error) {
      console.error('[nutritionStore] loadFoods:', error);
    } finally {
      set({ isLoadingFoods: false });
    }
  },

  createFood: async (userId, foodData) => {
    const insertData = {
      ...foodData,
      user_id: userId,
      times_used: 0,
    };
    const { data, error } = await supabase
      .from('foods')
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    const created = data as Food;
    set((state) => ({ foods: [created, ...state.foods], foodRefreshTrigger: state.foodRefreshTrigger + 1 }));
    return created;
  },

  updateFood: async (foodId, updates) => {
    const { error } = await supabase.from('foods').update(updates).eq('id', foodId);
    if (error) throw error;
    set((state) => ({
      foods: state.foods.map((f) => (f.id === foodId ? { ...f, ...updates } : f)),
    }));
  },

  deleteFood: async (foodId) => {
    const { error } = await supabase.from('foods').delete().eq('id', foodId);
    if (error) throw error;
    set((state) => ({ foods: state.foods.filter((f) => f.id !== foodId) }));
  },

  searchFoods: async (query: string, userId: string): Promise<Food[]> => {
    set({ isSearchingFoods: true });
    try {
      const lower = query.toLowerCase();
      // 1. Search local database
      const { foods } = get();
      const local = foods.filter(
        (f) =>
          f.name.toLowerCase().includes(lower) ||
          (f.brand ?? '').toLowerCase().includes(lower)
      );
      // 2. If too few results, query OpenFoodFacts
      if (local.length < 5 && query.length > 2) {
        const remote = await openFoodFactsService.searchFoods(query, 1, 20);
        const remoteAsFoods: Food[] = remote.foods.map((p) => ({
          id: `off_${p.barcode ?? Math.random()}`,
          user_id: userId,
          name: p.name ?? 'Unknown',
          brand: p.brand ?? null,
          calories_per_100g: p.calories_per_100g ?? 0,
          protein_per_100g: p.protein_per_100g ?? 0,
          carbs_per_100g: p.carbs_per_100g ?? 0,
          fats_per_100g: p.fats_per_100g ?? 0,
          serving_size: p.serving_size ?? null,
          serving_unit: p.serving_unit ?? null,
          barcode: p.barcode ?? null,
          source: 'openfoodfacts' as const,
          times_used: 0,
        }));
        const combined = [...local, ...remoteAsFoods].filter(
          (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i
        );
        return combined;
      }
      return local;
    } catch (error) {
      console.error('[nutritionStore] searchFoods:', error);
      return get().foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
    } finally {
      set({ isSearchingFoods: false });
    }
  },

  scanBarcode: async (barcode: string, userId: string): Promise<Food | null> => {
    // Check local first
    const local = get().foods.find((f) => f.barcode === barcode);
    if (local) return local;
    // Query OpenFoodFacts
    try {
      const product = await openFoodFactsService.getFoodByBarcode(barcode);
      if (!product) return null;
      const food: Food = {
        id: `off_${barcode}`,
        user_id: userId,
        name: product.name ?? 'Unknown',
        brand: product.brand ?? null,
        calories_per_100g: product.calories_per_100g ?? 0,
        protein_per_100g: product.protein_per_100g ?? 0,
        carbs_per_100g: product.carbs_per_100g ?? 0,
        fats_per_100g: product.fats_per_100g ?? 0,
        serving_size: product.serving_size ?? null,
        serving_unit: product.serving_unit ?? null,
        barcode: barcode,
        source: 'openfoodfacts',
        times_used: 0,
      };
      return food;
    } catch (error) {
      console.error('[nutritionStore] scanBarcode:', error);
      return null;
    }
  },

  ensureFoodExists: async (userId: string, item: Partial<Food>): Promise<Food> => {
    const { foods } = get();
    if (item.id && !item.id.startsWith('off_')) {
      const existing = foods.find((f) => f.id === item.id);
      if (existing) return existing;
    }
    // Save the food to local DB
    return get().createFood(userId, {
      name: item.name ?? 'Unknown',
      brand: item.brand ?? null,
      calories_per_100g: item.calories_per_100g ?? 0,
      protein_per_100g: item.protein_per_100g ?? 0,
      carbs_per_100g: item.carbs_per_100g ?? 0,
      fats_per_100g: item.fats_per_100g ?? 0,
      serving_size: item.serving_size ?? null,
      serving_unit: item.serving_unit ?? null,
      barcode: item.barcode ?? null,
      source: item.source ?? 'user',
    });
  },

  // ── Meals ──────────────────────────────────────────────────────────────────

  loadMeals: async (userId: string) => {
    set({ isLoadingMeals: true });
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ meals: data ?? [] });
    } catch (error) {
      console.error('[nutritionStore] loadMeals:', error);
    } finally {
      set({ isLoadingMeals: false });
    }
  },

  createMeal: async (userId, mealData, foodsList) => {
    // Calculate totals
    const totals = foodsList.reduce(
      (acc, f) => ({
        total_calories: acc.total_calories + f.computed_calories,
        total_protein: acc.total_protein + f.computed_protein,
        total_carbs: acc.total_carbs + f.computed_carbs,
        total_fats: acc.total_fats + f.computed_fats,
      }),
      { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 }
    );

    const { data, error } = await supabase
      .from('meals')
      .insert({ ...mealData, ...totals, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    const meal = data as Meal;

    // Insert meal_foods
    if (foodsList.length > 0) {
      const mealFoodRows = foodsList.map((f) => ({
        meal_id: meal.id,
        food_id: f.id.startsWith('off_') ? f.id : f.id,
        quantity: f.quantity,
        serving_unit: 'g',
        calories: f.computed_calories,
        protein: f.computed_protein,
        carbs: f.computed_carbs,
        fats: f.computed_fats,
      }));
      await supabase.from('meal_foods').insert(mealFoodRows);
    }

    set((state) => ({ meals: [meal, ...state.meals] }));
    return meal;
  },

  updateMeal: async (mealId, updates, foodsList) => {
    const patch: Partial<Meal> = { ...updates };

    if (foodsList) {
      const totals = foodsList.reduce(
        (acc, f) => ({
          total_calories: acc.total_calories + f.computed_calories,
          total_protein: acc.total_protein + f.computed_protein,
          total_carbs: acc.total_carbs + f.computed_carbs,
          total_fats: acc.total_fats + f.computed_fats,
        }),
        { total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 }
      );
      Object.assign(patch, totals);

      // Replace meal_foods
      await supabase.from('meal_foods').delete().eq('meal_id', mealId);
      const mealFoodRows = foodsList.map((f) => ({
        meal_id: mealId,
        food_id: f.id,
        quantity: f.quantity,
        serving_unit: 'g',
        calories: f.computed_calories,
        protein: f.computed_protein,
        carbs: f.computed_carbs,
        fats: f.computed_fats,
      }));
      if (mealFoodRows.length > 0) {
        await supabase.from('meal_foods').insert(mealFoodRows);
      }
    }

    const { error } = await supabase.from('meals').update(patch).eq('id', mealId);
    if (error) throw error;
    set((state) => ({
      meals: state.meals.map((m) => (m.id === mealId ? { ...m, ...patch } : m)),
    }));
  },

  deleteMeal: async (mealId) => {
    await supabase.from('meal_foods').delete().eq('meal_id', mealId);
    const { error } = await supabase.from('meals').delete().eq('id', mealId);
    if (error) throw error;
    set((state) => ({ meals: state.meals.filter((m) => m.id !== mealId) }));
  },

  loadMealFoods: async (mealId: string): Promise<MealFood[]> => {
    const { data, error } = await supabase
      .from('meal_foods')
      .select('*, food:foods(*)')
      .eq('meal_id', mealId);
    if (error) throw error;
    const foods = data as MealFood[];
    set({ mealFoods: foods });
    return foods;
  },

  setSelectedMeal: (meal) => set({ selectedMeal: meal }),

  // ── Daily Log ──────────────────────────────────────────────────────────────

  loadTodayLog: async (userId: string, dailyGoals?: { calorie_goal: number; protein_goal: number; carbs_goal: number; fats_goal: number }) => {
    const today = new Date().toLocaleDateString('en-CA');
    const { data, error } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    if (error) throw error;

    let log = data;
    if (!log && dailyGoals) {
      // Pre-create today's log with profile-based goals
      const { data: newLog, error: insertError } = await supabase
        .from('nutrition_logs')
        .insert({
          user_id: userId,
          date: today,
          calories: 0,
          water_count: 0,
          calorie_goal: dailyGoals.calorie_goal,
          protein_grams: 0,
          carbs_grams: 0,
          fats_grams: 0,
          protein_goal: dailyGoals.protein_goal,
          carbs_goal: dailyGoals.carbs_goal,
          fats_goal: dailyGoals.fats_goal,
        })
        .select()
        .single();
      if (!insertError) log = newLog;
    }

    set({ todayLog: log ?? null });

    if (log) {
      const { data: entries } = await supabase
        .from('nutrition_log_meals')
        .select('*, meal:meals(*)')
        .eq('nutrition_log_id', log.id);
      set({ todayMealEntries: entries ?? [] });
    }
  },

  addMealToToday: async (userId: string, mealId: string, dailyGoals?: { calorie_goal: number; protein_goal: number; carbs_goal: number; fats_goal: number }) => {
    const { todayLog } = get();
    const today = new Date().toLocaleDateString('en-CA');

    // Get meal data
    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .select('*')
      .eq('id', mealId)
      .single();
    if (mealError) throw mealError;

    let logId = todayLog?.id;
    if (!logId) {
      // Create a new log for today with profile goals (or defaults)
      const { data: newLog, error: logError } = await supabase
        .from('nutrition_logs')
        .insert({
          user_id: userId,
          date: today,
          calories: 0,
          water_count: 0,
          calorie_goal: dailyGoals?.calorie_goal ?? 2000,
          protein_grams: 0,
          carbs_grams: 0,
          fats_grams: 0,
          protein_goal: dailyGoals?.protein_goal ?? 150,
          carbs_goal: dailyGoals?.carbs_goal ?? 250,
          fats_goal: dailyGoals?.fats_goal ?? 65,
        })
        .select()
        .single();
      if (logError) throw logError;
      set({ todayLog: newLog as NutritionLog });
      logId = newLog.id;
    }

    const { data: entry, error } = await supabase
      .from('nutrition_log_meals')
      .insert({
        nutrition_log_id: logId,
        meal_id: mealId,
        calories: meal.total_calories,
        protein: meal.total_protein,
        carbs: meal.total_carbs,
        fats: meal.total_fats,
      })
      .select('*, meal:meals(*)')
      .single();
    if (error) throw error;

    set((state) => ({ todayMealEntries: [...state.todayMealEntries, entry as NutritionLogMeal] }));

    // Update log totals
    await get().loadTodayLog(userId);
  },

  quickAddFood: async (userId: string, food: FoodWithQuantity) => {
    // Create a temporary single-food meal and add to today
    const meal = await get().createMeal(userId, { name: food.name, total_calories: food.computed_calories, total_protein: food.computed_protein, total_carbs: food.computed_carbs, total_fats: food.computed_fats, image_url: null }, [food]);
    await get().addMealToToday(userId, meal.id);
  },

  removeMealFromToday: async (entryId: string) => {
    const { error } = await supabase
      .from('nutrition_log_meals')
      .delete()
      .eq('id', entryId);
    if (error) throw error;
    set((state) => ({
      todayMealEntries: state.todayMealEntries.filter((e) => e.id !== entryId),
    }));
  },

  updateWaterCount: async (userId: string, count: number) => {
    const { todayLog } = get();
    if (!todayLog) return;
    const { error } = await supabase
      .from('nutrition_logs')
      .update({ water_count: count })
      .eq('id', todayLog.id);
    if (error) throw error;
    set({ todayLog: { ...todayLog, water_count: count } });
  },

  updateNutritionLog: async (userId, calories, waterCount, goal, macros, macroGoals) => {
    const { todayLog } = get();
    const today = new Date().toLocaleDateString('en-CA');
    const patch = {
      calories,
      water_count: waterCount,
      calorie_goal: goal,
      protein_grams: macros.protein,
      carbs_grams: macros.carbs,
      fats_grams: macros.fats,
      protein_goal: macroGoals.protein,
      carbs_goal: macroGoals.carbs,
      fats_goal: macroGoals.fats,
    };
    if (todayLog) {
      await supabase.from('nutrition_logs').update(patch).eq('id', todayLog.id);
      set({ todayLog: { ...todayLog, ...patch } });
    } else {
      const { data } = await supabase
        .from('nutrition_logs')
        .insert({ user_id: userId, date: today, ...patch })
        .select()
        .single();
      set({ todayLog: data as NutritionLog });
    }
  },

  // ── Meal Plans ─────────────────────────────────────────────────────────────

  loadMealPlans: async (userId: string) => {
    const today = new Date().toLocaleDateString('en-CA');
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-CA');
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*, meal:meals(*)')
      .eq('user_id', userId)
      .gte('date', today)
      .lte('date', twoWeeks)
      .order('date');
    if (error) throw error;
    set({ mealPlans: data ?? [] });
  },

  assignMealToPlan: async (userId, date, mealTime, mealId) => {
    const { data, error } = await supabase
      .from('meal_plans')
      .upsert({ user_id: userId, date, meal_time: mealTime, meal_id: mealId, is_completed: false })
      .select('*, meal:meals(*)')
      .single();
    if (error) throw error;
    set((state) => ({
      mealPlans: [
        ...state.mealPlans.filter((p) => !(p.date === date && p.meal_time === mealTime)),
        data as MealPlan,
      ],
    }));
  },

  removeMealFromPlan: async (planId) => {
    const { error } = await supabase.from('meal_plans').delete().eq('id', planId);
    if (error) throw error;
    set((state) => ({ mealPlans: state.mealPlans.filter((p) => p.id !== planId) }));
  },

  completeMealPlan: async (planId) => {
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from('meal_plans')
      .update({ is_completed: true, completed_at: completedAt })
      .eq('id', planId);
    if (error) throw error;
    set((state) => ({
      mealPlans: state.mealPlans.map((p) =>
        p.id === planId ? { ...p, is_completed: true, completed_at: completedAt } : p
      ),
    }));
  },

  // ── Shopping List ──────────────────────────────────────────────────────────

  loadShoppingList: async (userId: string) => {
    const weekStart = getWeekStart();
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .order('category');
    if (error) throw error;
    set({ shoppingList: data ?? [] });
  },

  generateShoppingList: async (userId: string, startDate: string, endDate: string) => {
    // Get meal plans in range
    const { data: plans } = await supabase
      .from('meal_plans')
      .select('*, meal:meals(*, meal_foods(*, food:foods(*)))')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (!plans || plans.length === 0) return;

    const weekStart = getWeekStart(new Date(startDate));
    const aggregated: Record<string, { quantity: number; unit: string; category: ShoppingCategory }> = {};

    for (const plan of plans) {
      const meal = plan.meal as any;
      if (!meal?.meal_foods) continue;
      for (const mf of meal.meal_foods) {
        const food = mf.food;
        if (!food) continue;
        const key = food.name;
        if (aggregated[key]) {
          aggregated[key].quantity += mf.quantity;
        } else {
          aggregated[key] = {
            quantity: mf.quantity,
            unit: mf.serving_unit ?? 'g',
            category: categorizeFood(food.name),
          };
        }
      }
    }

    const items = Object.entries(aggregated).map(([name, info]) => ({
      user_id: userId,
      week_start: weekStart,
      item_name: name,
      quantity: info.quantity,
      unit: info.unit,
      category: info.category,
      is_purchased: false,
      purchased_at: null,
    }));

    if (items.length > 0) {
      await supabase.from('shopping_lists').delete().eq('user_id', userId).eq('week_start', weekStart);
      const { data, error } = await supabase.from('shopping_lists').insert(items).select();
      if (error) throw error;
      set({ shoppingList: data ?? [] });
    }
  },

  togglePurchased: async (itemId) => {
    const { shoppingList } = get();
    const item = shoppingList.find((i) => i.id === itemId);
    if (!item) return;
    const is_purchased = !item.is_purchased;
    const purchased_at = is_purchased ? new Date().toISOString() : null;
    const { error } = await supabase
      .from('shopping_lists')
      .update({ is_purchased, purchased_at })
      .eq('id', itemId);
    if (error) throw error;
    set((state) => ({
      shoppingList: state.shoppingList.map((i) =>
        i.id === itemId ? { ...i, is_purchased, purchased_at } : i
      ),
    }));
  },

  removeShoppingItem: async (itemId) => {
    const { error } = await supabase.from('shopping_lists').delete().eq('id', itemId);
    if (error) throw error;
    set((state) => ({ shoppingList: state.shoppingList.filter((i) => i.id !== itemId) }));
  },

  clearShoppingList: async (userId) => {
    const weekStart = getWeekStart();
    await supabase.from('shopping_lists').delete().eq('user_id', userId).eq('week_start', weekStart);
    set({ shoppingList: [] });
  },
}));
