import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, { container: object; text: object }> = {
  primary: {
    container: { backgroundColor: '#c8f060', borderColor: '#c8f060' },
    text: { color: '#0f0f12' },
  },
  secondary: {
    container: { backgroundColor: '#2a2a35', borderColor: '#2a2a35' },
    text: { color: '#f0f0f0' },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: '#2a2a35' },
    text: { color: '#f0f0f0' },
  },
  danger: {
    container: { backgroundColor: '#f06060', borderColor: '#f06060' },
    text: { color: '#fff' },
  },
};

const SIZE_STYLES: Record<ButtonSize, { container: object; text: object }> = {
  sm: {
    container: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    text: { fontSize: 13, fontWeight: '600' },
  },
  md: {
    container: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    text: { fontSize: 15, fontWeight: '600' },
  },
  lg: {
    container: { paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14 },
    text: { fontSize: 17, fontWeight: '700' },
  },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || isLoading;

  const handlePress = async (e: any) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle.container,
        sizeStyle.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      activeOpacity={0.75}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#0f0f12' : '#f0f0f0'}
        />
      ) : (
        <View style={styles.row}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <Text style={[styles.baseText, variantStyle.text, sizeStyle.text]}>{label}</Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  baseText: {
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});
