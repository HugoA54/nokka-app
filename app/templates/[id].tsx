import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTemplateStore } from '@store/templateStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useToast } from '@hooks/useToast';
import type { TemplateExercise } from '@types/index';

type LocalExercise = Omit<TemplateExercise, 'id' | 'template_id'>;

export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { templates, getTemplateExercises, updateTemplate } = useTemplateStore();
  const exercises = useWorkoutStore((s) => s.exercises);
  const toast = useToast();

  const template = templates.find((t) => t.id === id);

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [items, setItems] = useState<LocalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');

  useEffect(() => {
    if (!id) return;
    getTemplateExercises(id)
      .then((exs) => {
        setItems(
          exs.map((e) => ({
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            order_index: e.order_index,
            default_sets: e.default_sets,
            default_reps: e.default_reps,
            default_weight: e.default_weight,
          }))
        );
      })
      .catch(() => toast.error(t('templates.failed_load')))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddExercise = (exerciseId: string, exerciseName: string) => {
    const already = items.some((i) => i.exercise_id === exerciseId);
    if (already) return;
    setItems((prev) => [
      ...prev,
      {
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        order_index: prev.length,
        default_sets: 3,
        default_reps: 10,
        default_weight: 0,
      },
    ]);
    setShowPicker(false);
    setPickerFilter('');
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setItems((prev) => prev.filter((i) => i.exercise_id !== exerciseId));
  };

  const handleUpdateField = (
    exerciseId: string,
    field: 'default_sets' | 'default_reps' | 'default_weight',
    value: string
  ) => {
    const num = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((i) => (i.exercise_id === exerciseId ? { ...i, [field]: num } : i))
    );
  };

  const handleSave = async () => {
    if (!id || !name.trim()) return;
    setSaving(true);
    try {
      await updateTemplate(id, name.trim(), description.trim() || null, items);
      toast.success(t('templates.saved'));
      router.back();
    } catch {
      toast.error(t('templates.failed_save'));
    } finally {
      setSaving(false);
    }
  };

  const filteredExercises = exercises.filter(
    (e) =>
      (e.name.toLowerCase().includes(pickerFilter.toLowerCase()) ||
        e.muscle_group.toLowerCase().includes(pickerFilter.toLowerCase())) &&
      !items.some((i) => i.exercise_id === e.id)
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#c8f060" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Text style={styles.label}>{t('templates.name_placeholder')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('templates.name_placeholder')}
          placeholderTextColor="#3a3a4a"
        />

        {/* Description */}
        <Text style={styles.label}>{t('templates.description_placeholder')}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('templates.description_placeholder')}
          placeholderTextColor="#3a3a4a"
          multiline
          numberOfLines={2}
        />

        {/* Exercises header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('workout.exercises_tab')}</Text>
          <TouchableOpacity style={styles.addExBtn} onPress={() => setShowPicker(true)}>
            <Ionicons name="add" size={16} color="#0f0f12" />
            <Text style={styles.addExBtnText}>{t('templates.add_exercise')}</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyEx}>
            <Text style={styles.emptyExText}>{t('templates.no_exercises')}</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.exercise_id} style={styles.exRow}>
              <View style={styles.exHeader}>
                <Text style={styles.exName} numberOfLines={1}>
                  {item.exercise_name}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveExercise(item.exercise_id)}>
                  <Ionicons name="trash-outline" size={18} color="#f06060" />
                </TouchableOpacity>
              </View>
              <View style={styles.exFields}>
                <View style={styles.exField}>
                  <Text style={styles.exFieldLabel}>{t('templates.default_sets')}</Text>
                  <TextInput
                    style={styles.exFieldInput}
                    value={String(item.default_sets)}
                    onChangeText={(v) => handleUpdateField(item.exercise_id, 'default_sets', v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.exField}>
                  <Text style={styles.exFieldLabel}>{t('templates.default_reps')}</Text>
                  <TextInput
                    style={styles.exFieldInput}
                    value={String(item.default_reps)}
                    onChangeText={(v) => handleUpdateField(item.exercise_id, 'default_reps', v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.exField}>
                  <Text style={styles.exFieldLabel}>{t('templates.default_weight')}</Text>
                  <TextInput
                    style={styles.exFieldInput}
                    value={String(item.default_weight)}
                    onChangeText={(v) =>
                      handleUpdateField(item.exercise_id, 'default_weight', v)
                    }
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>
          ))
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0f0f12" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{t('templates.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            onPress={() => setShowPicker(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>{t('templates.add_exercise')}</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#7a7a90" />
              <TextInput
                style={styles.searchInput}
                value={pickerFilter}
                onChangeText={setPickerFilter}
                placeholder={t('workout.search_exercises')}
                placeholderTextColor="#3a3a4a"
                autoFocus
              />
              {pickerFilter.length > 0 && (
                <TouchableOpacity onPress={() => setPickerFilter('')}>
                  <Ionicons name="close-circle" size={16} color="#7a7a90" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredExercises}
              keyExtractor={(e) => e.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => handleAddExercise(item.id, item.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerRowName}>{item.name}</Text>
                  <Text style={styles.pickerRowMuscle}>{item.muscle_group}</Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  centered: { flex: 1, backgroundColor: '#0f0f12', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, gap: 10, paddingBottom: 48 },
  label: { color: '#7a7a90', fontSize: 12, fontWeight: '600', marginBottom: -4 },
  input: {
    backgroundColor: '#16161c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f0f0f0',
    fontSize: 16,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionTitle: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#c8f060',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addExBtnText: { color: '#0f0f12', fontSize: 13, fontWeight: '700' },
  emptyEx: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#16161c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    borderStyle: 'dashed',
  },
  emptyExText: { color: '#7a7a90', fontSize: 14 },
  exRow: {
    backgroundColor: '#16161c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    padding: 12,
    gap: 10,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  exFields: { flexDirection: 'row', gap: 8 },
  exField: { flex: 1, gap: 4 },
  exFieldLabel: { color: '#7a7a90', fontSize: 11, fontWeight: '600' },
  exFieldInput: {
    backgroundColor: '#0f0f12',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#c8f060',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
  // Exercise picker
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: {
    backgroundColor: '#16161c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 14,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#2a2a35',
    borderBottomWidth: 0,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3a3a4a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  pickerTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f0f12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: '#f0f0f0', fontSize: 14 },
  pickerList: { maxHeight: 340 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a22',
  },
  pickerRowName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  pickerRowMuscle: { color: '#7a7a90', fontSize: 12 },
});
