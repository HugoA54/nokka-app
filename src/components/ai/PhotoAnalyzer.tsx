import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMacroAIStore } from '@store/macroAIStore';
import { useAuthStore } from '@store/authStore';
import { useToast } from '@hooks/useToast';
import { AIAnalyzingOverlay } from '@components/ui/LoadingSkeleton';
import type { AIMacroResult } from '@types/index';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Step Components ────────────────────────────────────────────────────────

function IdleStep({ onCamera, onGallery }: { onCamera: () => void; onGallery: () => void }) {
  return (
    <View style={styles.idleContainer}>
      {/* Hero illustration */}
      <View style={styles.heroCircle}>
        <Ionicons name="camera" size={52} color="#c8f060" />
      </View>
      <Text style={styles.heroTitle}>AI Macro Analyzer</Text>
      <Text style={styles.heroSubtitle}>
        Take or upload a photo of your meal and let Gemini AI instantly calculate its macros.
      </Text>

      <View style={styles.idleButtons}>
        <TouchableOpacity style={styles.cameraBtn} onPress={onCamera}>
          <Ionicons name="camera-outline" size={22} color="#0f0f12" />
          <Text style={styles.cameraBtnText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.galleryBtn} onPress={onGallery}>
          <Ionicons name="image-outline" size={22} color="#f0f0f0" />
          <Text style={styles.galleryBtnText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCards}>
        {[
          { icon: 'flash', text: 'Instant analysis with Gemini 2.5 Flash' },
          { icon: 'shield-checkmark', text: 'Accurate calorie & macro estimation' },
          { icon: 'pencil', text: 'Editable results before saving' },
        ].map((item, i) => (
          <View key={i} style={styles.infoCard}>
            <Ionicons name={item.icon as any} size={16} color="#c8f060" />
            <Text style={styles.infoText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PreviewStep({
  imageUri,
  notes,
  onNotesChange,
  onAnalyze,
  onReset,
  error,
}: {
  imageUri: string;
  notes: string;
  onNotesChange: (v: string) => void;
  onAnalyze: () => void;
  onReset: () => void;
  error: string | null;
}) {
  return (
    <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
      <Image
        source={{ uri: imageUri }}
        style={styles.previewImage}
        contentFit="cover"
        transition={300}
      />

      <View style={styles.previewBody}>
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#f06060" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.notesLabel}>Notes for AI (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          placeholder="e.g. 'large portion', '2 chicken breasts', 'with olive oil'…"
          placeholderTextColor="#3a3a4a"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <Text style={styles.notesHint}>
          Adding context helps the AI give more accurate estimates.
        </Text>

        <TouchableOpacity style={styles.analyzeBtn} onPress={onAnalyze}>
          <Ionicons name="sparkles" size={20} color="#0f0f12" />
          <Text style={styles.analyzeBtnText}>Analyze with AI</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.retakeBtn} onPress={onReset}>
          <Ionicons name="refresh-outline" size={16} color="#7a7a90" />
          <Text style={styles.retakeBtnText}>Use Different Photo</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ReviewStep({
  imageUri,
  result,
  onResultChange,
  onSave,
  onReset,
  isSaving,
}: {
  imageUri: string;
  result: AIMacroResult;
  onResultChange: (updated: AIMacroResult) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
}) {
  const macros: { key: keyof AIMacroResult; label: string; color: string; unit: string }[] = [
    { key: 'calories', label: 'Calories', color: '#f0f0f0', unit: 'kcal' },
    { key: 'proteines', label: 'Protein', color: '#60d4f0', unit: 'g' },
    { key: 'glucides', label: 'Carbs', color: '#f0c060', unit: 'g' },
    { key: 'lipides', label: 'Fats', color: '#f060a8', unit: 'g' },
  ];

  return (
    <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
      {/* Result image */}
      <View style={styles.reviewImageWrapper}>
        <Image source={{ uri: imageUri }} style={styles.reviewImage} contentFit="cover" />
        <View style={styles.aiTag}>
          <Ionicons name="sparkles" size={12} color="#0f0f12" />
          <Text style={styles.aiTagText}>AI Analysis</Text>
        </View>
      </View>

      <View style={styles.reviewBody}>
        {/* Meal name */}
        <Text style={styles.reviewSectionLabel}>Meal Name</Text>
        <TextInput
          style={styles.nameInput}
          value={result.name}
          onChangeText={(v) => onResultChange({ ...result, name: v })}
          placeholder="Meal name"
          placeholderTextColor="#3a3a4a"
        />

        {/* Macro inputs */}
        <Text style={styles.reviewSectionLabel}>Nutritional Values (editable)</Text>
        <View style={styles.macroGrid}>
          {macros.map(({ key, label, color, unit }) => (
            <View key={key} style={styles.macroInputCard}>
              <View style={[styles.macroColorDot, { backgroundColor: color }]} />
              <Text style={styles.macroInputLabel}>{label}</Text>
              <TextInput
                style={[styles.macroInput, { color }]}
                value={String(result[key])}
                onChangeText={(v) => {
                  const num = parseInt(v, 10);
                  onResultChange({ ...result, [key]: isNaN(num) ? 0 : num });
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#3a3a4a"
              />
              <Text style={styles.macroUnit}>{unit}</Text>
            </View>
          ))}
        </View>

        {/* Calorie check */}
        <View style={styles.calCheck}>
          <Text style={styles.calCheckText}>
            Macro-derived calories:{' '}
            <Text style={styles.calCheckValue}>
              {Math.round(result.proteines * 4 + result.glucides * 4 + result.lipides * 9)} kcal
            </Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#0f0f12" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#0f0f12" />
              <Text style={styles.saveBtnText}>Save Meal</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.discardBtn} onPress={onReset}>
          <Text style={styles.discardBtnText}>Discard & Start Over</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PhotoAnalyzer() {
  const user = useAuthStore((s) => s.user);
  const {
    analysisStep,
    imageUri,
    imageBase64,
    analysisResult,
    analysisError,
    analysisNotes,
    isAnalyzing,
    setImagePreview,
    setAnalysisNotes,
    analyzeImage,
    setAnalysisResult,
    resetAnalysis,
    addMeal,
  } = useMacroAIStore();
  const toast = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Image Picking ────────────────────────────────────────────────────────

  async function compressAndPickImage(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    try {
      // Compress to 800x800
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) throw new Error('Image manipulation failed to return base64.');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setImagePreview(manipulated.uri, manipulated.base64);
    } catch (err: any) {
      toast.error('Failed to process image: ' + (err?.message ?? 'Unknown error'));
    }
  }

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take meal photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });
    await compressAndPickImage(result);
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select meal photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });
    await compressAndPickImage(result);
  };

  // ── Analysis ─────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await analyzeImage();
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!analysisResult || !user) return;
    setIsSaving(true);
    try {
      await addMeal(user.id, {
        name: analysisResult.name,
        calories: analysisResult.calories,
        proteines: analysisResult.proteines,
        glucides: analysisResult.glucides,
        lipides: analysisResult.lipides,
        image_url: null,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(`"${analysisResult.name}" saved!`);
      resetAnalysis();
    } catch (err: any) {
      toast.error('Failed to save meal: ' + (err?.message ?? 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (analysisStep === 'idle') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <IdleStep onCamera={handleCamera} onGallery={handleGallery} />
      </ScrollView>
    );
  }

  if (analysisStep === 'preview' && imageUri) {
    return (
      <View style={styles.container}>
        <PreviewStep
          imageUri={imageUri}
          notes={analysisNotes}
          onNotesChange={setAnalysisNotes}
          onAnalyze={handleAnalyze}
          onReset={resetAnalysis}
          error={analysisError}
        />
      </View>
    );
  }

  if (analysisStep === 'analyzing') {
    return (
      <View style={[styles.container, styles.analyzingContainer]}>
        <Image
          source={{ uri: imageUri! }}
          style={styles.analyzingBg}
          contentFit="cover"
          blurRadius={20}
        />
        <View style={styles.analyzingOverlay}>
          <AIAnalyzingOverlay />
          <Text style={styles.analyzingTitle}>AI is analyzing your meal…</Text>
          <Text style={styles.analyzingSubtitle}>
            Gemini 2.5 Flash is estimating the nutritional content
          </Text>
        </View>
      </View>
    );
  }

  if (analysisStep === 'review' && analysisResult && imageUri) {
    return (
      <View style={styles.container}>
        <ReviewStep
          imageUri={imageUri}
          result={analysisResult}
          onResultChange={setAnalysisResult}
          onSave={handleSave}
          onReset={resetAnalysis}
          isSaving={isSaving}
        />
      </View>
    );
  }

  return null;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f12',
  },
  // Idle
  idleContainer: {
    padding: 24,
    alignItems: 'center',
    paddingTop: 40,
    gap: 20,
  },
  heroCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#16161c',
    borderWidth: 2,
    borderColor: '#c8f060',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#f0f0f0',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#7a7a90',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  idleButtons: {
    width: '100%',
    gap: 12,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#c8f060',
    borderRadius: 16,
    paddingVertical: 16,
  },
  cameraBtnText: {
    color: '#0f0f12',
    fontSize: 16,
    fontWeight: '700',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2a2a35',
    borderRadius: 16,
    paddingVertical: 16,
  },
  galleryBtnText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCards: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  infoText: {
    color: '#7a7a90',
    fontSize: 13,
    flex: 1,
  },
  // Preview
  previewScroll: {
    flex: 1,
  },
  previewImage: {
    width: SCREEN_W,
    height: SCREEN_W * 0.75,
  },
  previewBody: {
    padding: 20,
    gap: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(240,96,96,0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f06060',
  },
  errorText: {
    color: '#f06060',
    fontSize: 13,
    flex: 1,
  },
  notesLabel: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    padding: 14,
    color: '#f0f0f0',
    fontSize: 14,
    minHeight: 80,
  },
  notesHint: {
    color: '#7a7a90',
    fontSize: 12,
    marginTop: -6,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#c8f060',
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 4,
  },
  analyzeBtnText: {
    color: '#0f0f12',
    fontSize: 17,
    fontWeight: '700',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  retakeBtnText: {
    color: '#7a7a90',
    fontSize: 14,
  },
  // Analyzing
  analyzingContainer: {
    position: 'relative',
  },
  analyzingBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  analyzingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  analyzingTitle: {
    color: '#f0f0f0',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  analyzingSubtitle: {
    color: '#7a7a90',
    fontSize: 14,
    textAlign: 'center',
  },
  // Review
  reviewScroll: {
    flex: 1,
  },
  reviewImageWrapper: {
    position: 'relative',
  },
  reviewImage: {
    width: SCREEN_W,
    height: SCREEN_W * 0.6,
  },
  aiTag: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#c8f060',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiTagText: {
    color: '#0f0f12',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewBody: {
    padding: 20,
    gap: 16,
  },
  reviewSectionLabel: {
    color: '#7a7a90',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nameInput: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '700',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  macroInputCard: {
    width: '47%',
    backgroundColor: '#16161c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    padding: 14,
    gap: 6,
    alignItems: 'flex-start',
  },
  macroColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroInputLabel: {
    color: '#7a7a90',
    fontSize: 12,
    fontWeight: '600',
  },
  macroInput: {
    fontSize: 28,
    fontWeight: '700',
    width: '100%',
  },
  macroUnit: {
    color: '#7a7a90',
    fontSize: 11,
  },
  calCheck: {
    backgroundColor: '#16161c',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  calCheckText: {
    color: '#7a7a90',
    fontSize: 12,
  },
  calCheckValue: {
    color: '#c8f060',
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#c8f060',
    borderRadius: 16,
    paddingVertical: 18,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#0f0f12',
    fontSize: 17,
    fontWeight: '700',
  },
  discardBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  discardBtnText: {
    color: '#f06060',
    fontSize: 14,
    fontWeight: '600',
  },
});
