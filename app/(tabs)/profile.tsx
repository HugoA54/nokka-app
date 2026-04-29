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
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@store/authStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';
import { calculateDailyMetrics } from '@services/calorieCalculations';
import { geminiService } from '@services/geminiService';
import { getCreatineSettings, saveCreatineSettings, type CreatineMode, type CreatineSettings } from '@services/creatineReminder';
import { getAbsSettings, saveAbsSettings, type AbsRoutineSettings } from '@services/absRoutine';
import type { AbsLevel, ActivityLevel, FitnessGoal, Gender, UserProfile } from '@types/index';
import { setStoredLanguage, supportedLanguages } from '../../src/i18n';

const INTERVAL_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 2, label: '2h' },
  { value: 3, label: '3h' },
  { value: 4, label: '4h' },
];

const FIXED_HOUR_OPTIONS = [7, 8, 9, 10, 12, 14, 18, 20];

const ABS_HOUR_OPTIONS = [7, 12, 17, 18, 19, 20, 21];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { signOut } = useAuthStore();
  const { userProfile, loadUserProfile, updateUserProfile, sessions, sets, exercises } = useWorkoutStore();
  const toast = useToast();
  const haptics = useHaptics();

  const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
    { value: 'sedentary', label: t('profile.sedentary'), description: t('profile.little_exercise') },
    { value: 'light', label: t('profile.light'), description: t('profile.light_days') },
    { value: 'moderate', label: t('profile.moderate'), description: t('profile.moderate_days') },
    { value: 'active', label: t('profile.active'), description: t('profile.active_days') },
    { value: 'very_active', label: t('profile.very_active'), description: t('profile.intense_daily') },
  ];

  const GOAL_OPTIONS: { value: FitnessGoal; label: string; description: string; color: string }[] = [
    { value: 'cut', label: t('profile.cut'), description: t('profile.cut_desc'), color: '#f060a8' },
    { value: 'maintain', label: t('profile.maintain'), description: t('profile.maintain_desc'), color: '#60d4f0' },
    { value: 'bulk', label: t('profile.bulk'), description: t('profile.bulk_desc'), color: '#c8f060' },
  ];

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
  const [creatineEnabled, setCreatineEnabled] = useState(true);
  const [creatineMode, setCreatineMode] = useState<CreatineMode>('interval');
  const [creatineInterval, setCreatineInterval] = useState(1);
  const [creatineFixedHour, setCreatineFixedHour] = useState(9);
  const [absEnabled, setAbsEnabled] = useState(false);
  const [absLevel, setAbsLevel] = useState<AbsLevel>('beginner');
  const [absHour, setAbsHour] = useState(19);

  const loadData = useCallback(async () => {
    if (!user) return;
    await loadUserProfile(user.id);
    // Load AI settings
    const enabled = await geminiService.isEnabled();
    const key = await geminiService.getApiKey();
    setAiEnabled(enabled);
    setAiApiKey(key);
    // Load creatine settings
    const cs = await getCreatineSettings();
    setCreatineEnabled(cs.enabled);
    setCreatineMode(cs.mode);
    setCreatineInterval(cs.intervalHours);
    setCreatineFixedHour(cs.fixedHour);
    // Load abs routine settings
    const as = await getAbsSettings();
    setAbsEnabled(as.enabled);
    setAbsLevel(as.level);
    setAbsHour(as.reminderHour);
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
      toast.success(t('profile.profile_updated'));
      setEditing(false);
    } catch {
      toast.error(t('common.error'));
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
    toast.success(t('profile.api_key_saved'));
  };

  const saveCreatine = async (patch: Partial<CreatineSettings>) => {
    const updated: CreatineSettings = {
      enabled: patch.enabled ?? creatineEnabled,
      mode: patch.mode ?? creatineMode,
      fixedHour: patch.fixedHour ?? creatineFixedHour,
      intervalHours: patch.intervalHours ?? creatineInterval,
    };
    if (patch.enabled !== undefined) setCreatineEnabled(patch.enabled);
    if (patch.mode !== undefined) setCreatineMode(patch.mode);
    if (patch.fixedHour !== undefined) setCreatineFixedHour(patch.fixedHour);
    if (patch.intervalHours !== undefined) setCreatineInterval(patch.intervalHours);
    await saveCreatineSettings(updated);
    await haptics.light();
  };

  const saveAbs = async (patch: Partial<AbsRoutineSettings>) => {
    const updated: AbsRoutineSettings = {
      enabled: patch.enabled ?? absEnabled,
      level: patch.level ?? absLevel,
      reminderHour: patch.reminderHour ?? absHour,
    };
    if (patch.enabled !== undefined) setAbsEnabled(patch.enabled);
    if (patch.level !== undefined) setAbsLevel(patch.level);
    if (patch.reminderHour !== undefined) setAbsHour(patch.reminderHour);
    await saveAbsSettings(updated);
    await haptics.light();
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out'), t('profile.sign_out') + ' ?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.sign_out'),
        style: 'destructive',
        onPress: async () => {
          await haptics.medium();
          await signOut();
        },
      },
    ]);
  };

  const handleLanguageChange = async (lang: string) => {
    await setStoredLanguage(lang);
    await haptics.light();
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
          <Text style={styles.name}>{user?.email?.split('@')[0] ?? t('dashboard.athlete_placeholder')}</Text>
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
          <Text style={styles.cardTitle}>{t('profile.daily_metrics')}</Text>
          <View style={styles.metricsGrid}>
            {[
              { label: t('profile.bmr'), value: `${Math.round(metrics.bmr)} kcal`, icon: 'body-outline' },
              { label: t('profile.tdee'), value: `${Math.round(metrics.tdee)} kcal`, icon: 'flame-outline' },
              { label: t('profile.daily_goal'), value: `${Math.round(metrics.dailyGoal)} kcal`, icon: 'trophy-outline' },
              { label: t('profile.protein'), value: `${metrics.macros.protein}g`, icon: 'nutrition-outline' },
              { label: t('profile.carbs'), value: `${metrics.macros.carbs}g`, icon: 'leaf-outline' },
              { label: t('profile.fats'), value: `${metrics.macros.fats}g`, icon: 'water-outline' },
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
        <Text style={styles.cardTitle}>{t('profile.body_measurements')}</Text>
        <View style={styles.fieldRow}>
          {[
            { label: t('profile.weight_kg'), value: weight, onChange: setWeight },
            { label: t('profile.height_cm'), value: height, onChange: setHeight },
            { label: t('profile.age'), value: age, onChange: setAge },
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
                {g === 'male' ? t('profile.male') : t('profile.female')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Activity Level */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.activity_level')}</Text>
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
        <Text style={styles.cardTitle}>{t('profile.fitness_goal')}</Text>
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
            <Text style={styles.calcTitle}>{t('profile.auto_calculation')}</Text>
            <Text style={styles.calcDesc}>{t('profile.calculate_from_metrics')}</Text>
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
            <Text style={styles.fieldLabel}>{t('profile.manual_calorie_goal')}</Text>
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
            <Text style={styles.calcTitle}>{t('profile.ai_features')}</Text>
            <Text style={styles.calcDesc}>{t('profile.ai_meal_analysis')}</Text>
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
            <Text style={styles.fieldLabel}>{t('profile.gemini_api_key')}</Text>
            <Text style={styles.aiKeyHint}>{t('profile.api_key_hint')}</Text>
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
              <Text style={styles.aiKeySaveBtnText}>{t('profile.save_key')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Creatine Reminder */}
      <View style={styles.card}>
        <View style={styles.calcRow}>
          <View style={styles.calcInfo}>
            <Text style={styles.calcTitle}>{t('profile.creatine_reminder')}</Text>
            <Text style={styles.calcDesc}>
              {creatineEnabled
                ? creatineMode === 'fixed'
                  ? t('profile.creatine_fixed', { hour: creatineFixedHour })
                  : t('profile.creatine_interval', { hours: creatineInterval })
                : t('profile.creatine_disabled')}
            </Text>
          </View>
          <Switch
            value={creatineEnabled}
            onValueChange={(v) => saveCreatine({ enabled: v })}
            trackColor={{ false: '#2a2a35', true: '#60d4f0' }}
            thumbColor={creatineEnabled ? '#0f0f12' : '#7a7a90'}
          />
        </View>
        {creatineEnabled && (
          <View style={styles.creatineSettings}>
            {/* Mode toggle */}
            <View style={styles.creatineModeRow}>
              {([
                { value: 'interval' as CreatineMode, label: t('profile.creatine_interval_mode'), icon: 'repeat-outline' },
                { value: 'fixed' as CreatineMode, label: t('profile.creatine_fixed_mode'), icon: 'alarm-outline' },
              ]).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.creatineModeBtn, creatineMode === opt.value && styles.creatineModeBtnActive]}
                  onPress={() => saveCreatine({ mode: opt.value })}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={14}
                    color={creatineMode === opt.value ? '#0f0f12' : '#7a7a90'}
                  />
                  <Text style={[styles.creatineModeText, creatineMode === opt.value && styles.creatineModeTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interval options */}
            {creatineMode === 'interval' && (
              <View style={styles.creatineChipRow}>
                {INTERVAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.creatineChip, creatineInterval === opt.value && styles.creatineChipActive]}
                    onPress={() => saveCreatine({ intervalHours: opt.value })}
                  >
                    <Text style={[styles.creatineChipText, creatineInterval === opt.value && styles.creatineChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Fixed hour options */}
            {creatineMode === 'fixed' && (
              <View style={styles.creatineChipRow}>
                {FIXED_HOUR_OPTIONS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.creatineChip, creatineFixedHour === h && styles.creatineChipActive]}
                    onPress={() => saveCreatine({ fixedHour: h })}
                  >
                    <Text style={[styles.creatineChipText, creatineFixedHour === h && styles.creatineChipTextActive]}>
                      {h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Abs Routine */}
      <View style={styles.card}>
        <View style={styles.calcRow}>
          <View style={styles.calcInfo}>
            <Text style={styles.calcTitle}>{t('profile.abs_routine')}</Text>
            <Text style={styles.calcDesc}>
              {absEnabled
                ? t('profile.abs_summary', {
                    level: t(`abs.level.${absLevel}`),
                    hour: absHour,
                  })
                : t('profile.abs_disabled')}
            </Text>
          </View>
          <Switch
            value={absEnabled}
            onValueChange={(v) => saveAbs({ enabled: v })}
            trackColor={{ false: '#2a2a35', true: '#f060a8' }}
            thumbColor={absEnabled ? '#0f0f12' : '#7a7a90'}
          />
        </View>
        {absEnabled && (
          <View style={styles.creatineSettings}>
            {/* Level selector */}
            <View style={styles.creatineModeRow}>
              {(['beginner', 'intermediate', 'advanced'] as AbsLevel[]).map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.creatineModeBtn, absLevel === lvl && styles.absLevelBtnActive]}
                  onPress={() => saveAbs({ level: lvl })}
                >
                  <Text style={[styles.creatineModeText, absLevel === lvl && styles.creatineModeTextActive]}>
                    {t(`abs.level.${lvl}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Reminder hour */}
            <Text style={styles.fieldLabel}>{t('profile.abs_reminder_hour')}</Text>
            <View style={styles.creatineChipRow}>
              {ABS_HOUR_OPTIONS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.creatineChip, absHour === h && styles.absChipActive]}
                  onPress={() => saveAbs({ reminderHour: h })}
                >
                  <Text style={[styles.creatineChipText, absHour === h && styles.creatineChipTextActive]}>
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
          <Text style={styles.saveBtnText}>{isSaving ? t('profile.saving') : t('profile.save_profile')}</Text>
        </TouchableOpacity>
      )}

      {/* Language Selector */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.language')}</Text>
        <View style={styles.genderRow}>
          {supportedLanguages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.genderBtn, i18n.language === lang.code && styles.genderBtnActive]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[styles.genderText, i18n.language === lang.code && styles.genderTextActive]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.account')}</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#f06060" />
          <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
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
  creatineSettings: { gap: 12 },
  creatineModeRow: { flexDirection: 'row', gap: 8 },
  creatineModeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#0f0f12', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2a2a35',
  },
  creatineModeBtnActive: { backgroundColor: '#60d4f0', borderColor: '#60d4f0' },
  creatineModeText: { color: '#7a7a90', fontSize: 13, fontWeight: '600' },
  creatineModeTextActive: { color: '#0f0f12' },
  creatineChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  creatineChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#0f0f12', borderWidth: 1, borderColor: '#2a2a35',
  },
  creatineChipActive: { backgroundColor: '#60d4f0', borderColor: '#60d4f0' },
  absLevelBtnActive: { backgroundColor: '#f060a8', borderColor: '#f060a8' },
  absChipActive: { backgroundColor: '#f060a8', borderColor: '#f060a8' },
  creatineChipText: { color: '#7a7a90', fontSize: 14, fontWeight: '700' },
  creatineChipTextActive: { color: '#0f0f12' },
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
