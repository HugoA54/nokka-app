import '../global.css';
import '../src/i18n';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuthStore } from '@store/authStore';
import { ToastContainer } from '@components/ui/Toast';
import { AchievementToast } from '@components/ui/AchievementToast';
import { useChallengeStore } from '@store/challengeStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupTimerNotificationChannel, requestTimerPermissions } from '@services/timerNotifications';
import { initCreatineReminder, startCreatineAppStateListener } from '@services/creatineReminder';
import { useNetworkSync } from '@hooks/useNetworkSync';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from '@widgets/widgetTaskHandler';
import { getStoredLanguage } from '../src/i18n';
import i18n from '../src/i18n';

registerWidgetTaskHandler(widgetTaskHandler);

if (Constants.appOwnership !== 'expo') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

export default function RootLayout() {
  const { initialize, isInitialized } = useAuthStore();
  const loadAchievements = useChallengeStore((s) => s.loadAchievements);
  const [i18nReady, setI18nReady] = useState(false);
  useNetworkSync();

  useEffect(() => {
    getStoredLanguage().then((lang) => {
      i18n.changeLanguage(lang).finally(() => setI18nReady(true));
    });
    initialize().finally(() => SplashScreen.hideAsync());
    loadAchievements();

    const hideNavBar = () => {
      NavigationBar.setVisibilityAsync('hidden');
    };

    NavigationBar.setBehaviorAsync('overlay-swipe');
    hideNavBar();
    setupTimerNotificationChannel();
    requestTimerPermissions();
    initCreatineReminder();
    const creatineSub = startCreatineAppStateListener();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hideNavBar();
    });

    return () => { sub.remove(); creatineSub(); };
  }, []);

  if (!isInitialized || !i18nReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" hidden translucent />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0f0f12' },
            headerTintColor: '#f0f0f0',
            headerShadowVisible: false,
            contentStyle: { backgroundColor: '#0f0f12' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="session/[id]"
            options={{ title: i18n.t('session.title'), headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="exercise/[id]"
            options={{ title: i18n.t('exercise.title'), headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="meal/editor"
            options={{ title: i18n.t('meal_editor.title'), headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="meal/prep"
            options={{ title: i18n.t('meal_prep.title'), headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="leaderboard"
            options={{ title: i18n.t('leaderboard.title'), headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="shopping-list"
            options={{ title: i18n.t('shopping_list.title'), headerBackTitle: 'Back' }}
          />
        </Stack>
        <ToastContainer />
        <AchievementToast />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
