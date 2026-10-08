import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../data/store';
import { colors } from '../../ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName, active: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : name} size={24} color={color} />;
  };
}

export default function TabLayout() {
  const hasProfile = useStore((s) => !!s.profile);
  if (!hasProfile) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMute,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="sport" options={{ title: 'Sport', tabBarIcon: icon('barbell-outline', 'barbell') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('nutrition-outline', 'nutrition') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progression', tabBarIcon: icon('trending-up-outline', 'trending-up') }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach IA', tabBarIcon: icon('sparkles-outline', 'sparkles') }} />
    </Tabs>
  );
}
