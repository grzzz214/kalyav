import type {
  Goal,
  Limitation,
  PainArea,
  PlannedSession,
  PrescribedExercise,
  SessionType,
  UserProfile,
  WeeklyPlan,
} from '../types';
import { addDays, weekdayIndex } from '../utils/date';
import { clamp } from '../utils/stats';
import { eligibleFor, getExercise, type EligibilityContext, type Exercise, type Pattern } from './exercises';
import { kcalFromMet } from '../nutrition/calculator';

export const SESSION_LABELS: Record<SessionType, string> = {
  full_body: 'Full body',
  upper: 'Haut du corps',
  lower: 'Bas du corps',
  push: 'Poussée',
  pull: 'Tirage',
  legs: 'Jambes',
  hiit: 'HIIT',
  cardio_z2: 'Cardio endurance',
  intervals: 'Intervalles',
  mobility: 'Mobilité',
  recovery: 'Récupération active',
  core: 'Gainage',
};

export const GOAL_LABELS: Record<Goal, string> = {
  fat_loss: 'Perte de gras',
  muscle_gain: 'Prise de muscle',
  recomposition: 'Recomposition corporelle',
  endurance: 'Endurance',
  cardio: 'Cardio',
  strength: 'Force',
  mobility: 'Mobilité',
  general_fitness: 'Remise en forme',
};

/** Répartition hebdomadaire des types de séances selon l'objectif. */
const SPLITS: Record<Goal, Record<number, SessionType[]>> = {
  fat_loss: {
    1: ['full_body'],
    2: ['full_body', 'full_body'],
    3: ['full_body', 'hiit', 'full_body'],
    4: ['upper', 'lower', 'hiit', 'full_body'],
    5: ['upper', 'lower', 'hiit', 'full_body', 'cardio_z2'],
    6: ['upper', 'lower', 'hiit', 'full_body', 'cardio_z2', 'mobility'],
  },
  muscle_gain: {
    1: ['full_body'],
    2: ['full_body', 'full_body'],
    3: ['full_body', 'full_body', 'full_body'],
    4: ['upper', 'lower', 'upper', 'lower'],
    5: ['push', 'pull', 'legs', 'upper', 'lower'],
    6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
  },
  recomposition: {
    1: ['full_body'],
    2: ['full_body', 'full_body'],
    3: ['full_body', 'full_body', 'hiit'],
    4: ['upper', 'lower', 'full_body', 'intervals'],
    5: ['upper', 'lower', 'hiit', 'full_body', 'cardio_z2'],
    6: ['push', 'pull', 'legs', 'hiit', 'full_body', 'mobility'],
  },
  strength: {
    1: ['full_body'],
    2: ['full_body', 'full_body'],
    3: ['full_body', 'full_body', 'full_body'],
    4: ['upper', 'lower', 'upper', 'lower'],
    5: ['upper', 'lower', 'upper', 'lower', 'mobility'],
    6: ['upper', 'lower', 'upper', 'lower', 'full_body', 'mobility'],
  },
  endurance: {
    1: ['cardio_z2'],
    2: ['cardio_z2', 'full_body'],
    3: ['cardio_z2', 'intervals', 'full_body'],
    4: ['cardio_z2', 'intervals', 'full_body', 'cardio_z2'],
    5: ['cardio_z2', 'intervals', 'full_body', 'cardio_z2', 'mobility'],
    6: ['cardio_z2', 'intervals', 'full_body', 'cardio_z2', 'core', 'cardio_z2'],
  },
  cardio: {
    1: ['hiit'],
    2: ['hiit', 'cardio_z2'],
    3: ['hiit', 'cardio_z2', 'full_body'],
    4: ['hiit', 'cardio_z2', 'intervals', 'full_body'],
    5: ['hiit', 'cardio_z2', 'intervals', 'full_body', 'mobility'],
    6: ['hiit', 'cardio_z2', 'intervals', 'full_body', 'cardio_z2', 'mobility'],
  },
  mobility: {
    1: ['mobility'],
    2: ['mobility', 'core'],
    3: ['mobility', 'full_body', 'mobility'],
    4: ['mobility', 'full_body', 'mobility', 'core'],
    5: ['mobility', 'full_body', 'mobility', 'core', 'cardio_z2'],
    6: ['mobility', 'full_body', 'mobility', 'core', 'cardio_z2', 'mobility'],
  },
  general_fitness: {
    1: ['full_body'],
    2: ['full_body', 'cardio_z2'],
    3: ['full_body', 'cardio_z2', 'full_body'],
    4: ['full_body', 'cardio_z2', 'full_body', 'mobility'],
    5: ['full_body', 'cardio_z2', 'full_body', 'hiit', 'mobility'],
    6: ['upper', 'lower', 'cardio_z2', 'full_body', 'hiit', 'mobility'],
  },
};

