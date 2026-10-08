import type { ActivityLevel, Goal, Macros, NutritionTargets, UserProfile } from '../types';
import { clamp, round } from '../utils/stats';
import { sleepDuration } from '../utils/date';

/** Facteurs d'activité hors séances (métier, déplacements). */
const DAILY_ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.35,
  moderate: 1.5,
  active: 1.65,
  very_active: 1.8,
};

const BASE_STEPS: Record<ActivityLevel, number> = {
  sedentary: 6000,
  light: 7500,
  moderate: 8500,
  active: 10000,
  very_active: 12000,
};

/** Ajustement calorique par objectif, en proportion de la dépense, puis borné. */
const GOAL_ADJUSTMENT: Record<Goal, { pct: number; min: number; max: number }> = {
  fat_loss: { pct: -0.18, min: -550, max: -250 },
  muscle_gain: { pct: 0.08, min: 150, max: 300 },
  recomposition: { pct: -0.08, min: -300, max: -100 },
  endurance: { pct: 0, min: 0, max: 0 },
  cardio: { pct: 0, min: 0, max: 0 },
  strength: { pct: 0.05, min: 100, max: 250 },
  mobility: { pct: 0, min: 0, max: 0 },
  general_fitness: { pct: 0, min: 0, max: 0 },
};

/** g de protéines par kg (poids de référence). */
const PROTEIN_PER_KG: Record<Goal, number> = {
  fat_loss: 2.0,
  muscle_gain: 1.8,
  recomposition: 2.0,
  endurance: 1.5,
  cardio: 1.5,
  strength: 1.8,
  mobility: 1.4,
  general_fitness: 1.6,
};

/** Plancher absolu de sécurité : jamais de régime extrêmement restrictif. */
export const ABSOLUTE_FLOOR = { male: 1500, female: 1200 } as const;

export function bmrMifflin(p: Pick<UserProfile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

/** Dépense moyenne par séance (kcal), lissée sur la semaine. */
export function trainingKcalPerDay(p: Pick<UserProfile, 'sessionsPerWeek' | 'sessionMinutes' | 'weightKg'>): number {
  // MET moyen d'une séance mixte ≈ 6
  const perSession = (6 * p.weightKg * p.sessionMinutes) / 60;
  return (perSession * p.sessionsPerWeek) / 7;
}

export function bmi(p: Pick<UserProfile, 'weightKg' | 'heightCm'>): number {
  const m = p.heightCm / 100;
  return p.weightKg / (m * m);
}

/**
 * Poids de référence pour les protéines : en cas d'IMC élevé on utilise
 * un poids ajusté pour éviter des objectifs protéiques irréalistes.
 */
export function referenceWeight(p: Pick<UserProfile, 'weightKg' | 'heightCm'>): number {
  const b = bmi(p);
  if (b <= 28) return p.weightKg;
  const m = p.heightCm / 100;
  const weightAt25 = 25 * m * m;
  return weightAt25 + 0.4 * (p.weightKg - weightAt25);
}

export interface TargetAdjustments {
  kcalDelta?: number;
  stepsDelta?: number;
}

export function computeTargets(p: UserProfile, adj: TargetAdjustments = {}): NutritionTargets {
  const notes: string[] = [];
  const bmr = bmrMifflin(p);
  const tdee = bmr * DAILY_ACTIVITY_FACTOR[p.activityLevel] + trainingKcalPerDay(p);
  const rule = GOAL_ADJUSTMENT[p.goal];
  let goalDelta = clamp(tdee * rule.pct, Math.min(rule.min, rule.max), Math.max(rule.min, rule.max));
  if (rule.pct === 0) goalDelta = 0;

  // Si l'objectif de poids est déjà atteint, on ne maintient pas un déficit.
  if ((p.goal === 'fat_loss' || p.goal === 'recomposition') && p.weightKg <= p.targetWeightKg) {
    goalDelta = 0;
    notes.push('Poids cible atteint : on passe en maintien pour consolider.');
  }

  const floor = Math.max(ABSOLUTE_FLOOR[p.sex], round(bmr, 10));
  let kcal = tdee + goalDelta + (adj.kcalDelta ?? 0);

  // Limite de vitesse de perte : déficit ≤ ~1 % du poids / semaine (7700 kcal/kg).
  const maxDailyDeficit = (p.weightKg * 0.01 * 7700) / 7;
  if (tdee - kcal > maxDailyDeficit) {
    kcal = tdee - maxDailyDeficit;
    notes.push('Déficit limité pour ne pas dépasser ~1 % de ton poids perdu par semaine.');
  }
  if (kcal < floor) {
    kcal = floor;
    notes.push(`Apport maintenu au-dessus de ${floor} kcal : on ne descend jamais sous ton métabolisme de base.`);
  }
  kcal = round(kcal, 10);

  const refW = referenceWeight(p);
  let protein = round(refW * PROTEIN_PER_KG[p.goal]);
  let fat = round(Math.max(refW * 0.8, (kcal * 0.25) / 9));
  // garde au moins ~30 % de l'énergie pour les glucides si possible
  let carbs = round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < (kcal * 0.3) / 4) {
    fat = round(Math.max(refW * 0.6, (kcal * 0.2) / 9));
    carbs = round((kcal - protein * 4 - fat * 9) / 4);
  }
  if (carbs < 50) {
    protein = round(refW * 1.6);
    carbs = round((kcal - protein * 4 - fat * 9) / 4);
  }
  const fiber = round(clamp((kcal / 1000) * 14, 25, 40));

  const waterMl = round(clamp(p.weightKg * 33 + (p.sessionsPerWeek >= 4 ? 500 : 300), 1800, 4000), 50);
  const steps = round(clamp(BASE_STEPS[p.activityLevel] + (adj.stepsDelta ?? 0), 4000, 15000), 500);
  const sleepHours = clamp(round(sleepDuration(p.bedtime, p.wakeTime) * 2) / 2, 7, 9);

  notes.unshift(
    `Métabolisme de base ≈ ${round(bmr, 10)} kcal, dépense estimée ≈ ${round(tdee, 10)} kcal/jour.`,
    goalDelta === 0
      ? 'Calories au niveau de ta dépense : priorité performance et récupération.'
      : goalDelta < 0
        ? `Déficit modéré de ${Math.abs(round(goalDelta, 10))} kcal : perte progressive, sans frustration excessive.`
        : `Léger surplus de ${round(goalDelta, 10)} kcal : prise de muscle en limitant le gras.`,
  );
  if (adj.kcalDelta) {
    notes.push(`Ajustement du coach : ${adj.kcalDelta > 0 ? '+' : ''}${adj.kcalDelta} kcal selon tes tendances.`);
  }

  return {
    kcal,
    protein,
    carbs: Math.max(0, carbs),
    fat,
    fiber,
    waterMl,
    steps,
    sleepHours,
    notes,
    bmr: round(bmr),
    tdee: round(tdee),
    floorKcal: floor,
  };
}

export const emptyMacros = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
  };
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fat: Math.round(m.fat),
    fiber: Math.round(m.fiber),
  };
}

/** Estimation énergétique d'une activité par MET. */
export function kcalFromMet(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}
