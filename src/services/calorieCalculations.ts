import type { UserProfile, WorkoutSet, Exercise, DailyMetrics, ActivityLevel, FitnessGoal } from '@types/index';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_MODIFIERS: Record<FitnessGoal, number> = {
  cut: -0.15,
  maintain: 0.0,
  bulk: 0.1,
};

// MET (Metabolic Equivalent of Task) by muscle group
const MET_BY_MUSCLE: Record<string, number> = {
  chest: 6.0,
  back: 6.0,
  shoulders: 5.5,
  biceps: 4.5,
  triceps: 4.5,
  legs: 8.0,
  glutes: 7.0,
  core: 4.0,
  cardio: 9.0,
  full_body: 7.0,
};

// ─── Core Formulas ─────────────────────────────────────────────────────────────

/**
 * Mifflin-St Jeor BMR formula
 */
export function calculateBMR(
  weight: number,   // kg
  height: number,   // cm
  age: number,
  gender: 'male' | 'female'
): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/**
 * Total Daily Energy Expenditure
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Epley formula for estimated 1 Rep Max
 */
export function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Estimate calories burned during a set
 * Uses MET × weight × duration estimate + RPE modifier
 */
export function estimateSetCalories(
  set: WorkoutSet,
  exercise: Exercise,
  bodyWeight: number
): number {
  const met = MET_BY_MUSCLE[exercise.muscle_group] ?? 6.0;
  // Estimate set duration in hours
  // Average ~3s per rep + 1min rest (not counted here, just set work)
  const reps = set.repetitions;
  const secsPerRep = exercise.is_bodyweight ? 2.5 : 3.5;
  const setDurationHours = (reps * secsPerRep) / 3600;
  // RPE modifier: higher RPE = more calories
  const rpeMod = set.rpe ? 0.85 + set.rpe * 0.015 : 1.0;
  const kcal = met * bodyWeight * setDurationHours * rpeMod;
  return kcal;
}

/**
 * Total workout calories for a session's sets
 */
export function calculateWorkoutCalories(
  sets: WorkoutSet[],
  exerciseById: Record<string, Exercise>,
  bodyWeight: number
): number {
  const total = sets.reduce((sum, s) => {
    const exercise = exerciseById[s.exercise_id];
    if (!exercise) return sum;
    return sum + estimateSetCalories(s, exercise, bodyWeight);
  }, 0);
  return Math.round(total);
}

/**
 * Apply goal modifier to TDEE to get daily calorie target
 */
export function calculateDailyGoal(tdee: number, workoutCalories: number, goal: FitnessGoal): number {
  const modifier = GOAL_MODIFIERS[goal];
  return Math.round((tdee + workoutCalories) * (1 + modifier));
}

/**
 * Calculate recommended macro split based on goal
 */
export function calculateMacros(
  dailyCalories: number,
  goal: FitnessGoal,
  bodyWeight: number
): { protein: number; carbs: number; fats: number } {
  // Protein: varies by goal (g/kg)
  const proteinPerKg = goal === 'cut' ? 2.2 : goal === 'bulk' ? 2.0 : 1.8;
  const protein = Math.round(proteinPerKg * bodyWeight);

  // Fats: 0.9-1.0 g/kg by goal
  const fatPerKg = goal === 'cut' ? 0.9 : 1.0;
  const fats = Math.round(fatPerKg * bodyWeight);

  // Carbs: remaining calories
  const proteinCalories = protein * 4;
  const fatCalories = fats * 9;
  const carbCalories = Math.max(0, dailyCalories - proteinCalories - fatCalories);
  const carbs = Math.round(carbCalories / 4);

  return { protein, carbs, fats };
}

/**
 * All-in-one calculation for the dashboard
 */
export function calculateDailyMetrics(
  profile: UserProfile,
  todaySets: WorkoutSet[],
  exerciseById: Record<string, Exercise>
): DailyMetrics {
  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, profile.activity_level);
  const workoutCalories = calculateWorkoutCalories(todaySets, exerciseById, profile.weight);

  const dailyGoal = profile.use_auto_calculation
    ? calculateDailyGoal(tdee, workoutCalories, profile.goal)
    : (profile.manual_calorie_goal ?? tdee);

  const macros = calculateMacros(dailyGoal, profile.goal, profile.weight);

  return { bmr, tdee, workoutCalories, dailyGoal, macros };
}