const SLOTS: Partial<Record<SessionType, Pattern[]>> = {
  full_body: ['squat', 'h_push', 'hinge', 'h_pull', 'lunge', 'v_push', 'core', 'v_pull', 'conditioning'],
  upper: ['h_push', 'h_pull', 'v_push', 'v_pull', 'arms', 'core', 'arms'],
  lower: ['squat', 'hinge', 'lunge', 'core', 'calves', 'hinge'],
  push: ['h_push', 'v_push', 'h_push', 'arms', 'v_push', 'core'],
  pull: ['v_pull', 'h_pull', 'h_pull', 'arms', 'v_pull', 'core'],
  legs: ['squat', 'hinge', 'lunge', 'calves', 'core', 'lunge'],
  hiit: ['conditioning', 'squat', 'conditioning', 'h_push', 'conditioning', 'core', 'conditioning', 'lunge'],
  core: ['core', 'core', 'hinge', 'core', 'mobility', 'core'],
  mobility: ['mobility', 'mobility', 'mobility', 'mobility', 'mobility', 'mobility', 'mobility', 'mobility'],
};

const WARMUP = {
  strength: ['3 min de marche ou corde légère', 'Cercles d’épaules et de hanches (1 min)', '1 série légère du premier exercice'],
  cardio: ['5 min d’allure très facile', 'Mobilité chevilles et hanches (1 min)'],
  mobility: ['Respiration lente 1 min', 'Mouvements articulaires doux de la tête aux pieds'],
};
const COOLDOWN = ['Marche lente 2 min', 'Étirements doux des muscles travaillés', 'Hydrate-toi'];

interface Prescription {
  sets: number;
  reps: string;
  restSec: number;
  workSec?: number;
}

function prescribe(goal: Goal, ex: Exercise, slotIndex: number, level: UserProfile['level'], type: SessionType): Prescription {
  if (type === 'hiit') {
    const work = level === 'beginner' ? 30 : level === 'intermediate' ? 40 : 45;
    return { sets: level === 'beginner' ? 3 : 4, reps: `${work} s`, workSec: work, restSec: 60 - work + 10 };
  }
  if (ex.mode === 'time') {
    const work = ex.pattern === 'mobility' ? 45 : ex.pattern === 'core' ? (level === 'beginner' ? 25 : 40) : 40;
    return { sets: ex.pattern === 'mobility' ? 2 : 3, reps: `${work} s`, workSec: work, restSec: ex.pattern === 'mobility' ? 10 : 30 };
  }
  const compound = slotIndex < 2 && !['arms', 'calves', 'core'].includes(ex.pattern);
  let p: Prescription;
  switch (goal) {
    case 'strength':
      p = compound ? { sets: 5, reps: '4-6', restSec: 150 } : { sets: 3, reps: '6-8', restSec: 120 };
      break;
    case 'muscle_gain':
      p = compound ? { sets: 4, reps: '6-10', restSec: 120 } : { sets: 3, reps: '8-12', restSec: 90 };
      if (ex.pattern === 'arms' || ex.pattern === 'calves') p = { sets: 3, reps: '10-15', restSec: 60 };
      break;
    case 'recomposition':
      p = compound ? { sets: 4, reps: '8-10', restSec: 90 } : { sets: 3, reps: '10-12', restSec: 75 };
      break;
    case 'fat_loss':
      p = { sets: 3, reps: compound ? '8-12' : '12-15', restSec: compound ? 75 : 50 };
      break;
    default:
      p = { sets: 3, reps: '10-15', restSec: 60 };
  }
  if (level === 'beginner') p = { ...p, sets: Math.max(2, p.sets - 1), restSec: p.restSec + 15 };
  return p;
}

function exerciseSeconds(p: PrescribedExercise): number {
  const work = p.workSec ?? 40;
  return p.sets * (work + p.restSec) + 45;
}

export function estimateDurationMin(exercises: PrescribedExercise[], warmupMin = 6, cooldownMin = 4): number {
  const s = exercises.reduce((acc, e) => acc + exerciseSeconds(e), 0);
  return Math.round(s / 60 + warmupMin + cooldownMin);
}

