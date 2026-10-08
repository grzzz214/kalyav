import type { ISODate, WorkoutLog } from '../types';
import { findExercise } from './exercises';
import { linearSlope } from '../utils/stats';

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  kind: 'weight' | 'reps' | 'e1rm' | 'duration' | 'distance';
  value: number;
  unit: string;
  date: ISODate;
}

/** 1RM estimé (Epley), utilisé pour comparer des séries de reps différentes. */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export function personalRecords(workouts: WorkoutLog[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const consider = (r: PersonalRecord) => {
    const key = `${r.exerciseId}:${r.kind}`;
    const prev = best.get(key);
    if (!prev || r.value > prev.value) best.set(key, r);
  };
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const def = findExercise(ex.exerciseId);
      const name = def?.name ?? ex.exerciseId;
      for (const s of ex.sets) {
        if (!s.done) continue;
        if (s.weightKg && s.reps) {
          consider({ exerciseId: ex.exerciseId, name, kind: 'weight', value: s.weightKg, unit: 'kg', date: w.date });
          consider({ exerciseId: ex.exerciseId, name, kind: 'e1rm', value: Math.round(e1rm(s.weightKg, s.reps) * 10) / 10, unit: 'kg', date: w.date });
        } else if (s.reps) {
          consider({ exerciseId: ex.exerciseId, name, kind: 'reps', value: s.reps, unit: 'reps', date: w.date });
        }
        if (s.durationSec && def?.pattern !== 'mobility') {
          consider({ exerciseId: ex.exerciseId, name, kind: 'duration', value: s.durationSec, unit: 's', date: w.date });
        }
        if (s.distanceKm) consider({ exerciseId: ex.exerciseId, name, kind: 'distance', value: s.distanceKm, unit: 'km', date: w.date });
      }
    }
  }
  return [...best.values()]
    .filter((r) => r.kind !== 'weight') // e1rm suffit pour les charges, on garde l'affichage compact
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Meilleure performance par séance pour un exercice (pour les graphiques). */
export function exerciseHistory(workouts: WorkoutLog[], exerciseId: string): { date: ISODate; value: number }[] {
  const out: { date: ISODate; value: number }[] = [];
  for (const w of [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const values = ex.sets
      .filter((s) => s.done)
      .map((s) => (s.weightKg && s.reps ? e1rm(s.weightKg, s.reps) : s.reps ?? (s.durationSec ? s.durationSec : 0)));
    if (values.length) out.push({ date: w.date, value: Math.round(Math.max(...values) * 10) / 10 });
  }
  return out;
}

export function trackedExercises(workouts: WorkoutLog[]): string[] {
  const counts = new Map<string, number>();
  workouts.forEach((w) => w.exercises.forEach((e) => counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Volume total (kg × reps) d'une séance. */
export function workoutVolume(w: WorkoutLog): number {
  return w.exercises.reduce(
    (acc, e) => acc + e.sets.reduce((s, set) => s + (set.done && set.weightKg && set.reps ? set.weightKg * set.reps : 0), 0),
    0,
  );
}

/**
 * Tendance de performance : moyenne des pentes normalisées des exercices
 * suivis sur les dernières séances. Négatif = baisse.
 */
export function performanceTrend(workouts: WorkoutLog[], lastSessions = 4): number | undefined {
  const slopes: number[] = [];
  for (const id of trackedExercises(workouts).slice(0, 6)) {
    const h = exerciseHistory(workouts, id).slice(-lastSessions);
    if (h.length < 3) continue;
    const base = h[0].value || 1;
    const s = linearSlope(h.map((p, i) => ({ x: i, y: p.value / base })));
    if (s !== undefined) slopes.push(s);
  }
  if (!slopes.length) return undefined;
  return slopes.reduce((a, b) => a + b, 0) / slopes.length;
}
