// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type FitnessGoal = 'cut' | 'maintain' | 'bulk';

export interface UserProfile {
  id: string;
  user_id: string;
  weight: number;          // kg
  height: number;          // cm
  age: number;
  gender: Gender;
  activity_level: ActivityLevel;
  goal: FitnessGoal;
  use_auto_calculation: boolean;
  manual_calorie_goal: number | null;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT
// ─────────────────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'core'
  | 'cardio'
  | 'full_body';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  is_bodyweight: boolean;
  description?: string;
}

export interface Session {
  id: string;
  user_id: string;
  date: string;            // ISO date string
  name: string;
  note?: string | null;
  created_at?: string;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise?: Exercise;     // joined relation
  weight: number;
  display_weight?: string; // formatted string e.g. "80 kg"
  repetitions: number;
  rpe: number | null;      // Rate of Perceived Exertion 1-10
  note: string | null;
  created_at?: string;
}

export interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  weight: number;
  repetitions: number;
  estimated_1rm: number;
  date: string;
}

export interface ExerciseProgressionPoint {
  date: string;
  weight: number;
  repetitions: number;
  estimated_1rm: number;
}

export interface MuscleDistribution {
  muscle_group: MuscleGroup;
  set_count: number;
  percentage: number;
}

export interface HeatmapEntry {
  date: string;
  volume: number;          // total kg lifted
  count: number;           // number of sets
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION – FOOD DATABASE
// ─────────────────────────────────────────────────────────────────────────────

export type FoodSource = 'user' | 'openfoodfacts';

export interface Food {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  serving_size: number | null;
  serving_unit: string | null;
  barcode: string | null;
  source: FoodSource;
  times_used: number;
  created_at?: string;
  updated_at?: string;
}

export interface FoodWithQuantity extends Food {
  quantity: number;        // grams
  // computed macros for this serving
  computed_calories: number;
  computed_protein: number;
  computed_carbs: number;
  computed_fats: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION – MEALS
// ─────────────────────────────────────────────────────────────────────────────

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  image_url?: string | null;
  created_at?: string;
}

export interface MealFood {
  id: string;
  meal_id: string;
  food_id: string;
  food?: Food;             // joined relation
  quantity: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION – DAILY LOG
// ─────────────────────────────────────────────────────────────────────────────

export interface NutritionLog {
  id: string;
  user_id: string;
  date: string;            // ISO date
  calories: number;
  water_count: number;     // glasses
  calorie_goal: number;
  protein_grams: number;
  carbs_grams: number;
  fats_grams: number;
  protein_goal: number;
  carbs_goal: number;
  fats_goal: number;
  created_at?: string;
  updated_at?: string;
}

export interface NutritionLogMeal {
  id: string;
  nutrition_log_id: string;
  meal_id: string;
  meal?: Meal;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION – MEAL PLANNING
// ─────────────────────────────────────────────────────────────────────────────

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlan {
  id: string;
  user_id: string;
  date: string;
  meal_time: MealTime;
  meal_id: string;
  meal?: Meal;
  is_completed: boolean;
  completed_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION – SHOPPING LIST
// ─────────────────────────────────────────────────────────────────────────────

export type ShoppingCategory =
  | 'proteins'
  | 'vegetables'
  | 'fruits'
  | 'dairy'
  | 'grains'
  | 'condiments'
  | 'other';

export interface ShoppingItem {
  id: string;
  user_id: string;
  week_start: string;
  item_name: string;
  quantity: number;
  unit: string;
  category: ShoppingCategory;
  is_purchased: boolean;
  purchased_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI MACRO TRACKER (from macro-tracker project)
// ─────────────────────────────────────────────────────────────────────────────

export type AIAnalysisStep = 'idle' | 'preview' | 'analyzing' | 'review';

export interface AIMacroResult {
  name: string;
  calories: number;
  proteines: number;   // French naming preserved from original
  glucides: number;
  lipides: number;
}

export interface AIMeal {
  id: number;
  name: string;
  calories: number;
  proteines: number;
  glucides: number;
  lipides: number;
  image_url?: string | null;
  date: string;
  created_at?: string;
}

export interface AIMacroGoals {
  calories: number;
  proteines: number;
  glucides: number;
  lipides: number;
}

export interface AIMacroTotals {
  calories: number;
  proteines: number;
  glucides: number;
  lipides: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CALORIE CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyMetrics {
  bmr: number;
  tdee: number;
  workoutCalories: number;
  dailyGoal: number;
  macros: {
    protein: number;   // grams
    carbs: number;
    fats: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI STATE
// ─────────────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN FOOD FACTS
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenFoodFactsSearchResult {
  foods: Partial<Food>[];
  count: number;
  page: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  total_volume: number;    // kg lifted all time
  total_sessions: number;
  streak_weeks: number;
  rank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES & GAMIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export type ChallengeCategory = 'session' | 'weekly' | 'achievement';

export interface ChallengeDefinition {
  id: string;
  category: ChallengeCategory;
  title: string;
  description: string;
  icon: string;
  target: number;
  unit: string;
  color: string;
  evaluate: (data: ChallengeEvalData) => number;
}

export interface ChallengeEvalData {
  sessionSets: WorkoutSet[];
  allSets: WorkoutSet[];
  sessions: Session[];
  exercises: Exercise[];
  currentSessionId: string | null;
  getPersonalRecord: (exerciseId: string) => PersonalRecord | null;
  getStreakWeeks: () => number;
}

export interface ChallengeProgress {
  challengeId: string;
  current: number;
  target: number;
  completedAt: string | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt: string;
}