export function estimateKcal(exercises: PrescribedExercise[], weightKg: number): number {
  return exercises.reduce((acc, e) => {
    const ex = getExercise(e.exerciseId);
    return acc + kcalFromMet(ex.met, weightKg, exerciseSeconds(e) / 60);
  }, kcalFromMet(3.5, weightKg, 10));
}

/** Préférence de matériel : plutôt charges pour force/muscle, plutôt poids du corps sinon. */
function pickExercise(
  pattern: Pattern,
  ctx: EligibilityContext,
  used: Set<string>,
  seed: number,
  preferLoaded: boolean,
): Exercise | undefined {
  const options = eligibleFor(pattern, ctx).filter((e) => !used.has(e.id));
  if (!options.length) return undefined;
  const sorted = [...options].sort((a, b) =>
    preferLoaded ? b.equipment.length - a.equipment.length || b.level - a.level : a.equipment.length - b.equipment.length,
  );
  // on garde les meilleures options et on fait tourner pour varier les semaines/séances
  const top = sorted.slice(0, Math.min(3, sorted.length));
  return top[seed % top.length];
}

export interface BuildContext {
  profile: UserProfile;
  volumeModifier: number;
  seed: number;
  extraLimitations?: Limitation[];
}

export function eligibilityFromProfile(p: UserProfile, extra: Limitation[] = []): EligibilityContext {
  return { equipment: p.equipment, limitations: [...new Set([...p.limitations, ...extra])], level: p.level };
}

function cardioSession(type: SessionType, ctx: BuildContext, minutes: number): PrescribedExercise[] {
  const elig = eligibilityFromProfile(ctx.profile, ctx.extraLimitations);
  const steady = eligibleFor('steady_cardio', elig);
  const prefer = (ids: string[]) => ids.map((id) => steady.find((e) => e.id === id)).find(Boolean) ?? steady[0];
  if (type === 'intervals') {
    const ex = prefer(['bike', 'rower_steady', 'jog', 'elliptical', 'brisk_walk'])!;
    const rounds = clamp(Math.round(((minutes - 15) * 60) / 150 * ctx.volumeModifier), 4, 12);
    return [
      {
        exerciseId: ex.id,
        sets: rounds,
        reps: '60 s soutenu',
        workSec: 60,
        restSec: 90,
        note: 'Récupère 90 s à allure facile entre chaque bloc. Effort 7–8/10, jamais au maximum.',
      },
    ];
  }
  const ex = prefer(
    ctx.profile.preferredStyles.includes('cardio') ? ['jog', 'bike', 'rower_steady', 'elliptical', 'brisk_walk'] : ['brisk_walk', 'bike', 'elliptical', 'jog'],
  )!;
  const work = Math.round(clamp((minutes - 8) * ctx.volumeModifier, 15, 90));
  return [{ exerciseId: ex.id, sets: 1, reps: `${work} min`, workSec: work * 60, restSec: 0, note: 'Zone 2 : tu dois pouvoir tenir une conversation.' }];
}

export function buildSession(type: SessionType, ctx: BuildContext, minutes: number): PrescribedExercise[] {
  if (type === 'cardio_z2' || type === 'intervals') return cardioSession(type, ctx, minutes);
  if (type === 'recovery') return recoveryExercises(ctx);

  const { profile } = ctx;
  const elig = eligibilityFromProfile(profile, ctx.extraLimitations);
  const slots = SLOTS[type] ?? SLOTS.full_body!;
  const preferLoaded = ['muscle_gain', 'strength', 'recomposition'].includes(profile.goal);
  const used = new Set<string>();
  const out: PrescribedExercise[] = [];
  const budget = minutes;

  for (let i = 0; i < slots.length; i++) {
    const ex = pickExercise(slots[i], elig, used, ctx.seed + i, preferLoaded);
    if (!ex) continue;
    const p = prescribe(profile.goal, ex, out.length, profile.level, type);
    const sets = Math.max(type === 'mobility' ? 1 : 2, Math.round(p.sets * ctx.volumeModifier));
    const candidate: PrescribedExercise = { exerciseId: ex.id, sets, reps: p.reps, restSec: p.restSec, workSec: p.workSec };
    if (out.length >= 3 && estimateDurationMin([...out, candidate]) > budget) break;
    used.add(ex.id);
    out.push(candidate);
  }
  return out;
}

