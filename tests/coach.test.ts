import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/coach/analysis';
import { applyAdjustment, defaultAdjustments, evaluateRules, LIMITS } from '../src/core/coach/adaptationEngine';
import { trainingClearance, validateTargetWeight } from '../src/core/coach/safety';
import { buildWeeklyReview, weeklyRollover } from '../src/core/coach/weeklyReview';
import { dailyBriefing } from '../src/core/coach/briefing';
import { dailySnapshot } from '../src/core/dashboard/daily';
import { coachReply } from '../src/core/coach/chat';
import { generateWeeklyPlan } from '../src/core/training/programGenerator';
import { addDays, dateRange } from '../src/core/utils/date';
import type { FoodLogEntry, MorningCheckIn, WorkoutLog } from '../src/core/types';
import { makeProfile, makeState } from './fixtures';

const TODAY = '2026-10-07';

const food = (date: string, kcal: number, protein: number): FoodLogEntry => ({
  id: `${date}-${kcal}`,
  date,
  slot: 'lunch',
  name: 'Repas',
  quantityLabel: '1',
  kcal,
  protein,
  carbs: 100,
  fat: 30,
  fiber: 10,
  createdAt: date,
});

const morning = (date: string, over: Partial<MorningCheckIn> = {}): MorningCheckIn => ({
  date,
  sleepHours: 7.5,
  sleepQuality: 4,
  energy: 7,
  fatigue: 3,
  motivation: 7,
  pain: null,
  createdAt: date,
  ...over,
});

const workout = (date: string, rpe = 7): WorkoutLog => ({
  id: date,
  date,
  title: 'Full body',
  sessionType: 'full_body',
  durationMin: 45,
  kcal: 300,
  rpe,
  completed: true,
  fatigueMode: false,
  exercises: [],
  createdAt: date,
});

describe('analyse des tendances', () => {
  it('détecte un plateau de poids sur 14 jours', () => {
    const days = dateRange(addDays(TODAY, -15), TODAY);
    const weights = days.map((d, i) => ({ date: d, kg: 82 + (i % 2 ? 0.2 : -0.2) }));
    const a = analyze(makeState({ weights }), TODAY);
    expect(a.weight.plateauDays).toBeGreaterThanOrEqual(14);
  });

  it('mesure une perte trop rapide', () => {
    const weights = dateRange(addDays(TODAY, -14), TODAY).map((d, i) => ({ date: d, kg: 85 - i * 0.2 }));
    const a = analyze(makeState({ weights }), TODAY);
    expect(a.weight.weeklyRatePct!).toBeLessThan(-1);
  });
});

describe('moteur d’adaptation', () => {
  it('plateau + faible régularité → vérifier la régularité avant de baisser les calories', () => {
    const days = dateRange(addDays(TODAY, -15), TODAY);
    const weights = days.map((d) => ({ date: d, kg: 82 }));
    const state = makeState({ weights });
    const rules = evaluateRules(state, analyze(state, TODAY));
    const plateau = rules.find((r) => r.ruleId.startsWith('plateau'));
    expect(plateau?.ruleId).toBe('plateau_check');
    expect(plateau?.adjustment).toBeUndefined();
    expect(plateau?.title).toContain('stagne');
  });

  it('perte trop rapide → augmenter légèrement les apports', () => {
    const weights = dateRange(addDays(TODAY, -14), TODAY).map((d, i) => ({ date: d, kg: 85 - i * 0.2 }));
    const state = makeState({ weights });
    const rule = evaluateRules(state, analyze(state, TODAY)).find((r) => r.ruleId === 'fast_loss');
    expect(rule?.adjustment?.kcalDelta).toBeGreaterThan(0);
  });

  it('protéines basses → trois options simples', () => {
    const foodLog = dateRange(addDays(TODAY, -7), addDays(TODAY, -1)).map((d) => food(d, 2100, 90));
    const state = makeState({ foodLog });
    const rule = evaluateRules(state, analyze(state, TODAY)).find((r) => r.ruleId === 'protein_low');
    expect(rule).toBeDefined();
    expect(rule!.actions).toHaveLength(3);
  });

  it('séances manquées → programme temporairement plus léger', () => {
    const profile = makeProfile();
    const plans = [generateWeeklyPlan(profile, '2026-09-21'), generateWeeklyPlan(profile, '2026-09-28'), generateWeeklyPlan(profile, '2026-10-05')];
    const state = makeState({ plans, workouts: [workout('2026-09-29')] });
    const rule = evaluateRules(state, analyze(state, TODAY)).find((r) => r.ruleId === 'missed_sessions');
    expect(rule?.adjustment?.sessionReduction).toBe(1);
  });

  it('3 séances en 4 jours → récupération active', () => {
    const state = makeState({ workouts: [workout('2026-10-05'), workout('2026-10-06'), workout(TODAY)] });
    const rule = evaluateRules(state, analyze(state, TODAY)).find((r) => r.ruleId === 'active_recovery');
    expect(rule?.title).toContain('3 séances');
  });

  it('fatigue + RPE élevé → semaine de récupération', () => {
    const state = makeState({
      morningCheckIns: dateRange(addDays(TODAY, -4), TODAY).map((d) => morning(d, { fatigue: 8, sleepHours: 5.5 })),
      workouts: [workout('2026-09-30', 9), workout('2026-10-02', 9)],
    });
    const rule = evaluateRules(state, analyze(state, TODAY)).find((r) => r.ruleId === 'deload');
    expect(rule?.adjustment?.volumeModifier).toBe(0.7);
  });

  it('les ajustements restent bornés', () => {
    let adj = defaultAdjustments();
    const insight = { id: 'x', ruleId: 'x', category: 'nutrition' as const, priority: 1, tone: 'neutral' as const, title: '', message: '', reason: '', actions: [], adjustment: { kcalDelta: -200 } };
    for (let i = 0; i < 5; i++) adj = applyAdjustment(adj, insight, TODAY);
    expect(adj.kcalDelta).toBe(LIMITS.kcalDelta.min);
  });

  it('les conseils déjà traités ne réapparaissent pas', () => {
    const state = makeState({ workouts: [workout('2026-10-05'), workout('2026-10-06'), workout(TODAY)] });
    const first = evaluateRules(state, analyze(state, TODAY));
    const again = evaluateRules({ ...state, dismissedInsights: first.map((i) => i.id) }, analyze(state, TODAY));
    expect(again).toHaveLength(0);
  });
});

