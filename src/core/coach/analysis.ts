import type { AppState, Difficulty, ISODate, NutritionTargets, PainArea, WeightEntry } from '../types';
import { addDays, daysBetween, lastNDays } from '../utils/date';
import { ema, linearSlope, mean } from '../utils/stats';
import { computeTargets } from '../nutrition/calculator';
import { performanceTrend } from '../training/performance';

/**
 * Photographie des tendances de l'utilisateur. Le coach raisonne toujours
 * sur des fenêtres de plusieurs jours, jamais sur un seul point de donnée.
 */
export interface Analysis {
  today: ISODate;
  targets: NutritionTargets;
  weight: {
    current?: number;
    smoothed?: number;
    /** kg / semaine sur 14 jours */
    slope14?: number;
    slope28?: number;
    /** % du poids par semaine */
    weeklyRatePct?: number;
    /** nombre de jours de stagnation détectés (0 si aucune) */
    plateauDays: number;
    entries14: number;
    toGoalKg?: number;
  };
  nutrition: {
    daysLogged7: number;
    daysLogged14: number;
    avgKcal7?: number;
    avgProtein7?: number;
    proteinRatio7?: number;
    kcalRatio7?: number;
    lowProteinDays7: number;
    underFloorDays7: number;
  };
  training: {
    planned14: number;
    done14: number;
    completion14?: number;
    done7: number;
    planned7: number;
    avgRpe14?: number;
    consecutiveTrainingDays: number;
    sessionsLast4Days: number;
    daysSinceLastWorkout?: number;
    perfTrend?: number;
  };
  recovery: {
    avgSleep7?: number;
    avgFatigue5?: number;
    avgEnergy5?: number;
    avgMotivation5?: number;
    checkIns7: number;
  };
  activity: {
    avgSteps7?: number;
    avgWater7?: number;
    stepsDays7: number;
  };
  pain: {
    recent: { area: PainArea; intensity: number; date: ISODate; alarming?: boolean }[];
    maxIntensity: number;
    alarming: boolean;
    recurringArea?: PainArea;
  };
  difficulties: { kind: Difficulty; count: number }[];
  /** 0 – 1 : régularité globale (suivi nutrition, séances, check-ins) */
  adherence: number;
  /** jours complets d'historique depuis l'inscription */
  historyDays: number;
}

