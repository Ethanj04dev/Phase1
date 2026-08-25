import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme';

type FeatherName = keyof typeof Feather.glyphMap;

interface TabDefinition {
  name: string;
  title: string;
  icon: FeatherName;
}

/**
 * Four tabs, deliberately. Each one answers a different question:
 * what now, what is the plan, am I improving, who am I training as.
 */
const TABS: readonly TabDefinition[] = [
  { name: 'index', title: 'Today', icon: 'crosshair' },
  { name: 'train', title: 'Train', icon: 'activity' },
  { name: 'progress', title: 'Progress', icon: 'trending-up' },
  { name: 'profile', title: 'Profile', icon: 'user' },
];

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: theme.hairline.width,
          elevation: 0,
        },
        tabBarLabelStyle: theme.typography.labelSm,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name={tab.icon} color={color} size={size ?? 20} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
