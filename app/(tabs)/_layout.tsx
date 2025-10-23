import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  focusedIcon: IconName;
}

const TABS: TabConfig[] = [
  { name: 'index', title: 'Dashboard', icon: 'home-outline', focusedIcon: 'home' },
  { name: 'workout', title: 'Workout', icon: 'barbell-outline', focusedIcon: 'barbell' },
  { name: 'nutrition', title: 'Nutrition', icon: 'nutrition-outline', focusedIcon: 'nutrition' },
  { name: 'macro-ai', title: 'AI Macros', icon: 'camera-outline', focusedIcon: 'camera' },
  { name: 'stats', title: 'Stats', icon: 'stats-chart-outline', focusedIcon: 'stats-chart' },
  { name: 'challenges', title: 'Défis', icon: 'trophy-outline', focusedIcon: 'trophy' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', focusedIcon: 'person' },
];

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f0f12' },
        headerTintColor: '#f0f0f0',
        headerShadowVisible: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#c8f060',
        tabBarInactiveTintColor: '#7a7a90',
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.focusedIcon : tab.icon}
                size={size - 2}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#16161c',
    borderTopColor: '#2a2a35',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: '#16161c',
  },
});
