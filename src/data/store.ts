import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppState,
  DailyActivity,
  EveningCheckIn,
  Food,
  FoodLogEntry,
  ISODate,
  Measurement,
  MorningCheckIn,
  PlannedSession,
  Recipe,
  ReminderConfig,
  ReminderKind,
  UserProfile,
  WeeklyPlan,
  WorkoutLog,
} from '../core/types';
import { applyAdjustment, defaultAdjustments, type CoachInsight } from '../core/coach/adaptationEngine';
import { defaultReminders, recordAction } from '../core/reminders/scheduler';
import { generateWeeklyPlan } from '../core/training/programGenerator';
import { weeklyRollover } from '../core/coach/weeklyReview';
import { startOfWeek, today as todayISO } from '../core/utils/date';
import { uid } from '../core/utils/stats';

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const initialState = (): AppState => ({
  profile: null,
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
  reminders: [],
  reminderStats: {},
  customFoods: [],
  customRecipes: [],
  favoriteFoodIds: [],
  dismissedInsights: [],
});

export interface Actions {
  completeOnboarding: (p: UserProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  logWeight: (kg: number, date?: ISODate) => void;
  logMeasurement: (m: Measurement) => void;
  addFood: (e: Omit<FoodLogEntry, 'id' | 'createdAt'>) => void;
  removeFood: (id: string) => void;
  addWater: (ml: number, date?: ISODate) => void;
  setSteps: (steps: number, date?: ISODate) => void;
  patchActivity: (date: ISODate, patch: Partial<DailyActivity>) => void;
  saveMorningCheckIn: (c: Omit<MorningCheckIn, 'createdAt'>) => void;
  saveEveningCheckIn: (c: Omit<EveningCheckIn, 'createdAt'>) => void;
  saveWorkout: (w: Omit<WorkoutLog, 'id' | 'createdAt'>) => void;
  updatePlannedSession: (s: PlannedSession) => void;
  ensureCurrentPlan: (date?: ISODate) => void;
  regenerateCurrentPlan: () => void;
  acceptInsight: (i: CoachInsight) => void;
  dismissInsight: (id: string) => void;
  updateReminder: (id: ReminderKind, patch: Partial<ReminderConfig>) => void;
  snoozeReminderSuggestion: (id: ReminderKind, until: ISODate) => void;
  markReminderScheduled: (ids: { kind: ReminderKind; date: ISODate }[]) => void;
  addCustomFood: (f: Food) => void;
  addCustomRecipe: (r: Recipe) => void;
  toggleFavorite: (foodId: string) => void;
  importState: (s: AppState) => void;
  reset: () => void;
}

export type Store = AppState & Actions & { hydrated: boolean; updatedAt: string };

function upsertBy<T>(list: T[], item: T, key: (x: T) => string): T[] {
  const k = key(item);
  const idx = list.findIndex((x) => key(x) === k);
  if (idx === -1) return [...list, item];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** chaque écriture met à jour l'horodatage utilisé par la synchronisation */
      const write = (patch: Partial<AppState> | ((s: Store) => Partial<AppState>)) =>
        set((s) => ({ ...(typeof patch === 'function' ? patch(s) : patch), updatedAt: new Date().toISOString() }));

      const acted = (kind: ReminderKind, date: ISODate) =>
        write((s) => ({ reminderStats: { ...s.reminderStats, [kind]: recordAction(s.reminderStats[kind], date, nowTime()) } }));

      const activityFor = (s: AppState, date: ISODate): DailyActivity =>
        s.activity.find((a) => a.date === date) ?? { date, steps: 0, waterMl: 0 };

      return {
        ...initialState(),
        hydrated: false,
        updatedAt: new Date(0).toISOString(),

        completeOnboarding: (profile) => {
          const date = todayISO();
          write({
            ...initialState(),
            profile,
            weights: [{ date, kg: profile.weightKg }],
            reminders: defaultReminders(profile),
            plans: [generateWeeklyPlan(profile, startOfWeek(date), { startFrom: date })],
          });
        },

        updateProfile: (patch) => {
          const profile = get().profile;
          if (!profile) return;
          const next = { ...profile, ...patch };
          write({ profile: next });
          const trainingKeys: (keyof UserProfile)[] = [
            'goal', 'level', 'sessionsPerWeek', 'availableDays', 'sessionMinutes', 'equipment', 'limitations', 'preferredStyles',
          ];
          if (trainingKeys.some((k) => k in patch)) get().regenerateCurrentPlan();
        },

        logWeight: (kg, date = todayISO()) => {
          write((s) => ({ weights: upsertBy(s.weights, { date, kg }, (w) => w.date) }));
        },

        logMeasurement: (m) => write((s) => ({ measurements: upsertBy(s.measurements, m, (x) => x.date) })),

        addFood: (e) => {
          write((s) => ({ foodLog: [...s.foodLog, { ...e, id: uid('food'), createdAt: new Date().toISOString() }] }));
          if (e.slot === 'lunch' || e.slot === 'dinner') acted('lunch', e.date);
        },

        removeFood: (id) => write((s) => ({ foodLog: s.foodLog.filter((f) => f.id !== id) })),

        addWater: (ml, date = todayISO()) => {
          write((s) => {
            const a = activityFor(s, date);
            return { activity: upsertBy(s.activity, { ...a, waterMl: Math.max(0, a.waterMl + ml) }, (x) => x.date) };
          });
          if (ml > 0) acted('water', date);
        },

        setSteps: (steps, date = todayISO()) =>
          write((s) => ({ activity: upsertBy(s.activity, { ...activityFor(s, date), steps: Math.max(0, Math.round(steps)) }, (x) => x.date) })),

        patchActivity: (date, patch) =>
          write((s) => ({ activity: upsertBy(s.activity, { ...activityFor(s, date), ...patch }, (x) => x.date) })),

        saveMorningCheckIn: (c) => {
          const entry = { ...c, createdAt: new Date().toISOString() };
          write((s) => ({
            morningCheckIns: upsertBy(s.morningCheckIns, entry, (x) => x.date),
            weights: c.weightKg ? upsertBy(s.weights, { date: c.date, kg: c.weightKg }, (w) => w.date) : s.weights,
          }));
          acted('wake', c.date);
        },

        saveEveningCheckIn: (c) => {
          const entry = { ...c, createdAt: new Date().toISOString() };
          write((s) => {
            const a = activityFor(s, c.date);
            return {
              eveningCheckIns: upsertBy(s.eveningCheckIns, entry, (x) => x.date),
              activity: c.waterMl > a.waterMl ? upsertBy(s.activity, { ...a, waterMl: c.waterMl }, (x) => x.date) : s.activity,
            };
          });
          acted('nutrition_review', c.date);
        },

        saveWorkout: (w) => {
          write((s) => ({ workouts: [...s.workouts, { ...w, id: uid('wo'), createdAt: new Date().toISOString() }] }));
          acted('training', w.date);
        },

        updatePlannedSession: (session) =>
          write((s) => ({
            plans: s.plans.map((p) =>
              p.weekStart === startOfWeek(session.date)
                ? { ...p, sessions: p.sessions.map((x) => (x.id === session.id ? session : x)) }
                : p,
            ),
          })),

        /** Génère le bilan + le programme de la semaine si nécessaire (au lancement). */
        ensureCurrentPlan: (date = todayISO()) => {
          const s = get();
          if (!s.profile) return;
          const { review, plan, adjustments } = weeklyRollover(s, date);
          if (!review && !plan) return;
          write((st) => ({
            reviews: review ? [...st.reviews, review] : st.reviews,
            plans: plan ? [...st.plans.filter((p) => p.weekStart !== plan.weekStart), plan] : st.plans,
            adjustments,
          }));
          // Le dimanche, on prépare la semaine suivante ET on s'assure que la semaine courante existe.
          const current = startOfWeek(date);
          if (!get().plans.some((p) => p.weekStart === current)) {
            const s2 = get();
            write((st) => ({
              plans: [
                ...st.plans,
                generateWeeklyPlan(s2.profile!, current, {
                  startFrom: date,
                  volumeModifier: s2.adjustments.volumeModifier,
                  sessionReduction: s2.adjustments.sessionReduction,
                }),
              ],
            }));
          }
        },

        /** Régénère les séances à venir de la semaine (les séances passées restent intactes). */
        regenerateCurrentPlan: () => {
          const s = get();
          if (!s.profile) return;
          const date = todayISO();
          const weekStart = startOfWeek(date);
          const fresh = generateWeeklyPlan(s.profile, weekStart, {
            volumeModifier: s.adjustments.volumeModifier,
            sessionReduction: s.adjustments.sessionReduction,
            rationale: s.adjustments.history[0] ? [`Adapté suite à : ${s.adjustments.history[0].title}.`] : [],
          });
          const old = s.plans.find((p) => p.weekStart === weekStart);
          const done = new Set(s.workouts.map((w) => w.date));
          const merged: WeeklyPlan = {
            ...fresh,
            sessions: [
              ...(old?.sessions.filter((x) => x.date < date || done.has(x.date)) ?? []),
              ...fresh.sessions.filter((x) => x.date >= date && !done.has(x.date)),
            ].sort((a, b) => a.dayIndex - b.dayIndex),
          };
          write((st) => ({ plans: [...st.plans.filter((p) => p.weekStart !== weekStart), merged] }));
        },

        acceptInsight: (insight) => {
          const s = get();
          const adjustments = applyAdjustment(s.adjustments, insight, todayISO());
          write({ adjustments, dismissedInsights: [...s.dismissedInsights, insight.id].slice(-200) });
          const a = insight.adjustment;
          if (a && (a.volumeModifier !== undefined || a.sessionReduction !== undefined)) get().regenerateCurrentPlan();
        },

        dismissInsight: (id) => write((s) => ({ dismissedInsights: [...s.dismissedInsights, id].slice(-200) })),

        updateReminder: (id, patch) =>
          write((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

        snoozeReminderSuggestion: (id, until) =>
          write((s) => ({
            reminderStats: {
              ...s.reminderStats,
              [id]: { ...(s.reminderStats[id] ?? { scheduled: [], acted: [], actualTimes: [] }), snoozedUntil: until },
            },
          })),

        markReminderScheduled: (items) =>
          write((s) => {
            const stats = { ...s.reminderStats };
            for (const { kind, date } of items) {
              const cur = stats[kind] ?? { scheduled: [], acted: [], actualTimes: [] };
              if (!cur.scheduled.includes(date)) stats[kind] = { ...cur, scheduled: [...cur.scheduled, date].slice(-30) };
            }
            return { reminderStats: stats };
          }),

        addCustomFood: (f) => write((s) => ({ customFoods: upsertBy(s.customFoods, f, (x) => x.id) })),
        addCustomRecipe: (r) => write((s) => ({ customRecipes: upsertBy(s.customRecipes, r, (x) => x.id) })),
        toggleFavorite: (foodId) =>
          write((s) => ({
            favoriteFoodIds: s.favoriteFoodIds.includes(foodId)
              ? s.favoriteFoodIds.filter((x) => x !== foodId)
              : [...s.favoriteFoodIds, foodId],
          })),

        importState: (incoming) => write({ ...initialState(), ...incoming }),
        reset: () => write(initialState()),
      };
    },
    {
      name: 'kalyav-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, ...rest }) =>
        Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<Store>,
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

/** État de domaine sérialisable (sans les actions). */
export function snapshotState(s: Store): AppState {
  return {
    profile: s.profile,
    weights: s.weights,
    measurements: s.measurements,
    foodLog: s.foodLog,
    morningCheckIns: s.morningCheckIns,
    eveningCheckIns: s.eveningCheckIns,
    activity: s.activity,
    workouts: s.workouts,
    plans: s.plans,
    reviews: s.reviews,
    adjustments: s.adjustments,
    reminders: s.reminders,
    reminderStats: s.reminderStats,
    customFoods: s.customFoods,
    customRecipes: s.customRecipes,
    favoriteFoodIds: s.favoriteFoodIds,
    dismissedInsights: s.dismissedInsights,
  };
}