function weightSeries(state: AppState): WeightEntry[] {
  const map = new Map<string, number>();
  state.weights.forEach((w) => map.set(w.date, w.kg));
  return [...map.entries()].map(([date, kg]) => ({ date, kg })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function slopeOver(series: WeightEntry[], today: ISODate, days: number): { slope?: number; n: number; span: number } {
  const from = addDays(today, -days + 1);
  const pts = series.filter((w) => w.date >= from && w.date <= today);
  if (pts.length < 4) return { n: pts.length, span: 0 };
  const span = daysBetween(pts[0].date, pts[pts.length - 1].date);
  if (span < Math.min(7, days - 2)) return { n: pts.length, span };
  const s = linearSlope(pts.map((p) => ({ x: daysBetween(from, p.date), y: p.kg })));
  return { slope: s === undefined ? undefined : s * 7, n: pts.length, span };
}

export function analyze(state: AppState, today: ISODate): Analysis {
  const profile = state.profile!;
  const targets = computeTargets(
    { ...profile, weightKg: latestWeight(state) ?? profile.weightKg },
    { kcalDelta: state.adjustments.kcalDelta, stepsDelta: state.adjustments.stepsDelta },
  );

  // ——— Poids ———
  const series = weightSeries(state);
  const current = series.length ? series[series.length - 1].kg : profile.weightKg;
  const smoothed = series.length ? ema(series.map((s) => s.kg)).pop() : undefined;
  const s14 = slopeOver(series, today, 14);
  const s21 = slopeOver(series, today, 21);
  const s28 = slopeOver(series, today, 28);
  let plateauDays = 0;
  const flat = (s?: number) => s !== undefined && Math.abs(s) < 0.1;
  if (flat(s14.slope) && s14.span >= 12) plateauDays = 14;
  if (plateauDays && flat(s21.slope) && s21.span >= 18) plateauDays = 21;
  if (plateauDays === 21 && flat(s28.slope) && s28.span >= 25) plateauDays = 28;

  // ——— Nutrition ———
  const days7 = lastNDays(addDays(today, -1), 7); // journées terminées
  const days14 = lastNDays(addDays(today, -1), 14);
  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const f of state.foodLog) {
    const d = byDay.get(f.date) ?? { kcal: 0, protein: 0 };
    d.kcal += f.kcal;
    d.protein += f.protein;
    byDay.set(f.date, d);
  }
  // une journée compte comme suivie si au moins ~40 % des calories y sont notées
  const logged = (d: string) => (byDay.get(d)?.kcal ?? 0) >= targets.kcal * 0.4;
  const logged7 = days7.filter(logged);
  const logged14 = days14.filter(logged);
  const avgKcal7 = mean(logged7.map((d) => byDay.get(d)!.kcal));
  const avgProtein7 = mean(logged7.map((d) => byDay.get(d)!.protein));

  // ——— Entraînement ———
  const plannedIn = (from: ISODate, to: ISODate) =>
    state.plans.flatMap((p) => p.sessions).filter((s) => s.date >= from && s.date <= to && s.type !== 'recovery').length;
  const doneIn = (from: ISODate, to: ISODate) => state.workouts.filter((w) => w.date >= from && w.date <= to && w.completed);
  const yesterday = addDays(today, -1);
  const planned14 = plannedIn(addDays(today, -14), yesterday);
  const done14List = doneIn(addDays(today, -14), yesterday);
  const planned7 = plannedIn(addDays(today, -7), yesterday);
  const done7 = doneIn(addDays(today, -7), today).length;
  const workoutDays = new Set(state.workouts.filter((w) => w.completed).map((w) => w.date));
  let consecutive = 0;
  for (let d = workoutDays.has(today) ? today : yesterday; workoutDays.has(d); d = addDays(d, -1)) consecutive++;
  const lastWorkout = [...workoutDays].sort().pop();

  // ——— Récupération ———
  const recentChecks = state.morningCheckIns.filter((c) => c.date > addDays(today, -7) && c.date <= today);
  const last5 = state.morningCheckIns.filter((c) => c.date > addDays(today, -5) && c.date <= today);

  // ——— Activité ———
  const act7 = state.activity.filter((a) => days7.includes(a.date));
  const steps7 = act7.filter((a) => a.steps > 0);

  // ——— Douleurs ———
  const recentPain = state.morningCheckIns
    .filter((c) => c.pain && c.pain.intensity > 0 && c.date > addDays(today, -7))
    .map((c) => ({ ...c.pain!, date: c.date }));
  const areaCounts = new Map<PainArea, number>();
  recentPain.forEach((p) => areaCounts.set(p.area, (areaCounts.get(p.area) ?? 0) + 1));
  const recurring = [...areaCounts.entries()].find(([, n]) => n >= 3)?.[0];

  // ——— Difficultés ———
  const diffCounts = new Map<Difficulty, number>();
  state.eveningCheckIns
    .filter((c) => c.date > addDays(today, -14) && c.difficulty !== 'none')
    .forEach((c) => diffCounts.set(c.difficulty, (diffCounts.get(c.difficulty) ?? 0) + 1));

  const completion14 = planned14 ? Math.min(done14List.length / planned14, 1) : undefined;
  // la régularité se mesure sur l'historique réel : un nouvel inscrit n'est pas pénalisé
  const historyDays = Math.max(0, daysBetween(profile.createdAt.slice(0, 10), today));
  const span = Math.min(14, Math.max(1, historyDays));
  const checkIns14 = state.morningCheckIns.filter((c) => c.date > addDays(today, -14) && c.date < today).length;
  const adherenceParts = [Math.min(logged14.length / span, 1), completion14 ?? 0.7, Math.min(checkIns14 / span, 1)];

  return {
    today,
    targets,
    weight: {
      current,
      smoothed,
      slope14: s14.slope,
      slope28: s28.slope,
      weeklyRatePct: s14.slope !== undefined ? (s14.slope / current) * 100 : undefined,
      plateauDays,
      entries14: s14.n,
      toGoalKg: Math.round((profile.targetWeightKg - (smoothed ?? current)) * 10) / 10,
    },
    nutrition: {
      daysLogged7: logged7.length,
      daysLogged14: logged14.length,
      avgKcal7,
      avgProtein7,
      proteinRatio7: avgProtein7 !== undefined ? avgProtein7 / targets.protein : undefined,
      kcalRatio7: avgKcal7 !== undefined ? avgKcal7 / targets.kcal : undefined,
      lowProteinDays7: logged7.filter((d) => byDay.get(d)!.protein < targets.protein * 0.8).length,
      underFloorDays7: logged7.filter((d) => byDay.get(d)!.kcal < targets.floorKcal * 0.85).length,
    },
    training: {
      planned14,
      done14: done14List.length,
      completion14,
      done7,
      planned7,
      avgRpe14: mean(done14List.map((w) => w.rpe)),
      consecutiveTrainingDays: consecutive,
      sessionsLast4Days: doneIn(addDays(today, -3), today).length,
      daysSinceLastWorkout: lastWorkout ? daysBetween(lastWorkout, today) : undefined,
      perfTrend: performanceTrend(state.workouts),
    },
    recovery: {
      avgSleep7: mean(recentChecks.map((c) => c.sleepHours)),
      avgFatigue5: mean(last5.map((c) => c.fatigue)),
      avgEnergy5: mean(last5.map((c) => c.energy)),
      avgMotivation5: mean(last5.map((c) => c.motivation)),
      checkIns7: recentChecks.length,
    },
    activity: {
      avgSteps7: mean(steps7.map((a) => a.steps)),
      avgWater7: mean(act7.filter((a) => a.waterMl > 0).map((a) => a.waterMl)),
      stepsDays7: steps7.length,
    },
    pain: {
      recent: recentPain,
      maxIntensity: Math.max(0, ...recentPain.map((p) => p.intensity)),
      alarming: recentPain.some((p) => p.alarming && p.date >= addDays(today, -2)),
      recurringArea: recurring,
    },
    difficulties: [...diffCounts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    adherence: mean(adherenceParts) ?? 0,
    historyDays,
  };
}

export function latestWeight(state: AppState): number | undefined {
  if (!state.weights.length) return undefined;
  return [...state.weights].sort((a, b) => (a.date < b.date ? -1 : 1)).pop()!.kg;
}

export function isMorning(now: Date = new Date()) {
  return now.getHours() < 12;
}

export function dayOfData(state: AppState, today: ISODate): number {
  if (!state.profile) return 0;
  return daysBetween(state.profile.createdAt.slice(0, 10), today) + 1;
}

