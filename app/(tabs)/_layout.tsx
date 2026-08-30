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
 * The Zero Phase navigation: competitive first.
 *
 * Home is the candidate's standing, Rankings is the product, Test is how
 * performance enters it, Community is who else is in it, Profile is who the
 * candidate is. Training deliberately has no tab -- it is reached from Home,
 * because Zero Phase is not a workout tracker.
 */
const TABS: readonly TabDefinition[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'rankings', title: 'Rankings', icon: 'bar-chart-2' },
  { name: 'test', title: 'Test', icon: 'check-circle' },
  { name: 'community', title: 'Community', icon: 'users' },
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
