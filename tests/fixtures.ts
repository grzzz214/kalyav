import type { AppState, UserProfile } from '../src/core/types';
import { defaultAdjustments } from '../src/core/coach/adaptationEngine';
import { defaultReminders } from '../src/core/reminders/scheduler';

export function makeProfile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    firstName: 'Alex',
    age: 32,
    sex: 'male',
    heightCm: 180,
    weightKg: 85,
    goal: 'fat_loss',
    targetWeightKg: 78,
    level: 'intermediate',
    sessionsPerWeek: 3,
    availableDays: [0, 1, 2, 3, 4, 5],
    sessionMinutes: 45,
    preferredStyles: ['strength'],
    equipment: ['dumbbells', 'bench'],
    diet: 'omnivore',
    eatingHabits: '',
    mealsPerDay: 3,
    allergies: [],
    likedFoods: [],
    dislikedFoods: [],
    bedtime: '23:00',
    wakeTime: '07:00',
    trainingTime: '18:00',
    occupation: 'Bureau',
    activityLevel: 'light',
    limitations: [],
    limitationNotes: '',
    createdAt: '2026-08-01T08:00:00.000Z',
    ...over,
  };
}

export function makeState(over: Partial<AppState> = {}): AppState {
  const profile = over.profile ?? makeProfile();
  return {
    profile,
    weights: [],
    measurements: [],
    foodLog: [],
    morningCheckIns: [],
    eveningCheckIns: [],
    activity: [],
    workouts: [],
    plans: [],
    reviews: [],
    adjustments: defaultAdjustments(),
    reminders: defaultReminders(profile),
    reminderStats: {},
    customFoods: [],
    customRecipes: [],
    favoriteFoodIds: [],
    dismissedInsights: [],
    ...over,
  };
}
