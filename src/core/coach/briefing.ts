import type { AppState, PlannedSession } from '../types';
import type { Analysis } from './analysis';
import type { DailySnapshot } from '../dashboard/daily';
import { trainingClearance, type SafetyDecision } from './safety';
import { adaptSessionForFatigue, toRecoverySession } from '../training/programGenerator';
import { addDays } from '../utils/date';

export interface DailyAction {
  id: string;
  emoji: string;
  label: string;
  detail?: string;
  done: boolean;
  route?: string;
}

export interface DailyBriefing {
  greeting: string;
  headline: string;
  coachLine: string;
  decision: SafetyDecision;
  /** séance du jour après adaptation automatique (fatigue / douleur) */
  session?: PlannedSession;
  actions: DailyAction[];
  nextAction?: DailyAction;
}

function greeting(name: string, now: Date) {
  const h = now.getHours();
  if (h < 5) return `Bonne nuit, ${name}`;
  if (h < 12) return `Bonjour ${name}`;
  if (h < 18) return `Bon après-midi, ${name}`;
  return `Bonsoir ${name}`;
}

/**
 * Transforme les données du jour en décisions : quelle séance faire,
 * quoi manger, quelle est LA prochaine action.
 */
export function dailyBriefing(state: AppState, a: Analysis, snap: DailySnapshot, now: Date = new Date()): DailyBriefing {
  const p = state.profile!;
  const hour = now.getHours();
  const recentPainDays = state.morningCheckIns.filter((c) => c.pain && c.pain.intensity >= 4 && c.date > addDays(snap.date, -7)).length;
  const decision = trainingClearance(snap.morning, recentPainDays);

  let session = snap.session;
  if (session && !snap.workout) {
    if (decision.clearance === 'rest') session = { ...toRecoverySession(session, p, 'pain', snap.morning?.pain?.area), title: 'Repos', exercises: [] };
    else if (decision.clearance === 'recovery') session = toRecoverySession(session, p, snap.morning?.pain ? 'pain' : 'fatigue', snap.morning?.pain?.area);
    else if (decision.clearance === 'lighter') session = adaptSessionForFatigue(session, p, 'mild');
  }

  const t = a.targets;
  const remainingProtein = Math.round(t.protein - snap.consumed.protein);
  const remainingKcal = Math.round(t.kcal - snap.consumed.kcal);
  const remainingWater = Math.max(0, t.waterMl - snap.waterMl);
  const actions: DailyAction[] = [];

  actions.push({
    id: 'morning',
    emoji: '☀️',
    label: 'Check-in du matin',
    detail: '30 secondes pour adapter ta journée',
    done: !!snap.morning,
    route: '/checkin?mode=morning',
  });
  if (session && decision.clearance !== 'rest') {
    actions.push({
      id: 'training',
      emoji: session.type === 'recovery' ? '🧘' : '🏋️',
      label: session.title,
      detail: `${session.durationMin} min · ${session.focus}`,
      done: !!snap.workout,
      route: `/workout/${session.id}`,
    });
  } else {
    actions.push({
      id: 'training',
      emoji: '🚶',
      label: decision.clearance === 'rest' ? 'Repos complet' : 'Jour de repos actif',
      detail: decision.clearance === 'rest' ? 'Ton corps a besoin de récupérer' : '20–30 min de marche suffisent',
      done: decision.clearance === 'rest' || snap.steps >= t.steps * 0.7,
    });
  }
  actions.push({
    id: 'protein',
    emoji: '🥩',
    label: remainingProtein > 15 ? `Encore ${remainingProtein} g de protéines` : 'Protéines du jour atteintes',
    detail: remainingKcal > 0 ? `${remainingKcal} kcal disponibles` : 'Objectif calorique atteint',
    done: remainingProtein <= 15,
    route: '/meal-generator',
  });
  actions.push({
    id: 'water',
    emoji: '💧',
    label: remainingWater > 0 ? `Boire encore ${(remainingWater / 1000).toFixed(1).replace('.', ',')} L` : 'Hydratation OK',
    done: remainingWater <= 0,
  });
  actions.push({
    id: 'steps',
    emoji: '👟',
    label: snap.steps >= t.steps ? 'Objectif de pas atteint' : `${(t.steps - snap.steps).toLocaleString('fr-FR')} pas restants`,
    done: snap.steps >= t.steps,
  });
  if (hour >= 18) {
    actions.push({
      id: 'evening',
      emoji: '🌙',
      label: 'Bilan du soir',
      detail: 'Pour préparer demain',
      done: snap.eveningDone,
      route: '/checkin?mode=evening',
    });
  }

  const nextAction = actions.find((x) => !x.done && (x.id !== 'morning' || hour < 14));

  let headline: string;
  if (decision.clearance === 'rest') headline = 'Aujourd’hui : repos et récupération.';
  else if (decision.clearance === 'recovery') headline = 'Aujourd’hui : récupération active, ton corps en a besoin.';
  else if (decision.clearance === 'lighter') headline = 'Séance allégée aujourd’hui : on garde le rythme sans s’épuiser.';
  else if (session && !snap.workout) headline = `Au programme : ${session.title.toLowerCase()}, ${session.durationMin} min.`;
  else if (snap.workout) headline = 'Séance faite. Maintenant : récupération et nutrition.';
  else headline = 'Jour sans séance : bouge, mange bien, dors bien.';

  let coachLine = decision.messages[0] ?? '';
  if (!coachLine) {
    if (a.training.consecutiveTrainingDays >= 3) coachLine = `${a.training.consecutiveTrainingDays} jours d’entraînement d’affilée. Pense à récupérer.`;
    else if ((a.nutrition.proteinRatio7 ?? 1) < 0.85) coachLine = 'Ton point clé du moment : les protéines. Ajoute une source à chaque repas.';
    else if (a.weight.plateauDays >= 14) coachLine = 'Plateau en cours : focus régularité cette semaine, pas de panique.';
    else if (a.historyDays >= 3 && a.adherence >= 0.75) coachLine = 'Ta régularité paie. Continue exactement comme ça.';
    else coachLine = 'Une action à la fois. Commence par la prochaine.';
  }

  return { greeting: greeting(p.firstName, now), headline, coachLine, decision, session, actions, nextAction };
}
