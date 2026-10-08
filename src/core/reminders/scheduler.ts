import type { AppState, ISODate, ReminderConfig, ReminderKind, ReminderStats, UserProfile } from '../types';
import { addDays, formatTime, fromISODate, minutesOfDay, shiftTime, startOfWeek } from '../utils/date';
import { sessionForDate } from '../training/programGenerator';

/** Nombre maximal de notifications par jour : on ne spamme jamais. */
export const MAX_PER_DAY = 5;

export function defaultReminders(p: UserProfile): ReminderConfig[] {
  return [
    { id: 'wake', label: 'Réveil', time: p.wakeTime, enabled: true, message: 'Debout. Commence ta journée : check-in en 30 secondes.' },
    { id: 'water', label: 'Hydratation', time: shiftTime(p.wakeTime, 180), enabled: true, message: 'Pense à boire de l’eau.' },
    { id: 'lunch', label: 'Repas', time: '12:30', enabled: true, message: 'Il est temps de manger. Une source de protéines dans l’assiette ?' },
    { id: 'training', label: 'Entraînement', time: shiftTime(p.trainingTime, -30), enabled: true, message: 'Ton entraînement est prévu dans 30 minutes.' },
    { id: 'nutrition_review', label: 'Bilan nutrition', time: '20:30', enabled: true, message: 'Vérifie ton alimentation de la journée.' },
    { id: 'sleep', label: 'Sommeil', time: shiftTime(p.bedtime, -45), enabled: true, message: 'Prépare ta récupération : écrans coupés, lumière tamisée.' },
  ];
}

export interface PlannedNotification {
  id: string;
  kind: ReminderKind;
  date: Date;
  title: string;
  body: string;
}

function inQuietHours(time: string, p: UserProfile): boolean {
  const t = minutesOfDay(time);
  const bed = minutesOfDay(p.bedtime);
  const wake = minutesOfDay(p.wakeTime);
  return bed > wake ? t >= bed || t < wake : t >= bed && t < wake;
}

/** L'action associée au rappel est-elle déjà faite ce jour-là ? */
export function isSatisfied(kind: ReminderKind, state: AppState, date: ISODate): boolean {
  switch (kind) {
    case 'wake':
    case 'checkin':
      return state.morningCheckIns.some((c) => c.date === date);
    case 'water': {
      const a = state.activity.find((x) => x.date === date);
      return !!a && a.waterMl >= 1000;
    }
    case 'lunch':
      return state.foodLog.some((f) => f.date === date && (f.slot === 'lunch' || f.slot === 'dinner'));
    case 'training':
      return state.workouts.some((w) => w.date === date);
    case 'nutrition_review':
      return state.eveningCheckIns.some((c) => c.date === date);
    case 'sleep':
      return false;
  }
}

/**
 * Notifications à programmer pour les prochaines 48 h.
 * — pas de rappel si l'action est déjà faite
 * — pas de rappel d'entraînement un jour sans séance
 * — pas de rappel pendant les heures de sommeil
 * — plafond quotidien
 */
export function planNotifications(state: AppState, now: Date, horizonDays = 2): PlannedNotification[] {
  const p = state.profile;
  if (!p) return [];
  const out: PlannedNotification[] = [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(today, i);
    const plan = state.plans.find((pl) => pl.weekStart === startOfWeek(date));
    const hasSession = !!sessionForDate(plan, date);
    let count = 0;
    const sorted = [...state.reminders].filter((r) => r.enabled).sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time));
    for (const r of sorted) {
      if (count >= MAX_PER_DAY) break;
      if (r.id === 'training' && !hasSession) continue;
      if (r.id !== 'sleep' && r.id !== 'wake' && inQuietHours(r.time, p)) continue;
      if (isSatisfied(r.id, state, date)) continue;
      const d = fromISODate(date);
      const m = minutesOfDay(r.time);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (d.getTime() <= now.getTime()) continue;
      out.push({ id: `${r.id}_${date}`, kind: r.id, date: d, title: titleFor(r.id, p), body: r.message });
      count++;
    }
  }
  return out;
}

function titleFor(kind: ReminderKind, p: UserProfile): string {
  const map: Record<ReminderKind, string> = {
    wake: `Bonjour ${p.firstName} ☀️`,
    water: 'Hydratation 💧',
    lunch: 'Repas 🍽️',
    training: 'Entraînement 🏋️',
    nutrition_review: 'Bilan du jour 🥗',
    sleep: 'Récupération 😴',
    checkin: 'Check-in',
  };
  return map[kind];
}

export interface ReminderSuggestion {
  kind: ReminderKind;
  currentTime: string;
  suggestedTime?: string;
  disable?: boolean;
  message: string;
}

/**
 * Si un rappel est régulièrement ignoré, on propose de le déplacer à
 * l'heure où l'utilisateur fait réellement l'action (ou de le désactiver)
 * plutôt que de répéter le même message.
 */
export function reminderSuggestions(state: AppState, today: ISODate): ReminderSuggestion[] {
  const out: ReminderSuggestion[] = [];
  for (const r of state.reminders) {
    if (!r.enabled) continue;
    const stats: ReminderStats | undefined = state.reminderStats[r.id];
    if (!stats) continue;
    if (stats.snoozedUntil && stats.snoozedUntil > today) continue;
    const window = stats.scheduled.filter((d) => d > addDays(today, -10) && d < today);
    if (window.length < 5) continue;
    const ignored = window.filter((d) => !stats.acted.includes(d)).length;
    if (ignored / window.length < 0.7) continue;

    const times = stats.actualTimes.slice(-7).map(minutesOfDay);
    if (times.length >= 3) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const suggested = formatTime(Math.round(avg / 15) * 15 - 15);
      if (Math.abs(minutesOfDay(suggested) - minutesOfDay(r.time)) >= 30) {
        out.push({
          kind: r.id,
          currentTime: r.time,
          suggestedTime: suggested,
          message: `Le rappel « ${r.label} » de ${r.time} est souvent ignoré, mais tu agis en général vers ${formatTime(avg)}. On le déplace à ${suggested} ?`,
        });
        continue;
      }
    }
    out.push({
      kind: r.id,
      currentTime: r.time,
      disable: true,
      message: `Le rappel « ${r.label} » est ignoré ${ignored} fois sur ${window.length}. Veux-tu le désactiver ou changer son heure ?`,
    });
  }
  return out;
}

export function recordScheduled(stats: ReminderStats | undefined, date: ISODate): ReminderStats {
  const s = stats ?? { scheduled: [], acted: [], actualTimes: [] };
  if (s.scheduled.includes(date)) return s;
  return { ...s, scheduled: [...s.scheduled, date].slice(-30) };
}

export function recordAction(stats: ReminderStats | undefined, date: ISODate, time: string): ReminderStats {
  const s = stats ?? { scheduled: [], acted: [], actualTimes: [] };
  if (s.acted.includes(date)) return s;
  return { ...s, acted: [...s.acted, date].slice(-30), actualTimes: [...s.actualTimes, time].slice(-14) };
}
