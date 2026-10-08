import type { ISODate } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = fromISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

/** 0 = lundi … 6 = dimanche */
export function weekdayIndex(date: ISODate): number {
  return (fromISODate(date).getDay() + 6) % 7;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayIndex(date));
}

export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function lastNDays(end: ISODate, n: number): ISODate[] {
  return dateRange(addDays(end, -(n - 1)), end);
}

export function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

export function minutesOfDay(hhmm: string): number {
  const { h, m } = parseTime(hhmm);
  return h * 60 + m;
}

export function formatTime(totalMinutes: number): string {
  const t = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function shiftTime(hhmm: string, deltaMinutes: number): string {
  return formatTime(minutesOfDay(hhmm) + deltaMinutes);
}

/** Durée de sommeil en heures entre coucher et réveil. */
export function sleepDuration(bedtime: string, wake: string): number {
  let diff = minutesOfDay(wake) - minutesOfDay(bedtime);
  if (diff <= 0) diff += 1440;
  return diff / 60;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const dayLabel = (i: number) => DAY_LABELS[i];
export const dayLongLabel = (i: number) => DAY_LONG[i];

export function prettyDate(date: ISODate): string {
  const d = fromISODate(date);
  return `${DAY_LONG[weekdayIndex(date)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function shortDate(date: ISODate): string {
  const d = fromISODate(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
