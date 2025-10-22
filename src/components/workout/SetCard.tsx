import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@store/workoutStore';
import { useHaptics } from '@hooks/useHaptics';
import { calculate1RM } from '@services/calorieCalculations';
import type { WorkoutSet } from '@types/index';

interface SetCardProps {
  set: WorkoutSet;
  index: number;
  onStartRest: (duration: number) => void;
  onChallengeEval?: () => void;
}

export function SetCard({ set, index, onStartRest, onChallengeEval }: SetCardProps) {
  const { updateSet, deleteSet, getLastSessionSetsForExercise } = useWorkoutStore();
  const haptics = useHaptics();

  const isPlaceholder = set.note === 'À FAIRE';
  const lastSets = getLastSessionSetsForExercise(set.exercise_id, set.session_id);

  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.repetitions));
  const [rpe, setRpe] = useState(set.rpe ? String(set.rpe) : '');
  const [note, setNote] = useState(isPlaceholder ? '' : (set.note ?? ''));
  const [showNote, setShowNote] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const estimated1RM = calculate1RM(Number(weight) || 0, Number(reps) || 1);

  const handleSave = async () => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r) || r <= 0) return;

    try {
      await updateSet(set.id, {
        weight: w,
        repetitions: r,
        rpe: rpe ? parseFloat(rpe) : null,
        note: note || null,
        display_weight: `${w} kg`,
      });
      await haptics.success();
      setIsDirty(false);
      onChallengeEval?.();
    } catch {
      await haptics.error();
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Set', 'Are you sure you want to delete this set?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await haptics.medium();
          await deleteSet(set.id);
          onChallengeEval?.();
        },
      },
    ]);
  };

  // Placeholder "À FAIRE" view
  if (isPlaceholder) {
    return (
      <View style={[styles.container, styles.placeholderContainer]}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>#{index + 1}</Text>
          </View>
          <View style={styles.aFaireBadge}>
            <Text style={styles.aFaireText}>À FAIRE</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color="#7a7a90" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>#{index + 1}</Text>
        </View>
        <Text style={styles.setLabel}>{set.weight}kg × {set.repetitions}</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color="#7a7a90" />
        </TouchableOpacity>
      </View>

      {/* Last session */}
      {lastSets.length > 0 && (
        <View style={styles.lastBlock}>
          <View style={styles.lastRow}>
            <Ionicons name="time-outline" size={11} color="#3a3a4a" />
            <Text style={styles.lastLabel}>Précédent :</Text>
            {lastSets.slice(0, 4).map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setWeight(String(s.weight));
                  setReps(String(s.repetitions));
                  setIsDirty(true);
                  if (s.note) setExpandedNoteId(expandedNoteId === s.id ? null : s.id);
                }}
                activeOpacity={0.7}
                style={styles.lastChip}
              >
                <Text style={styles.lastChipText}>{s.weight}×{s.repetitions}</Text>
                {s.note ? <View style={styles.noteDot} /> : null}
              </TouchableOpacity>
            ))}
          </View>
          {expandedNoteId && lastSets.find((s) => s.id === expandedNoteId)?.note ? (
            <View style={styles.chipNoteExpanded}>
              <Ionicons name="chatbubble-outline" size={11} color="#5a5a70" />
              <Text style={styles.chipNoteText}>{lastSets.find((s) => s.id === expandedNoteId)?.note}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Inputs */}
      <View style={styles.inputs}>
        {/* Weight */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Weight (kg)</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                const v = Math.max(0, Math.round((parseFloat(weight || '0') - 2.5) * 10) / 10);
                setWeight(String(v));
                setIsDirty(true);
              }}
            >
              <Ionicons name="remove" size={14} color="#c8f060" />
            </TouchableOpacity>
            <TextInput
              style={styles.stepInput}
              value={weight}
              onChangeText={(v) => { setWeight(v); setIsDirty(true); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#3a3a4a"
            />
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                const v = Math.round((parseFloat(weight || '0') + 2.5) * 10) / 10;
                setWeight(String(v));
                setIsDirty(true);
              }}
            >
              <Ionicons name="add" size={14} color="#c8f060" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Reps */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Reps</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                const v = Math.max(1, parseInt(reps || '0', 10) - 1);
                setReps(String(v));
                setIsDirty(true);
              }}
            >
              <Ionicons name="remove" size={14} color="#c8f060" />
            </TouchableOpacity>
            <TextInput
              style={styles.stepInput}
              value={reps}
              onChangeText={(v) => { setReps(v); setIsDirty(true); }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#3a3a4a"
            />
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => {
                const v = parseInt(reps || '0', 10) + 1;
                setReps(String(v));
                setIsDirty(true);
              }}
            >
              <Ionicons name="add" size={14} color="#c8f060" />
            </TouchableOpacity>
          </View>
        </View>

        {/* RPE */}
        <View style={[styles.inputGroup, styles.inputGroupSmall]}>
          <Text style={styles.inputLabel}>RPE</Text>
          <TextInput
            style={styles.input}
            value={rpe}
            onChangeText={(v) => { setRpe(v); setIsDirty(true); }}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor="#3a3a4a"
          />
        </View>
      </View>

      {/* 1RM estimate */}
      <Text style={styles.oneRM}>
        Estimated 1RM: <Text style={styles.onERMValue}>{estimated1RM} kg</Text>
      </Text>

      {/* Note toggle */}
      <TouchableOpacity
        style={styles.noteToggle}
        onPress={() => setShowNote(!showNote)}
      >
        <Ionicons
          name={showNote ? 'chevron-up' : 'chatbubble-outline'}
          size={14}
          color="#7a7a90"
        />
        <Text style={styles.noteToggleText}>{showNote ? 'Hide note' : 'Add note'}</Text>
      </TouchableOpacity>

      {showNote && (
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={(v) => { setNote(v); setIsDirty(true); }}
          placeholder="Notes about this set…"
          placeholderTextColor="#3a3a4a"
          multiline
          numberOfLines={2}
        />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {isDirty && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark" size={14} color="#0f0f12" />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.restBtn}
          onPress={() => { onStartRest(90); haptics.light(); }}
        >
          <Ionicons name="timer-outline" size={14} color="#7a7a90" />
          <Text style={styles.restBtnText}>Rest 90s</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.restBtn}
          onPress={() => { onStartRest(180); haptics.light(); }}
        >
          <Ionicons name="timer-outline" size={14} color="#7a7a90" />
          <Text style={styles.restBtnText}>Rest 3m</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#2a2a35',
    gap: 10,
  },
  placeholderContainer: {
    backgroundColor: 'rgba(240,200,60,0.06)',
    borderColor: 'rgba(240,200,60,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#2a2a35',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '600',
  },
  setLabel: {
    flex: 1,
    color: '#c8f060',
    fontSize: 14,
    fontWeight: '700',
  },
  aFaireBadge: {
    flex: 1,
    backgroundColor: 'rgba(240,200,60,0.15)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(240,200,60,0.3)',
    alignItems: 'center',
  },
  aFaireText: {
    color: '#f0c83c',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputs: {
    flexDirection: 'row',
    gap: 8,
  },
  inputGroup: {
    flex: 1,
    gap: 4,
  },
  inputGroupSmall: {
    flex: 0,
    width: 58,
  },
  inputLabel: {
    color: '#7a7a90',
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0f0f12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 7,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    flex: 1,
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
  oneRM: {
    color: '#7a7a90',
    fontSize: 12,
  },
  onERMValue: {
    color: '#c8f060',
    fontWeight: '700',
  },
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteToggleText: {
    color: '#7a7a90',
    fontSize: 12,
  },
  noteInput: {
    backgroundColor: '#0f0f12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
    padding: 10,
    color: '#f0f0f0',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  lastBlock: { gap: 4 },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  lastLabel: {
    color: '#3a3a4a',
    fontSize: 11,
  },
  lastChip: {
    backgroundColor: '#1e1e28',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#2a2a35',
    position: 'relative',
  },
  lastChipText: {
    color: '#5a5a70',
    fontSize: 11,
    fontWeight: '600',
  },
  noteDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c8f060',
  },
  chipNoteExpanded: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#1a1a22',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  chipNoteText: {
    color: '#5a5a70',
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#c8f060',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBtnText: {
    color: '#0f0f12',
    fontSize: 13,
    fontWeight: '700',
  },
  restBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2a2a35',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restBtnText: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '600',
  },
});
