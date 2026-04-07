import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import fr from './fr.json';
import en from './en.json';

const LANGUAGE_KEY = 'nokka_language';

export const supportedLanguages = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

export async function getStoredLanguage(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored) return stored;
  } catch {}
  // Fallback to device locale
  const locale = Localization.getLocales()[0]?.languageCode ?? 'fr';
  return locale === 'en' ? 'en' : 'fr';
}

export async function setStoredLanguage(lang: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
