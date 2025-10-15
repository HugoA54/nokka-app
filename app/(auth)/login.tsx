import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@store/authStore';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const { user, signIn, isLoading } = useAuthStore();
  const toast = useToast();
  const haptics = useHaptics();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  // Already logged in — redirect
  if (user) return <Redirect href="/(tabs)" />;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLocalLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        await haptics.success();
        toast.success('Welcome back!');
      } else {
        // Register then sign in
        const { supabase } = await import('@services/supabase');
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        await signIn(email.trim(), password);
        await haptics.success();
        toast.success('Account created! Welcome to Nokka!');
      }
    } catch (err: any) {
      await haptics.error();
      toast.error(err?.message ?? 'Authentication failed. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const busy = isLoading || localLoading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandSection}>
          <LinearGradient
            colors={['#c8f060', '#a0c040']}
            style={styles.logoCircle}
          >
            <Text style={styles.logoText}>N</Text>
          </LinearGradient>
          <Text style={styles.appName}>Nokka</Text>
          <Text style={styles.tagline}>Train. Eat. Thrive.</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          {(['login', 'register'] as AuthMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Welcome back' : 'Get started'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'login'
              ? 'Sign in to your Nokka account'
              : 'Create your free Nokka account'}
          </Text>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#7a7a90" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#3a3a4a"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                textContentType="emailAddress"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#7a7a90" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor="#3a3a4a"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#7a7a90"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#0f0f12" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#0f0f12" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Features showcase */}
        <View style={styles.features}>
          {[
            { icon: 'barbell-outline', text: 'Track every workout & set' },
            { icon: 'nutrition-outline', text: 'Log meals with food database' },
            { icon: 'camera-outline', text: 'AI macro analysis from photos' },
            { icon: 'stats-chart-outline', text: 'Deep performance analytics' },
          ].map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={18} color="#c8f060" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f12',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
    gap: 24,
  },
  brandSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoText: {
    color: '#0f0f12',
    fontSize: 36,
    fontWeight: '900',
  },
  appName: {
    color: '#f0f0f0',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  tagline: {
    color: '#7a7a90',
    fontSize: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#c8f060',
  },
  modeBtnText: {
    color: '#7a7a90',
    fontSize: 14,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#0f0f12',
  },
  formCard: {
    backgroundColor: '#16161c',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  formTitle: {
    color: '#f0f0f0',
    fontSize: 22,
    fontWeight: '800',
  },
  formSubtitle: {
    color: '#7a7a90',
    fontSize: 14,
    marginTop: -8,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: '#7a7a90',
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 14,
    gap: 10,
  },
  inputIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#f0f0f0',
    fontSize: 15,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#c8f060',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#0f0f12',
    fontSize: 16,
    fontWeight: '700',
  },
  features: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#16161c',
    borderWidth: 1,
    borderColor: '#2a2a35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: '#7a7a90',
    fontSize: 14,
  },
});
