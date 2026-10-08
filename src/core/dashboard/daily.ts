import type { AppState, ISODate, Macros, MorningCheckIn, NutritionTargets, PlannedSession, WorkoutLog } from '../types';
import { addMacros, emptyMacros } from '../nutrition/calculator';
import { clamp, mean } from '../utils/stats';
import { sessionForDate } from '../training/programGenerator';
import { startOfWeek } from '../utils/date';

export interface DailySnapshot {
  date: ISODate;
  consumed: Macros;
  waterMl: number;
  steps: number;
  session?: PlannedSession;
  workout?: WorkoutLog;
  burnedKcal: number;
  sleepHours?: number;
  weightKg?: number;
  morning?: MorningCheckIn;
  eveningDone: boolean;
  scores: {
    global: number;
    nutrition: number;
    training: number;
    hydration: number;
    sleep: number;
    steps: number;
  };
}

export function consumedOn(state: AppState, date: ISODate): Macros {
  return state.foodLog.filter((f) => f.date === date).reduce((acc, f) => addMacros(acc, f), emptyMacros());
}

/** Score nutrition : proximité calorique + couverture protéique. */
export function nutritionScore(consumed: Macros, t: NutritionTargets): number {
  if (consumed.kcal === 0) return 0;
  const kcalRatio = consumed.kcal / t.kcal;
  // 100 % entre 90 et 105 % de l'objectif, décroît au-delà ou en deçà
  const kcalScore = kcalRatio < 0.9 ? kcalRatio / 0.9 : kcalRatio <= 1.05 ? 1 : clamp(1 - (kcalRatio - 1.05) * 2.5, 0, 1);
  const protScore = clamp(consumed.protein / t.protein, 0, 1);
  return Math.round((kcalScore * 0.5 + protScore * 0.5) * 100);
}

export function dailySnapshot(state: AppState, date: ISODate, targets: NutritionTargets): DailySnapshot {
  const consumed = consumedOn(state, date);
  const act = state.activity.find((a) => a.date === date);
  const plan = state.plans.find((p) => p.weekStart === startOfWeek(date));
  const session = sessionForDate(plan, date);
  const workout = state.workouts.find((w) => w.date === date);
  const morning = state.morningCheckIns.find((c) => c.date === date);
  const weight = state.weights.find((w) => w.date === date)?.kg;
  const waterMl = act?.waterMl ?? 0;
  const steps = act?.steps ?? 0;

  const nutrition = nutritionScore(consumed, targets);
  const training = workout ? (workout.completed ? 100 : 60) : session ? 0 : 100; // jour de repos = objectif atteint
  const hydration = Math.round(clamp(waterMl / targets.waterMl, 0, 1) * 100);
  const sleep = morning ? Math.round(clamp(morning.sleepHours / targets.sleepHours, 0, 1) * 100) : 0;
  const stepsScore = Math.round(clamp(steps / targets.steps, 0, 1) * 100);
  // moyenne pondérée (somme des poids = 5) : nutrition et sport comptent davantage
  const weights = [1.3, 1.2, 0.8, 0.9, 0.8];
  const global = Math.round(mean([nutrition, training, hydration, sleep, stepsScore].map((v, i) => v * weights[i]))!);

  return {
    date,
    consumed,
    waterMl,
    steps,
    session,
    workout,
    burnedKcal: workout?.kcal ?? 0,
    sleepHours: morning?.sleepHours,
    weightKg: weight,
    morning,
    eveningDone: state.eveningCheckIns.some((c) => c.date === date),
    scores: { global: clamp(global, 0, 100), nutrition, training, hydration, sleep, steps: stepsScore },
  };
}
