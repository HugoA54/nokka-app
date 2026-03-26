import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import { calculateDailyMetrics } from '@services/calorieCalculations';
import { geminiService } from '@services/geminiService';
import type { ActivityLevel, FitnessGoal, Gender, UserProfile } from '@types/index';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise' },
  { value: 'light', label: 'Light', description: '1-3 days/week' },
  { value: 'moderate', label: 'Moderate', description: '3-5 days/week' },
  { value: 'active', label: 'Active', description: '6-7 days/week' },
  { value: 'very_active', label: 'Very Active', description: 'Intense daily exercise' },
];

const GOAL_OPTIONS: { value: FitnessGoal; label: string; description: string; color: string }[] = [
  { value: 'cut', label: 'Cut', description: 'Lose fat (-15% calories)', color: '#f060a8' },
  { value: 'maintain', label: 'Maintain', description: 'Stay the same', color: '#60d4f0' },
  { value: 'bulk', label: 'Bulk', description: 'Gain muscle (+10% calories)', color: '#c8f060' },
];

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const { signOut } = useAuthStore();
  const { userProfile, loadUserProfile, updateUserProfile, sessions, sets, exercises } = useWorkoutStore();
  const toast = useToast();
  const haptics = useHaptics();

  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState('75');
  const [height, setHeight] = useState('175');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState<Gender>('male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<FitnessGoal>('maintain');
  const [useAutoCalc, setUseAutoCalc] = useState(true);
  const [manualGoal, setManualGoal] = useState('2000');
  const [isSaving, setIsSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiKeyVisible, setAiKeyVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    await loadUserProfile(user.id);
    // Load AI settings
    const enabled = await geminiService.isEnabled();
    const key = await geminiService.getApiKey();
    setAiEnabled(enabled);
    setAiApiKey(key);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (userProfile) {
      setWeight(String(userProfile.weight));
      setHeight(String(userProfile.height));
      setAge(String(userProfile.age));
      setGender(userProfile.gender);
      setActivityLevel(userProfile.activity_level);
      setGoal(userProfile.goal);
      setUseAutoCalc(userProfile.use_auto_calculation);
      setManualGoal(String(userProfile.manual_calorie_goal ?? 2000));
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!userProfile || !user) return;
    setIsSaving(true);
    try {
      const patch: Partial<UserProfile> = {
        weight: parseFloat(weight) || 75,
        height: parseFloat(height) || 175,
        age: parseInt(age) || 25,
        gender,
        activity_level: activityLevel,
        goal,
        use_auto_calculation: useAutoCalc,
        manual_calorie_goal: useAutoCalc ? null : (parseInt(manualGoal) || 2000),
      };
      await updateUserProfile(patch);
      await haptics.success();
      toast.success('Profile updated!');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAI = async (enabled: boolean) => {
    setAiEnabled(enabled);
    await geminiService.setEnabled(enabled);
    await haptics.light();
  };

  const handleSaveApiKey = async () => {
    await geminiService.setApiKey(aiApiKey);
    await haptics.success();
    toast.success('Clé API sauvegardée !');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await haptics.medium();
          await signOut();
        },
      },
    ]);
  };

  // Compute current metrics
  const metrics = userProfile
    ? calculateDailyMetrics(
        {
          ...userProfile,
          weight: parseFloat(weight) || userProfile.weight,
          height: parseFloat(height) || userProfile.height,
          age: parseInt(age) || userProfile.age,
          gender,
          activity_level: activityLevel,
          goal,
        },
        [],
        {}
      )
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar & Info */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.email?.[0] ?? 'N').toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.email?.split('@')[0] ?? 'Athlete'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity
          style={styles.editToggle}
          onPress={() => setEditing(!editing)}
        >
          <Ionicons name={editing ? 'close' : 'pencil-outline'} size={18} color="#7a7a90" />
        </TouchableOpacity>
      </View>

      {/* Calculated Metrics */}
      {metrics && (
        <View style={styles.metricsCard}>
          <Text style={styles.cardTitle}>Daily Metrics</Text>
          <View style={styles.metricsGrid}>
            {[
              { label: 'BMR', value: `${Math.round(metrics.bmr)} kcal`, icon: 'body-outline' },
              { label: 'TDEE', value: `${Math.round(metrics.tdee)} kcal`, icon: 'flame-outline' },
              { label: 'Daily Goal', value: `${Math.round(metrics.dailyGoal)} kcal`, icon: 'trophy-outline' },
              { label: 'Protein', value: `${metrics.macros.protein}g`, icon: 'nutrition-outline' },
              { label: 'Carbs', value: `${metrics.macros.carbs}g`, icon: 'leaf-outline' },
              { label: 'Fats', value: `${metrics.macros.fats}g`, icon: 'water-outline' },
            ].map((m) => (
              <View key={m.label} style={styles.metricItem}>
                <Ionicons name={m.icon as any} size={16} color="#c8f060" />
                <Text style={styles.metricValue}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Body Measurements */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Body Measurements</Text>
        <View style={styles.fieldRow}>
          {[
            { label: 'Weight (kg)', value: weight, onChange: setWeight },
            { label: 'Height (cm)', value: height, onChange: setHeight },
            { label: 'Age', value: age, onChange: setAge },
          ].map(({ label, value, onChange }) => (
            <View key={label} style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>{label}</Text>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#3a3a4a"
                />
              ) : (
                <Text style={styles.fieldValue}>{value}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Gender */}
        <View style={styles.genderRow}>
          {(['male', 'female'] as Gender[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
              onPress={() => editing && setGender(g)}
              disabled={!editing}
            >
              <Ionicons
                name={g === 'male' ? 'man-outline' : 'woman-outline'}
                size={16}
                color={gender === g ? '#0f0f12' : '#7a7a90'}
              />
              <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Activity Level */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity Level</Text>
        <View style={styles.optionsList}>
          {ACTIVITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionRow, activityLevel === opt.value && styles.optionRowActive]}
              onPress={() => editing && setActivityLevel(opt.value)}
              disabled={!editing}
            >
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, activityLevel === opt.value && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
              {activityLevel === opt.value && (
                <Ionicons name="checkmark-circle" size={20} color="#c8f060" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Fitness Goal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fitness Goal</Text>
        <View style={styles.goalGrid}>
          {GOAL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.goalItem,
                goal === opt.value && { borderColor: opt.color, backgroundColor: `${opt.color}15` },
              ]}
              onPress={() => editing && setGoal(opt.value)}
              disabled={!editing}
            >
              <Text style={[styles.goalLabel, goal === opt.value && { color: opt.color }]}>
                {opt.label}
              </Text>
              <Text style={styles.goalDesc}>{opt.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Calorie Calculation */}
      <View style={styles.card}>
        <View style={styles.calcRow}>
          <View style={styles.calcInfo}>
            <Text style={styles.calcTitle}>Auto Calculation</Text>
            <Text style={styles.calcDesc}>Calculate goal from BMR + TDEE + workout calories</Text>
          </View>
          <Switch
            value={useAutoCalc}
            onValueChange={(v) => editing && setUseAutoCalc(v)}
            disabled={!editing}
            trackColor={{ false: '#2a2a35', true: '#c8f060' }}
            thumbColor={useAutoCalc ? '#0f0f12' : '#7a7a90'}
          />
        </View>
        {!useAutoCalc && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Manual Calorie Goal (kcal)</Text>
            <TextInput
              style={styles.manualInput}
              value={manualGoal}
              onChangeText={setManualGoal}
              keyboardType="number-pad"
              editable={editing}
              placeholder="2000"
              placeholderTextColor="#3a3a4a"
            />
          </View>
        )}
      </View>

      {/* AI Features */}
      <View style={styles.card}>
        <View style={styles.calcRow}>
          <View style={styles.calcInfo}>
            <Text style={styles.calcTitle}>Fonctionnalités IA</Text>
            <Text style={styles.calcDesc}>Analyse repas, surcharge progressive, analyse de séance</Text>
          </View>
          <Switch
            value={aiEnabled}
            onValueChange={handleToggleAI}
            trackColor={{ false: '#2a2a35', true: '#c8f060' }}
            thumbColor={aiEnabled ? '#0f0f12' : '#7a7a90'}
          />
        </View>
        {aiEnabled && (
          <View style={styles.aiKeySection}>
            <Text style={styles.fieldLabel}>Clé API Gemini</Text>
            <Text style={styles.aiKeyHint}>
              Obtiens ta clé gratuite sur Google AI Studio → Get API Key
            </Text>
            <View style={styles.aiKeyRow}>
              <TextInput
                style={styles.aiKeyInput}
                value={aiApiKey}
                onChangeText={setAiApiKey}
                placeholder="AIzaSy..."
                placeholderTextColor="#3a3a4a"
                secureTextEntry={!aiKeyVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.aiKeyToggle}
                onPress={() => setAiKeyVisible(!aiKeyVisible)}
              >
                <Ionicons
                  name={aiKeyVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#7a7a90"
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.aiKeySaveBtn} onPress={handleSaveApiKey}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#0f0f12" />
              <Text style={styles.aiKeySaveBtnText}>Sauvegarder la clé</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Save Button */}
      {editing && (
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>
      )}

      {/* Account Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#f06060" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#16161c',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#c8f060', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#0f0f12', fontSize: 24, fontWeight: '800' },
  name: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  email: { color: '#7a7a90', fontSize: 13, marginTop: 2 },
  editToggle: {
    marginLeft: 'auto',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center',
  },
  metricsCard: {
    backgroundColor: '#16161c', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#2a2a35', gap: 12,
  },
  cardTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricItem: {
    width: '30%', backgroundColor: '#0f0f12', borderRadius: 12,
    padding: 12, gap: 4, borderWidth: 1, borderColor: '#2a2a35',
  },
  metricValue: { color: '#f0f0f0', fontSize: 14, fontWeight: '700' },
  metricLabel: { color: '#7a7a90', fontSize: 11 },
  card: {
    backgroundColor: '#16161c', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#2a2a35', gap: 14,
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldItem: { flex: 1, gap: 6 },
  fieldLabel: { color: '#7a7a90', fontSize: 12, fontWeight: '600' },
  fieldValue: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  fieldInput: {
    backgroundColor: '#0f0f12', borderRadius: 10, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 10, paddingVertical: 10,
    color: '#f0f0f0', fontSize: 16, fontWeight: '700',
  },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#0f0f12', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  genderBtnActive: { backgroundColor: '#c8f060', borderColor: '#c8f060' },
  genderText: { color: '#7a7a90', fontSize: 14, fontWeight: '600' },
  genderTextActive: { color: '#0f0f12' },
  optionsList: { gap: 8 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f0f12', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  optionRowActive: { borderColor: '#c8f060', backgroundColor: 'rgba(200,240,96,0.06)' },
  optionInfo: { flex: 1 },
  optionLabel: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  optionLabelActive: { color: '#c8f060' },
  optionDesc: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  goalGrid: { flexDirection: 'row', gap: 10 },
  goalItem: {
    flex: 1, backgroundColor: '#0f0f12', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#2a2a35', gap: 4,
  },
  goalLabel: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  goalDesc: { color: '#7a7a90', fontSize: 10 },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calcInfo: { flex: 1 },
  calcTitle: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  calcDesc: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  field: { gap: 8 },
  manualInput: {
    backgroundColor: '#0f0f12', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 16, paddingVertical: 14,
    color: '#f0f0f0', fontSize: 20, fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#c8f060', borderRadius: 16, paddingVertical: 18, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0f0f12', fontSize: 17, fontWeight: '700' },
  aiKeySection: { gap: 10 },
  aiKeyHint: { color: '#7a7a90', fontSize: 11, fontStyle: 'italic' },
  aiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiKeyInput: {
    flex: 1, backgroundColor: '#0f0f12', borderRadius: 10, borderWidth: 1,
    borderColor: '#2a2a35', paddingHorizontal: 12, paddingVertical: 10,
    color: '#f0f0f0', fontSize: 14, fontFamily: 'monospace',
  },
  aiKeyToggle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center',
  },
  aiKeySaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#c8f060', borderRadius: 10, paddingVertical: 10,
  },
  aiKeySaveBtnText: { color: '#0f0f12', fontSize: 14, fontWeight: '700' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(240,96,96,0.1)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(240,96,96,0.3)',
  },
  signOutText: { color: '#f06060', fontSize: 15, fontWeight: '600' },
});
