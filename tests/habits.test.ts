import { describe, expect, it } from 'vitest';
import { badges, currentStreak, levelFromXp, weeklyGoals } from '../src/core/gamification/progression';
import { planNotifications, recordAction, recordScheduled, reminderSuggestions, MAX_PER_DAY } from '../src/core/reminders/scheduler';
import { computeTargets } from '../src/core/nutrition/calculator';
import { generateWeeklyPlan } from '../src/core/training/programGenerator';
import { addDays, dateRange } from '../src/core/utils/date';
import type { ReminderStats } from '../src/core/types';
import { makeProfile, makeState } from './fixtures';

const TODAY = '2026-10-07';
const targets = computeTargets(makeProfile());

describe('progression et séries', () => {
  it('compte la série de jours engagés sans casser la journée en cours', () => {
    const morningCheckIns = dateRange(addDays(TODAY, -6), addDays(TODAY, -1)).map((date) => ({
      date, sleepHours: 7, sleepQuality: 4, energy: 7, fatigue: 3, motivation: 7, pain: null, createdAt: date,
    }));
    const state = makeState({ morningCheckIns });
    expect(currentStreak(state, targets, TODAY)).toBe(6);
  });

  it('les niveaux progressent avec l’XP', () => {
    expect(levelFromXp(0).name).toBe('Départ');
    expect(levelFromXp(5000).index).toBeGreaterThan(4);
  });

  it('aucun badge ne récompense la perte de poids seule', () => {
    const list = badges(makeState(), targets, TODAY);
    expect(list.some((b) => /poids|kg|maigr/i.test(b.title + b.description))).toBe(false);
  });

  it('objectifs hebdomadaires basés sur les habitudes', () => {
    const goals = weeklyGoals(makeState(), targets, TODAY);
    expect(goals.map((g) => g.id)).toEqual(['workouts', 'checkins', 'nutrition', 'steps']);
  });
});

describe('rappels intelligents', () => {
  it('ne rappelle pas une action déjà faite ni l’entraînement un jour de repos', () => {
    const profile = makeProfile({ availableDays: [0], sessionsPerWeek: 1 }); // séance le lundi uniquement
    const state = makeState({
      profile,
      plans: [generateWeeklyPlan(profile, '2026-10-05')],
      activity: [{ date: TODAY, steps: 0, waterMl: 1500 }],
    });
    const list = planNotifications(state, new Date(2026, 9, 7, 6, 0));
    const todays = list.filter((n) => n.id.endsWith(TODAY));
    expect(todays.some((n) => n.kind === 'water')).toBe(false);
    expect(todays.some((n) => n.kind === 'training')).toBe(false);
    expect(todays.length).toBeLessThanOrEqual(MAX_PER_DAY);
  });

  it('propose de déplacer un rappel régulièrement ignoré', () => {
    let stats: ReminderStats | undefined;
    for (const d of dateRange(addDays(TODAY, -8), addDays(TODAY, -1))) stats = recordScheduled(stats, d);
    // l'utilisateur boit plutôt vers 15 h, pas à 10 h
    for (let k = 0; k < 3; k++) stats = { ...stats!, actualTimes: [...stats!.actualTimes, '15:10'] };
    const state = makeState({ reminderStats: { water: stats } });
    const s = reminderSuggestions(state, TODAY);
    expect(s[0]?.kind).toBe('water');
    expect(s[0]?.suggestedTime).toBe('15:00');
  });

  it('un rappel suivi d’effet n’est pas remis en question', () => {
    let stats: ReminderStats | undefined;
    for (const d of dateRange(addDays(TODAY, -8), addDays(TODAY, -1))) {
      stats = recordScheduled(stats, d);
      stats = recordAction(stats, d, '10:40');
    }
    expect(reminderSuggestions(makeState({ reminderStats: { water: stats } }), TODAY)).toHaveLength(0);
  });
});
