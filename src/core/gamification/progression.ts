import type { AppState, ISODate, NutritionTargets } from '../types';
import { addDays, dateRange, startOfWeek } from '../utils/date';

/**
 * Système de progression : on récompense la RÉGULARITÉ et les HABITUDES,
 * jamais uniquement la perte de poids.
 */

export const XP = {
  morningCheckIn: 10,
  eveningCheckIn: 10,
  workout: 30,
  nutritionDay: 15,
  hydration: 8,
  steps: 8,
} as const;

const LEVELS = [
  'Départ',
  'Élan I',
  'Élan II',
  'Élan III',
  'Discipline I',
  'Discipline II',
  'Discipline III',
  'Constance I',
  'Constance II',
  'Constance III',
  'Maîtrise I',
  'Maîtrise II',
  'Maîtrise III',
  'Légende',
];

/** XP nécessaire pour atteindre le niveau n (progression douce). */
export const xpForLevel = (n: number) => Math.round(150 * n + 25 * n * n);

export interface LevelInfo {
  index: number;
  name: string;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let index = 0;
  while (index < LEVELS.length - 1 && xp >= xpForLevel(index + 1)) index++;
  const cur = xpForLevel(index);
  const next = xpForLevel(index + 1);
  return {
    index,
    name: LEVELS[index],
    xp,
    currentLevelXp: cur,
    nextLevelXp: next,
    progress: index === LEVELS.length - 1 ? 1 : (xp - cur) / (next - cur),
  };
}

function dayFlags(state: AppState, targets: NutritionTargets) {
  const days = new Map<ISODate, { morning: boolean; evening: boolean; workout: boolean; nutrition: boolean; water: boolean; steps: boolean }>();
  const get = (d: ISODate) => {
    if (!days.has(d)) days.set(d, { morning: false, evening: false, workout: false, nutrition: false, water: false, steps: false });
    return days.get(d)!;
  };
  state.morningCheckIns.forEach((c) => (get(c.date).morning = true));
  state.eveningCheckIns.forEach((c) => (get(c.date).evening = true));
  state.workouts.filter((w) => w.completed).forEach((w) => (get(w.date).workout = true));
  const kcalByDay = new Map<ISODate, number>();
  state.foodLog.forEach((f) => kcalByDay.set(f.date, (kcalByDay.get(f.date) ?? 0) + f.kcal));
  kcalByDay.forEach((k, d) => {
    if (k >= targets.kcal * 0.5) get(d).nutrition = true;
  });
  state.activity.forEach((a) => {
    if (a.waterMl >= targets.waterMl) get(a.date).water = true;
    if (a.steps >= targets.steps) get(a.date).steps = true;
  });
  return days;
}

export function totalXp(state: AppState, targets: NutritionTargets): number {
  let xp = 0;
  dayFlags(state, targets).forEach((f) => {
    if (f.morning) xp += XP.morningCheckIn;
    if (f.evening) xp += XP.eveningCheckIn;
    if (f.workout) xp += XP.workout;
    if (f.nutrition) xp += XP.nutritionDay;
    if (f.water) xp += XP.hydration;
    if (f.steps) xp += XP.steps;
  });
  return xp;
}

/**
 * Série : jours consécutifs avec au moins une action d'engagement
 * (check-in, séance ou journée alimentaire suivie). La journée en cours
 * ne casse pas la série tant qu'elle n'est pas terminée.
 */
