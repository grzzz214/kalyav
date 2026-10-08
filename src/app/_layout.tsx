import React, { useEffect } from 'react';
import { ActivityIndicator, AppState as RNAppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { snapshotState, useStore } from '../data/store';
import { rescheduleReminders } from '../services/notifications';
import { colors } from '../ui/theme';

/** Tâches de fond légères : programme hebdo, bilan du dimanche, rappels. */
function useLifecycle() {
  const hydrated = useStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    const run = () => {
      const s = useStore.getState();
      if (!s.profile) return;
      s.ensureCurrentPlan();
      rescheduleReminders(snapshotState(useStore.getState()), (items) => useStore.getState().markReminderScheduled(items)).catch(
        () => undefined,
      );
    };
    run();
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [hydrated]);
}

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  useLifecycle();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Retour',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Séance' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Exercice', presentation: 'modal' }} />
        <Stack.Screen name="checkin" options={{ title: 'Check-in', presentation: 'modal' }} />
        <Stack.Screen name="food-search" options={{ title: 'Ajouter un aliment' }} />
        <Stack.Screen name="scanner" options={{ title: 'Scanner un code-barres' }} />
        <Stack.Screen name="meal-generator" options={{ title: 'Générateur de repas' }} />
        <Stack.Screen name="recipe" options={{ title: 'Créer un repas' }} />
        <Stack.Screen name="weekly-review" options={{ title: 'Bilan de la semaine' }} />
        <Stack.Screen name="log" options={{ title: 'Saisir mes mesures', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