export function recoveryExercises(ctx: BuildContext): PrescribedExercise[] {
  const elig = eligibilityFromProfile(ctx.profile, ctx.extraLimitations);
  const walk: PrescribedExercise = {
    exerciseId: 'brisk_walk',
    sets: 1,
    reps: '20 min',
    workSec: 1200,
    restSec: 0,
    note: 'Allure tranquille, au grand air si possible.',
  };
  const mob = eligibleFor('mobility', elig)
    .filter((e) => e.id !== 'box_breathing')
    .slice(0, 4)
    .map<PrescribedExercise>((e) => ({ exerciseId: e.id, sets: 2, reps: '45 s', workSec: 45, restSec: 10 }));
  return [walk, ...mob, { exerciseId: 'box_breathing', sets: 1, reps: '3 min', workSec: 180, restSec: 0 }];
}

function difficultyOf(type: SessionType, level: UserProfile['level'], mod: number): 1 | 2 | 3 {
  if (type === 'mobility' || type === 'recovery') return 1;
  const base = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 3;
  const bump = type === 'hiit' || type === 'intervals' ? 1 : 0;
  return clamp(Math.round(base + bump + (mod > 1.05 ? 0.5 : mod < 0.85 ? -1 : 0)), 1, 3) as 1 | 2 | 3;
}

function focusOf(type: SessionType, exercises: PrescribedExercise[]): string {
  const muscles = new Set<string>();
  exercises.forEach((e) => getExercise(e.exerciseId).primary.forEach((m) => muscles.add(m)));
  const list = [...muscles].slice(0, 4).join(', ');
  return list || SESSION_LABELS[type];
}

/** Répartit les séances sur les jours disponibles en maximisant l'espacement. */
export function chooseTrainingDays(available: number[], count: number): number[] {
  const days = [...new Set(available)].sort((a, b) => a - b);
  if (count >= days.length) return days;
  if (count <= 0) return [];
  const result: number[] = [];
  for (let i = 0; i < count; i++) result.push(days[Math.floor((i * days.length) / count)]);
  return result;
}

export function sessionTypesFor(profile: UserProfile, count: number): SessionType[] {
  const n = clamp(count, 1, 6);
  let types = [...SPLITS[profile.goal][n]];
  // Avancés en prise de muscle à 3 séances : split poussée / tirage / jambes
  if (profile.goal === 'muscle_gain' && n === 3 && profile.level !== 'beginner') types = ['push', 'pull', 'legs'];
  // Sécurité cardiaque : pas de haute intensité
  if (profile.limitations.includes('cardiac')) {
    types = types.map((t) => (t === 'hiit' || t === 'intervals' ? 'cardio_z2' : t));
  }
  // Préférence mobilité / renforcement
  if (profile.preferredStyles.length === 1 && profile.preferredStyles[0] === 'mobility') {
    types = types.map((t) => (t === 'hiit' ? 'mobility' : t));
  }
  return types;
}

export interface PlanOptions {
  volumeModifier?: number;
  sessionReduction?: number;
  rationale?: string[];
  seed?: number;
}

export function generateWeeklyPlan(profile: UserProfile, weekStart: string, opts: PlanOptions = {}): WeeklyPlan {
  const mod = clamp(opts.volumeModifier ?? 1, 0.6, 1.2);
  const count = clamp(
    Math.min(profile.sessionsPerWeek, profile.availableDays.length || profile.sessionsPerWeek) - (opts.sessionReduction ?? 0),
    1,
    6,
  );
  const days = chooseTrainingDays(profile.availableDays.length ? profile.availableDays : [0, 2, 4], count);
  const types = sessionTypesFor(profile, days.length);
  const weekSeed = opts.seed ?? Math.floor(new Date(weekStart).getTime() / (7 * 86_400_000));

  const sessions: PlannedSession[] = days.map((dayIndex, i) => {
    const type = types[i % types.length];
    const minutes = Math.round(profile.sessionMinutes * (mod < 0.85 ? 0.8 : 1));
    const ctx: BuildContext = { profile, volumeModifier: mod, seed: weekSeed + i * 2 };
    const exercises = buildSession(type, ctx, minutes);
    const warmup = type === 'mobility' ? WARMUP.mobility : type === 'cardio_z2' || type === 'intervals' ? WARMUP.cardio : WARMUP.strength;
    const durationMin = type === 'cardio_z2' ? Math.round(minutes) : Math.min(estimateDurationMin(exercises), Math.round(minutes * 1.1));
    return {
      id: `${weekStart}_${dayIndex}`,
      dayIndex,
      date: addDays(weekStart, dayIndex),
      type,
      title: SESSION_LABELS[type],
      focus: focusOf(type, exercises),
      durationMin,
      difficulty: difficultyOf(type, profile.level, mod),
      warmup,
      exercises,
      cooldown: COOLDOWN,
      estimatedKcal: estimateKcal(exercises, profile.weightKg),
    };
  });

  const rationale = [
    `${sessions.length} séance${sessions.length > 1 ? 's' : ''} orientée${sessions.length > 1 ? 's' : ''} « ${GOAL_LABELS[profile.goal]} », réparties pour laisser au moins une journée de récupération quand c’est possible.`,
    ...(opts.rationale ?? []),
  ];
  if (profile.limitations.length) {
    rationale.push('Exercices filtrés selon tes limitations physiques déclarées.');
  }

  return { weekStart, goal: profile.goal, volumeModifier: mod, sessions, rationale, createdAt: new Date().toISOString() };
}