export function currentStreak(state: AppState, targets: NutritionTargets, today: ISODate): number {
  const flags = dayFlags(state, targets);
  const engaged = (d: ISODate) => {
    const f = flags.get(d);
    return !!f && (f.morning || f.evening || f.workout || f.nutrition);
  };
  let d = engaged(today) ? today : addDays(today, -1);
  let n = 0;
  while (engaged(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(state: AppState, targets: NutritionTargets): number {
  const flags = dayFlags(state, targets);
  const dates = [...flags.entries()].filter(([, f]) => f.morning || f.evening || f.workout || f.nutrition).map(([d]) => d).sort();
  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface WeeklyGoal {
  id: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
}

export function weeklyGoals(state: AppState, targets: NutritionTargets, today: ISODate): WeeklyGoal[] {
  const start = startOfWeek(today);
  const days = dateRange(start, addDays(start, 6));
  const flags = dayFlags(state, targets);
  const plan = state.plans.find((p) => p.weekStart === start);
  const plannedWorkouts = plan?.sessions.length ?? state.profile?.sessionsPerWeek ?? 3;
  const workouts = state.workouts.filter((w) => w.completed && days.includes(w.date)).length;
  const checkIns = days.filter((d) => flags.get(d)?.morning).length;
  const nutrition = days.filter((d) => flags.get(d)?.nutrition).length;
  const steps = state.activity.filter((a) => days.includes(a.date)).reduce((s, a) => s + a.steps, 0);
  const stepsTarget = targets.steps * 7;
  const mk = (id: string, label: string, current: number, target: number): WeeklyGoal => ({
    id,
    label,
    current,
    target,
    done: current >= target,
  });
  return [
    mk('workouts', `${plannedWorkouts} entraînements`, workouts, plannedWorkouts),
    mk('checkins', '7 check-ins', checkIns, 7),
    mk('nutrition', '7 jours de suivi nutritionnel', nutrition, 7),
    mk('steps', `${stepsTarget.toLocaleString('fr-FR')} pas`, steps, stepsTarget),
  ];
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number;
}

export function badges(state: AppState, targets: NutritionTargets, today: ISODate): Badge[] {
  const flags = dayFlags(state, targets);
  const workouts = state.workouts.filter((w) => w.completed).length;
  const best = bestStreak(state, targets);
  const checkIns = state.morningCheckIns.length;
  const nutritionDays = [...flags.values()].filter((f) => f.nutrition).length;
  const waterDays = [...flags.values()].filter((f) => f.water).length;
  const recoveries = state.workouts.filter((w) => w.sessionType === 'recovery' || w.sessionType === 'mobility').length;
  const fatigueRespected = state.workouts.filter((w) => w.fatigueMode).length;
  // retour après une pause : séance après ≥ 5 jours sans activité
  const workoutDates = [...new Set(state.workouts.filter((w) => w.completed).map((w) => w.date))].sort();
  const comeback = workoutDates.some((d, i) => i > 0 && d > addDays(workoutDates[i - 1], 5));
  const weeksAllDone = state.plans.filter((p) => {
    if (p.weekStart >= startOfWeek(today)) return false;
    const end = addDays(p.weekStart, 6);
    const done = state.workouts.filter((w) => w.completed && w.date >= p.weekStart && w.date <= end).length;
    return p.sessions.length > 0 && done >= p.sessions.length;
  }).length;

  const mk = (id: string, emoji: string, title: string, description: string, value: number, target: number): Badge => ({
    id,
    emoji,
    title,
    description,
    earned: value >= target,
    progress: Math.min(value / target, 1),
  });

  return [
    mk('first_workout', '🎯', 'Premier pas', 'Terminer ta première séance', workouts, 1),
    mk('streak_7', '🔥', 'Semaine de feu', '7 jours de série', best, 7),
    mk('streak_30', '☄️', 'Inarrêtable', '30 jours de série', best, 30),
    mk('workouts_10', '💪', 'Dix sur dix', '10 séances terminées', workouts, 10),
    mk('workouts_50', '🏆', 'Athlète', '50 séances terminées', workouts, 50),
    mk('checkins_14', '☀️', 'Lève-tôt', '14 check-ins du matin', checkIns, 14),
    mk('nutrition_7', '🥗', 'Assiette maîtrisée', '7 jours de suivi alimentaire', nutritionDays, 7),
    mk('nutrition_30', '📒', 'Carnet d’or', '30 jours de suivi alimentaire', nutritionDays, 30),
    mk('hydration_7', '💧', 'Source vive', 'Objectif d’eau atteint 7 jours', waterDays, 7),
    mk('perfect_week', '⭐', 'Semaine parfaite', 'Toutes les séances d’une semaine', weeksAllDone, 1),
    mk('recovery', '🧘', 'Écoute ton corps', 'Faire 3 séances de récupération', recoveries + fatigueRespected, 3),
    mk('comeback', '🔁', 'Le retour', 'Reprendre après une pause', comeback ? 1 : 0, 1),
  ];
}
