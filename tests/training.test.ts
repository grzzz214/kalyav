import { describe, expect, it } from 'vitest';
import {
  adaptSessionForFatigue,
  chooseTrainingDays,
  generateWeeklyPlan,
  replaceExercise,
  toRecoverySession,
} from '../src/core/training/programGenerator';
import { EXERCISES, findAlternatives, getExercise } from '../src/core/training/exercises';
import { personalRecords, performanceTrend } from '../src/core/training/performance';
import type { Goal, WorkoutLog } from '../src/core/types';
import { makeProfile } from './fixtures';

const GOALS: Goal[] = ['fat_loss', 'muscle_gain', 'recomposition', 'endurance', 'cardio', 'strength', 'mobility', 'general_fitness'];

describe('générateur de programme', () => {
  it.each(GOALS)('génère un plan valide pour « %s »', (goal) => {
    for (const sessionsPerWeek of [1, 3, 5]) {
      const plan = generateWeeklyPlan(makeProfile({ goal, sessionsPerWeek }), '2026-10-05');
      expect(plan.sessions).toHaveLength(sessionsPerWeek);
      for (const s of plan.sessions) {
        expect(s.exercises.length).toBeGreaterThan(0);
        expect(s.durationMin).toBeLessThanOrEqual(45 * 1.1 + 1);
        expect(s.date >= '2026-10-05' && s.date <= '2026-10-11').toBe(true);
      }
    }
  });

  it('espace les séances sur les jours disponibles', () => {
    expect(chooseTrainingDays([0, 1, 2, 3, 4, 5, 6], 3)).toEqual([0, 2, 4]);
    expect(chooseTrainingDays([1, 3], 3)).toEqual([1, 3]);
  });

  it('exclut les exercices incompatibles avec les limitations', () => {
    const profile = makeProfile({ limitations: ['knee', 'no_jumping'], goal: 'fat_loss', sessionsPerWeek: 4 });
    const plan = generateWeeklyPlan(profile, '2026-10-05');
    for (const s of plan.sessions)
      for (const e of s.exercises) {
        const ex = getExercise(e.exerciseId);
        expect(ex.stress).not.toContain('knee');
        expect(ex.stress).not.toContain('no_jumping');
      }
  });

  it('remplace la haute intensité par du cardio doux en cas de limitation cardiaque', () => {
    const plan = generateWeeklyPlan(makeProfile({ goal: 'cardio', sessionsPerWeek: 4, limitations: ['cardiac'] }), '2026-10-05');
    expect(plan.sessions.some((s) => s.type === 'hiit' || s.type === 'intervals')).toBe(false);
  });

  it('respecte le matériel disponible', () => {
    const plan = generateWeeklyPlan(makeProfile({ equipment: [], goal: 'muscle_gain', sessionsPerWeek: 4 }), '2026-10-05');
    for (const s of plan.sessions) for (const e of s.exercises) expect(getExercise(e.exerciseId).equipment).toEqual([]);
  });

  it('réduit le volume quand la semaine est allégée', () => {
    const p = makeProfile({ goal: 'muscle_gain' });
    const normal = generateWeeklyPlan(p, '2026-10-05', { seed: 1 });
    const light = generateWeeklyPlan(p, '2026-10-05', { seed: 1, volumeModifier: 0.7, sessionReduction: 1 });
    expect(light.sessions.length).toBe(normal.sessions.length - 1);
    const sets = (pl: typeof normal) => pl.sessions[0].exercises.reduce((a, e) => a + e.sets, 0);
    expect(sets(light)).toBeLessThan(sets(normal));
  });
});

describe('adaptations de séance', () => {
  const profile = makeProfile({ goal: 'muscle_gain' });
  const session = generateWeeklyPlan(profile, '2026-10-05', { seed: 2 }).sessions[0];

  it('« Je suis fatigué » réduit le volume', () => {
    const light = adaptSessionForFatigue(session, profile, 'mild');
    const total = (s: typeof session) => s.exercises.reduce((a, e) => a + e.sets, 0);
    expect(total(light)).toBeLessThan(total(session));
    expect(light.adapted).toBe('fatigue');
  });

  it('fatigue forte → récupération active', () => {
    const rec = adaptSessionForFatigue(session, profile, 'high');
    expect(rec.type).toBe('recovery');
  });

  it('une douleur au genou exclut les exercices qui le sollicitent', () => {
    const rec = toRecoverySession(session, profile, 'pain', 'knee');
    for (const e of rec.exercises) expect(getExercise(e.exerciseId).stress).not.toContain('knee');
  });

  it('« Je ne peux pas faire cet exercice » propose des alternatives adaptées', () => {
    const ctx = { equipment: profile.equipment, limitations: [], level: profile.level };
    const pain = findAlternatives('push_up', 'pain', ctx);
    expect(pain.length).toBeGreaterThan(0);
    for (const a of pain) {
      expect(a.id).not.toBe('push_up');
      expect(a.stress).not.toContain('wrist');
      expect(a.stress).not.toContain('shoulder');
    }
    const equip = findAlternatives('db_row', 'equipment', ctx);
    for (const a of equip) expect(a.equipment).not.toContain('dumbbells');
    const hard = findAlternatives('pull_up', 'too_hard', { ...ctx, equipment: ['pullup_bar', 'bands'] });
    for (const a of hard) expect(a.level).toBeLessThanOrEqual(3);
    expect(hard.length).toBeGreaterThan(0);
  });

  it('chaque exercice a une démonstration et des muscles sollicités', () => {
    for (const e of EXERCISES) {
      expect(e.cues.length).toBeGreaterThan(0);
      expect(e.primary.length).toBeGreaterThan(0);
    }
  });

  it('remplacer un exercice conserve la prescription', () => {
    const swapped = replaceExercise(session, 0, 'goblet_squat');
    expect(swapped.exercises[0].exerciseId).toBe('goblet_squat');
    expect(swapped.exercises[0].swappedFrom).toBe(session.exercises[0].exerciseId);
  });
});

describe('performances', () => {
  const mk = (date: string, weight: number, reps: number): WorkoutLog => ({
    id: date,
    date,
    title: 'Full body',
    sessionType: 'full_body',
    durationMin: 45,
    kcal: 300,
    rpe: 7,
    completed: true,
    fatigueMode: false,
    exercises: [{ exerciseId: 'goblet_squat', sets: [{ reps, weightKg: weight, done: true }] }],
    createdAt: date,
  });

  it('détecte les records personnels', () => {
    const prs = personalRecords([mk('2026-09-01', 20, 10), mk('2026-09-08', 24, 8)]);
    const e1rm = prs.find((p) => p.kind === 'e1rm')!;
    expect(e1rm.value).toBeCloseTo(30.4, 1);
    expect(e1rm.date).toBe('2026-09-08');
  });

  it('détecte une baisse de performance', () => {
    const logs = [mk('2026-09-01', 30, 10), mk('2026-09-04', 28, 9), mk('2026-09-08', 26, 8), mk('2026-09-11', 24, 8)];
    expect(performanceTrend(logs)!).toBeLessThan(-0.03);
  });
});

describe('semaine de démarrage', () => {
  it('ne planifie aucune séance avant l’inscription', () => {
    const plan = generateWeeklyPlan(makeProfile({ sessionsPerWeek: 3 }), '2026-10-05', { startFrom: '2026-10-08' });
    expect(plan.sessions.length).toBeGreaterThan(0);
    for (const s of plan.sessions) expect(s.date >= '2026-10-08').toBe(true);
  });
});