const PAIN_TO_LIMITATION: Partial<Record<PainArea, Limitation>> = {
  knee: 'knee',
  lower_back: 'lower_back',
  shoulder: 'shoulder',
  wrist: 'wrist',
  neck: 'neck',
  hip: 'hip',
  ankle: 'ankle',
  chest: 'cardiac',
};

export function painToLimitation(area: PainArea): Limitation | undefined {
  return PAIN_TO_LIMITATION[area];
}

/** « Je suis fatigué aujourd'hui » : volume réduit ou séance de récupération. */
export function adaptSessionForFatigue(
  session: PlannedSession,
  profile: UserProfile,
  severity: 'mild' | 'high',
): PlannedSession {
  if (severity === 'high' || session.type === 'hiit' || session.type === 'intervals') {
    return toRecoverySession(session, profile, 'fatigue');
  }
  const exercises = session.exercises
    .filter((e) => getExercise(e.exerciseId).pattern !== 'conditioning')
    .slice(0, Math.max(3, session.exercises.length - 2))
    .map((e) => ({
      ...e,
      sets: Math.max(e.workSec && e.sets === 1 ? 1 : 2, e.sets - 1),
      reps: e.workSec && e.sets === 1 ? `${Math.round((e.workSec * 0.7) / 60)} min` : e.reps,
      workSec: e.workSec && e.sets === 1 ? Math.round(e.workSec * 0.7) : e.workSec,
      restSec: e.restSec + 15,
      note: 'Garde 3 répétitions en réserve (effort 6/10 max).',
    }));
  return {
    ...session,
    exercises,
    adapted: 'fatigue',
    title: `${session.title} — version allégée`,
    durationMin: session.type === 'cardio_z2' ? Math.round(session.durationMin * 0.7) : estimateDurationMin(exercises),
    estimatedKcal: estimateKcal(exercises, profile.weightKg),
    difficulty: 1,
  };
}

export function toRecoverySession(
  session: PlannedSession,
  profile: UserProfile,
  reason: 'fatigue' | 'pain' | 'recovery',
  painArea?: PainArea,
): PlannedSession {
  const extra = painArea ? [painToLimitation(painArea)].filter((x): x is Limitation => !!x) : [];
  const exercises = recoveryExercises({ profile, volumeModifier: 1, seed: 0, extraLimitations: extra });
  return {
    ...session,
    type: 'recovery',
    title: SESSION_LABELS.recovery,
    focus: 'Circulation, mobilité, récupération',
    exercises,
    warmup: WARMUP.mobility,
    adapted: reason,
    durationMin: estimateDurationMin(exercises, 0, 2),
    estimatedKcal: estimateKcal(exercises, profile.weightKg),
    difficulty: 1,
  };
}

export function replaceExercise(session: PlannedSession, index: number, newId: string): PlannedSession {
  const old = session.exercises[index];
  const next = getExercise(newId);
  const sameMode = getExercise(old.exerciseId).mode === next.mode;
  const replaced: PrescribedExercise = sameMode
    ? { ...old, exerciseId: newId, swappedFrom: old.exerciseId }
    : next.mode === 'time'
      ? { ...old, exerciseId: newId, reps: '40 s', workSec: 40, swappedFrom: old.exerciseId }
      : { ...old, exerciseId: newId, reps: '10-12', workSec: undefined, swappedFrom: old.exerciseId };
  const exercises = session.exercises.map((e, i) => (i === index ? replaced : e));
  return { ...session, exercises };
}

export function sessionForDate(plan: WeeklyPlan | undefined, date: string): PlannedSession | undefined {
  if (!plan) return undefined;
  const idx = weekdayIndex(date);
  return plan.sessions.find((s) => s.dayIndex === idx && s.date === date);
}