describe('sécurité', () => {
  it('douleur forte → repos et avis professionnel', () => {
    const d = trainingClearance(morning(TODAY, { pain: { area: 'knee', intensity: 8 } }));
    expect(d.clearance).toBe('rest');
    expect(d.seeProfessional).toBe(true);
  });

  it('symptôme inquiétant → message d’urgence', () => {
    const d = trainingClearance(morning(TODAY, { pain: { area: 'chest', intensity: 3, alarming: true } }));
    expect(d.clearance).toBe('rest');
    expect(d.messages.join(' ')).toContain('15');
  });

  it('fatigue → séance allégée ou récupération', () => {
    expect(trainingClearance(morning(TODAY, { fatigue: 6 })).clearance).toBe('lighter');
    expect(trainingClearance(morning(TODAY, { fatigue: 9 })).clearance).toBe('recovery');
  });

  it('refuse un poids cible sous un IMC de 18,5', () => {
    expect(validateTargetWeight(170, 50)).not.toBeNull();
    expect(validateTargetWeight(170, 65)).toBeNull();
  });

  it('le coach réagit à une douleur thoracique par un message d’urgence', () => {
    const state = makeState();
    const a = analyze(state, TODAY);
    expect(coachReply('J’ai une douleur dans la poitrine', state, a, [])).toContain('112');
  });
});

describe('briefing quotidien et bilan', () => {
  it('adapte automatiquement la séance après un check-in fatigué', () => {
    const profile = makeProfile({ availableDays: [0, 1, 2, 3, 4, 5, 6], sessionsPerWeek: 6 });
    const plan = generateWeeklyPlan(profile, '2026-10-05');
    const state = makeState({ profile, plans: [plan], morningCheckIns: [morning(TODAY, { fatigue: 9 })] });
    const a = analyze(state, TODAY);
    const snap = dailySnapshot(state, TODAY, a.targets);
    expect(snap.session).toBeDefined();
    const b = dailyBriefing(state, a, snap, new Date(2026, 9, 7, 9));
    expect(b.session?.type).toBe('recovery');
    expect(b.nextAction).toBeDefined();
  });

  it('génère le bilan hebdomadaire et le programme suivant le dimanche', () => {
    const profile = makeProfile();
    const plan = generateWeeklyPlan(profile, '2026-09-28');
    const state = makeState({
      profile,
      plans: [plan],
      weights: [
        { date: '2026-09-27', kg: 85 },
        { date: '2026-10-04', kg: 84.4 },
      ],
      workouts: plan.sessions.map((s) => workout(s.date)),
      foodLog: dateRange('2026-09-28', '2026-10-04').map((d) => food(d, 2100, 160)),
    });
    const review = buildWeeklyReview(state, '2026-09-28');
    expect(review.weightChange).toBe(-0.6);
    expect(review.workoutsDone).toBe(review.workoutsPlanned);
    expect(review.positives.length).toBeGreaterThan(0);
    const roll = weeklyRollover(state, '2026-10-04');
    expect(roll.review?.weekStart).toBe('2026-09-28');
    expect(roll.plan?.weekStart).toBe('2026-10-05');
  });
});
