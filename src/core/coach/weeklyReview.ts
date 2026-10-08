import type { AppState, ISODate, WeeklyPlan, WeeklyReview } from '../types';
import { addDays, dateRange, startOfWeek, weekdayIndex } from '../utils/date';
import { mean } from '../utils/stats';
import { analyze } from './analysis';
import { evaluateRules, decayAdjustments } from './adaptationEngine';
import { generateWeeklyPlan } from '../training/programGenerator';

export function buildWeeklyReview(state: AppState, weekStart: ISODate): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);
  const days = dateRange(weekStart, weekEnd);
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;

  const weights = state.weights.filter((w) => inWeek(w.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  // poids initial : dernier poids connu avant la semaine si disponible
  const before = state.weights.filter((w) => w.date < weekStart).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  const startWeight = before?.kg ?? weights[0]?.kg;
  const endWeight = weights[weights.length - 1]?.kg;

  const plan = state.plans.find((p) => p.weekStart === weekStart);
  const workoutsPlanned = plan?.sessions.filter((s) => s.type !== 'recovery').length ?? 0;
  const workoutsDone = state.workouts.filter((w) => inWeek(w.date) && w.completed).length;

  const dayTotals = days
    .map((d) => {
      const entries = state.foodLog.filter((f) => f.date === d);
      return entries.length
        ? { kcal: entries.reduce((a, f) => a + f.kcal, 0), protein: entries.reduce((a, f) => a + f.protein, 0) }
        : null;
    })
    .filter((x): x is { kcal: number; protein: number } => !!x && x.kcal > 300);

  const checks = state.morningCheckIns.filter((c) => inWeek(c.date));
  const steps = state.activity.filter((a) => inWeek(a.date) && a.steps > 0).map((a) => a.steps);

  const review: WeeklyReview = {
    weekStart,
    weekEnd,
    startWeight,
    endWeight,
    weightChange: startWeight !== undefined && endWeight !== undefined ? Math.round((endWeight - startWeight) * 10) / 10 : undefined,
    workoutsDone,
    workoutsPlanned,
    avgKcal: mean(dayTotals.map((d) => d.kcal)),
    avgProtein: mean(dayTotals.map((d) => d.protein)),
    nutritionDaysLogged: dayTotals.length,
    avgSleep: mean(checks.map((c) => c.sleepHours)),
    avgSteps: mean(steps),
    checkIns: checks.length + state.eveningCheckIns.filter((c) => inWeek(c.date)).length,
    positives: [],
    weaknesses: [],
    recommendations: [],
    createdAt: new Date().toISOString(),
  };

  // ——— Points positifs / faibles : on valorise d'abord les habitudes ———
  const a = analyze(state, addDays(weekEnd, 1));
  if (workoutsPlanned && workoutsDone >= workoutsPlanned) review.positives.push(`Toutes tes séances réalisées (${workoutsDone}/${workoutsPlanned}).`);
  else if (workoutsDone > 0) review.positives.push(`${workoutsDone} séance${workoutsDone > 1 ? 's' : ''} réalisée${workoutsDone > 1 ? 's' : ''}.`);
  if (dayTotals.length >= 5) review.positives.push(`Alimentation suivie ${dayTotals.length} jours sur 7.`);
  if (review.avgProtein && review.avgProtein >= a.targets.protein * 0.9) review.positives.push('Objectif protéines tenu en moyenne.');
  if (review.avgSleep && review.avgSleep >= 7) review.positives.push(`Bon sommeil : ${review.avgSleep.toFixed(1).replace('.', ',')} h en moyenne.`);
  if (review.avgSteps && review.avgSteps >= a.targets.steps) review.positives.push('Objectif de pas atteint en moyenne.');
  if (checks.length >= 6) review.positives.push('Check-ins quasi quotidiens : bravo pour la régularité.');

  if (workoutsPlanned && workoutsDone < workoutsPlanned * 0.6) review.weaknesses.push(`Séances : ${workoutsDone}/${workoutsPlanned}.`);
  if (dayTotals.length < 4) review.weaknesses.push('Suivi alimentaire irrégulier : difficile d’ajuster précisément.');
  if (review.avgProtein && review.avgProtein < a.targets.protein * 0.8) review.weaknesses.push('Protéines en dessous de l’objectif.');
  if (review.avgSleep && review.avgSleep < 6.5) review.weaknesses.push('Sommeil court.');
  if (review.avgSteps && review.avgSteps < a.targets.steps * 0.7) review.weaknesses.push('Activité quotidienne faible.');

  if (!review.positives.length) review.positives.push('Tu es toujours là, et c’est ce qui compte : chaque semaine est un nouveau départ.');

  const insights = evaluateRules({ ...state, dismissedInsights: [] }, a);
  review.recommendations = insights.slice(0, 3).map((i) => `${i.title} — ${i.actions[0] ?? i.message}`);
  if (!review.recommendations.length) review.recommendations.push('Garde le même plan : il fonctionne. Petite progression des charges si les séances sont faciles.');
  return review;
}

/**
 * Routine du dimanche (ou au premier lancement de la semaine) : bilan de
 * la semaine écoulée puis génération du programme suivant.
 */
export function weeklyRollover(state: AppState, today: ISODate): { review?: WeeklyReview; plan?: WeeklyPlan; adjustments: AppState['adjustments'] } {
  const thisWeek = startOfWeek(today);
  const isSunday = weekdayIndex(today) === 6;
  const reviewWeek = isSunday ? thisWeek : addDays(thisWeek, -7);
  const nextPlanWeek = isSunday ? addDays(thisWeek, 7) : thisWeek;

  let adjustments = state.adjustments;
  let review: WeeklyReview | undefined;
  const createdAfter = state.profile ? state.profile.createdAt.slice(0, 10) <= addDays(reviewWeek, 6) : false;
  if (createdAfter && !state.reviews.some((r) => r.weekStart === reviewWeek)) {
    review = buildWeeklyReview(state, reviewWeek);
  }
  let plan: WeeklyPlan | undefined;
  if (state.profile && !state.plans.some((p) => p.weekStart === nextPlanWeek)) {
    if (review) adjustments = decayAdjustments(adjustments);
    const rationale: string[] = [];
    if (adjustments.volumeModifier < 0.95) rationale.push('Volume réduit temporairement pour favoriser la récupération.');
    if (adjustments.volumeModifier > 1.05) rationale.push('Volume en hausse : tu as bien encaissé les dernières semaines.');
    if (adjustments.sessionReduction > 0) rationale.push('Une séance en moins temporairement pour retrouver de la régularité.');
    plan = generateWeeklyPlan(state.profile, nextPlanWeek, {
      volumeModifier: adjustments.volumeModifier,
      sessionReduction: adjustments.sessionReduction,
      rationale,
    });
  }
  return { review, plan, adjustments };
}
