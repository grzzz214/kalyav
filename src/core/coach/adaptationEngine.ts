import type { AppState, CoachAdjustments, ISODate, UserProfile } from '../types';
import type { Analysis } from './analysis';
import { startOfWeek } from '../utils/date';
import { clamp, round } from '../utils/stats';

export type InsightCategory = 'safety' | 'nutrition' | 'training' | 'recovery' | 'habit' | 'motivation';

export interface Adjustment {
  kcalDelta?: number;
  stepsDelta?: number;
  volumeModifier?: number;
  sessionReduction?: number;
}

export interface CoachInsight {
  /** stable sur la période pour ne pas répéter le même conseil */
  id: string;
  ruleId: string;
  category: InsightCategory;
  /** 1 = critique … 5 = information */
  priority: number;
  tone: 'positive' | 'neutral' | 'warning';
  title: string;
  message: string;
  /** les données qui justifient le conseil */
  reason: string;
  actions: string[];
  adjustment?: Adjustment;
}

/** Bornes : toutes les adaptations restent raisonnables. */
export const LIMITS = {
  kcalDelta: { min: -300, max: 400 },
  stepsDelta: { min: 0, max: 4000 },
  volume: { min: 0.7, max: 1.15 },
  sessionReduction: { min: 0, max: 2 },
} as const;

const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');

/**
 * Moteur de règles. Chaque règle lit des tendances (≥ 7 jours) et propose
 * une adaptation expliquée. L'utilisateur reste maître : les ajustements
 * ne s'appliquent qu'après acceptation.
 */
export function evaluateRules(state: AppState, a: Analysis): CoachInsight[] {
  const p = state.profile!;
  const out: CoachInsight[] = [];
  const week = startOfWeek(a.today);
  const id = (rule: string) => `${rule}:${week}`;
  const losing = p.goal === 'fat_loss' || p.goal === 'recomposition';

  // ——— 1. Sécurité : douleur / symptômes ———
  if (a.pain.alarming) {
    out.push({
      id: `pain_alarm:${a.today}`,
      ruleId: 'pain_alarm',
      category: 'safety',
      priority: 1,
      tone: 'warning',
      title: 'Priorité : ta santé',
      message:
        'Tu as signalé un symptôme inhabituel. Pas d’entraînement aujourd’hui. Si tu ressens une douleur thoracique, un essoufflement anormal ou un malaise, contacte immédiatement le 15 (ou le 112).',
      reason: 'Symptôme marqué comme inquiétant lors de ton check-in.',
      actions: ['Repos complet aujourd’hui', 'Consulter un médecin avant de reprendre'],
      adjustment: { volumeModifier: 0.7 },
    });
  } else if (a.pain.maxIntensity >= 6 || a.pain.recurringArea) {
    const area = a.pain.recurringArea ?? a.pain.recent[0]?.area;
    out.push({
      id: id(`pain_${area}`),
      ruleId: 'pain_persistent',
      category: 'safety',
      priority: 1,
      tone: 'warning',
      title: 'On protège ta zone douloureuse',
      message:
        'Je retire les exercices qui sollicitent cette zone et je privilégie la récupération. Une douleur qui persiste mérite l’avis d’un professionnel de santé (médecin, kiné).',
      reason:
        a.pain.recurringArea
          ? 'Douleur signalée au même endroit sur au moins 3 check-ins cette semaine.'
          : `Douleur évaluée à ${a.pain.maxIntensity}/10 récemment.`,
      actions: ['Ne jamais forcer sur une douleur', 'Prendre rendez-vous avec un professionnel si ça dure'],
    });
  }

  // ——— 2. Perte de poids trop rapide ———
  if (a.weight.weeklyRatePct !== undefined && a.weight.weeklyRatePct < -1.0 && a.weight.entries14 >= 5) {
    out.push({
      id: id('fast_loss'),
      ruleId: 'fast_loss',
      category: 'nutrition',
      priority: 2,
      tone: 'warning',
      title: 'Tu perds trop vite',
      message:
        'Une perte rapide fait aussi fondre du muscle et fatigue. Je te propose d’augmenter légèrement tes apports et de soigner la récupération.',
      reason: `Tendance sur 14 jours : ${f1(a.weight.slope14!)} kg/semaine (${f1(a.weight.weeklyRatePct)} % de ton poids).`,
      actions: ['+150 kcal par jour, surtout en glucides autour de l’entraînement', 'Viser 7 h 30 de sommeil'],
      adjustment: { kcalDelta: 150 },
    });
  }

  // ——— 3. Apports trop bas (sécurité nutritionnelle) ———
  if (a.nutrition.underFloorDays7 >= 3) {
    out.push({
      id: id('under_floor'),
      ruleId: 'under_floor',
      category: 'safety',
      priority: 2,
      tone: 'warning',
      title: 'Tu manges trop peu',
      message:
        'Manger nettement sous ton minimum n’accélère pas les résultats : énergie en baisse, perte musculaire, fringales. Remontons doucement à ton objectif.',
      reason: `${a.nutrition.underFloorDays7} jours sur 7 sous ${a.targets.floorKcal} kcal.`,
      actions: ['Ajouter une collation protéinée', 'Ne pas sauter de repas'],
    });
  }

  // ——— 4. Plateau : vérifier la régularité avant de toucher aux calories ———
  if (losing && a.weight.plateauDays >= 14 && (a.weight.toGoalKg ?? 0) < -0.5) {
    const lowAdherence = a.nutrition.daysLogged14 < 9 || (a.training.completion14 ?? 1) < 0.7;
    const lowSteps = (a.activity.avgSteps7 ?? a.targets.steps) < a.targets.steps * 0.8;
    if (lowAdherence || a.weight.plateauDays < 21) {
      out.push({
        id: id('plateau_check'),
        ruleId: 'plateau_check',
        category: 'habit',
        priority: 2,
        tone: 'neutral',
        title: `Ton poids stagne depuis ${a.weight.plateauDays} jours`,
        message:
          'Avant de réduire davantage les calories, vérifions ton activité et ta régularité. Un plateau vient souvent d’un suivi moins précis ou d’un peu moins de mouvement.',
        reason: `Suivi alimentaire ${a.nutrition.daysLogged14}/14 jours, séances ${a.training.done14}/${a.training.planned14 || '—'}, pas moyens ${a.activity.avgSteps7 ? round(a.activity.avgSteps7, 100) : 'non suivis'}.`,
        actions: [
          'Peser/noter tous tes repas pendant 7 jours',
          lowSteps ? `Remonter à ${a.targets.steps.toLocaleString('fr-FR')} pas par jour` : 'Garder ton activité actuelle',
          'Te peser 3 matins par semaine dans les mêmes conditions',
        ],
      });
    } else {
      out.push({
        id: id('plateau_adjust'),
        ruleId: 'plateau_adjust',
        category: 'nutrition',
        priority: 2,
        tone: 'neutral',
        title: 'Plateau confirmé : petit ajustement',
        message:
          'Ta régularité est bonne et le poids ne bouge plus depuis 3 semaines. On ajuste légèrement : un peu plus de mouvement et une petite baisse calorique.',
        reason: `Stagnation sur ${a.weight.plateauDays} jours avec ${a.nutrition.daysLogged14}/14 jours suivis.`,
        actions: ['−100 kcal par jour', '+1 500 pas par jour'],
        adjustment: { kcalDelta: -100, stepsDelta: 1500 },
      });
    }
  }

  // ——— 5. Prise de muscle : le poids ne monte pas / monte trop vite ———
  if (p.goal === 'muscle_gain' && a.weight.slope28 !== undefined && a.weight.entries14 >= 4) {
    const ratePct = (a.weight.slope28 / (a.weight.current ?? p.weightKg)) * 100;
    if (ratePct < 0.1 && a.nutrition.daysLogged14 >= 9) {
      out.push({
        id: id('gain_stall'),
        ruleId: 'gain_stall',
        category: 'nutrition',
        priority: 3,
        tone: 'neutral',
        title: 'Le poids ne monte pas encore',
        message: 'Pour construire du muscle, un léger surplus est nécessaire. On ajoute un peu d’énergie, facile à intégrer.',
        reason: `Tendance sur 4 semaines : ${f1(a.weight.slope28)} kg/semaine.`,
        actions: ['+150 kcal/jour (ex. une poignée d’amandes + une banane)'],
        adjustment: { kcalDelta: 150 },
      });
    } else if (ratePct > 0.5) {
      out.push({
        id: id('gain_fast'),
        ruleId: 'gain_fast',
        category: 'nutrition',
        priority: 3,
        tone: 'neutral',
        title: 'Prise un peu rapide',
        message: 'Au-delà de ~0,5 % par semaine, on stocke surtout du gras. On réduit légèrement le surplus.',
        reason: `Tendance : +${f1(a.weight.slope28)} kg/semaine.`,
        actions: ['−100 kcal/jour'],
        adjustment: { kcalDelta: -100 },
      });
    }
  }

  // ——— 6. Performances en baisse → analyser la récupération ———
  const tired = (a.recovery.avgFatigue5 ?? 0) >= 7 || (a.recovery.avgSleep7 ?? 8) < 6.5;
  if ((a.training.perfTrend !== undefined && a.training.perfTrend < -0.03) || (tired && (a.training.avgRpe14 ?? 0) >= 8)) {
    out.push({
      id: id('deload'),
      ruleId: 'deload',
      category: 'recovery',
      priority: 2,
      tone: 'neutral',
      title: 'Semaine de récupération recommandée',
      message:
        'Tes performances ou ton niveau d’énergie baissent. C’est le signe qu’il faut récupérer, pas forcer. Volume réduit de 30 % pendant une semaine, puis on repart plus fort.',
      reason: [
        a.training.perfTrend !== undefined && a.training.perfTrend < -0.03 ? 'performances en baisse sur les dernières séances' : null,
        a.recovery.avgSleep7 !== undefined ? `sommeil moyen ${f1(a.recovery.avgSleep7)} h` : null,
        a.recovery.avgFatigue5 !== undefined ? `fatigue moyenne ${f1(a.recovery.avgFatigue5)}/10` : null,
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/^./, (c) => c.toUpperCase()) + '.',
      actions: ['Volume d’entraînement −30 % cette semaine', 'Coucher 30 min plus tôt'],
      adjustment: { volumeModifier: 0.7 },
    });
  }

  // ——— 7. Séances manquées → programme temporairement plus léger ———
  if (a.training.planned14 >= 3 && (a.training.completion14 ?? 1) < 0.5) {
    out.push({
      id: id('missed'),
      ruleId: 'missed_sessions',
      category: 'training',
      priority: 2,
      tone: 'neutral',
      title: 'On rend le programme plus facile à tenir',
      message:
        'Plusieurs séances ont sauté ces deux dernières semaines. Pas grave : mieux vaut un programme plus court que tu fais vraiment. Je te propose une séance de moins, temporairement.',
      reason: `${a.training.done14} séance(s) réalisée(s) sur ${a.training.planned14} prévues en 14 jours.`,
      actions: ['Une séance de moins par semaine pendant 2 semaines', 'Bloquer tes créneaux dans ton agenda'],
      adjustment: { sessionReduction: 1, volumeModifier: 0.9 },
    });
  }

  // ——— 8. Progression facile → augmenter la difficulté ———
  if (
    a.training.planned14 >= 4 &&
    (a.training.completion14 ?? 0) >= 0.9 &&
    (a.training.avgRpe14 ?? 10) <= 6.5 &&
    (a.recovery.avgFatigue5 ?? 5) <= 5
  ) {
    out.push({
      id: id('progress'),
      ruleId: 'progress',
      category: 'training',
      priority: 3,
      tone: 'positive',
      title: 'Tu es prêt à monter d’un cran',
      message: 'Toutes tes séances sont faites et l’effort reste confortable. On augmente progressivement le volume (+10 %).',
      reason: `${a.training.done14}/${a.training.planned14} séances, effort perçu moyen ${f1(a.training.avgRpe14!)}/10.`,
      actions: ['+10 % de volume', 'Augmenter les charges de 2,5 à 5 % quand le haut de la fourchette est atteint'],
      adjustment: { volumeModifier: 1.1, sessionReduction: 0 },
    });
  }

  // ——— 9. Charge rapprochée → récupération active ———
  if (a.training.sessionsLast4Days >= 3 || a.training.consecutiveTrainingDays >= 3) {
    out.push({
      id: `active_recovery:${a.today}`,
      ruleId: 'active_recovery',
      category: 'recovery',
      priority: 3,
      tone: 'positive',
      title: `${a.training.sessionsLast4Days} séances en 4 jours. Très bien.`,
      message: 'Demain, récupération active plutôt qu’une séance intense : marche, mobilité, sommeil.',
      reason: `${a.training.consecutiveTrainingDays} jour(s) d’entraînement d’affilée.`,
      actions: ['20 min de marche', '10 min de mobilité'],
    });
  }

  // ——— 10. Protéines insuffisantes ———
  if (a.nutrition.daysLogged7 >= 4 && (a.nutrition.proteinRatio7 ?? 1) < 0.85) {
    const missing = Math.round(a.targets.protein - (a.nutrition.avgProtein7 ?? 0));
    out.push({
      id: id('protein'),
      ruleId: 'protein_low',
      category: 'nutrition',
      priority: 3,
      tone: 'neutral',
      title: 'Protéines régulièrement sous l’objectif',
      message: `Il te manque en moyenne ${missing} g par jour. Voici trois options simples pour corriger ça :`,
      reason: `Moyenne ${Math.round(a.nutrition.avgProtein7!)} g / ${a.targets.protein} g sur ${a.nutrition.daysLogged7} jours suivis.`,
      actions: proteinOptions(p),
    });
  }

  // ——— 11. Sommeil ———
  if ((a.recovery.avgSleep7 ?? 9) < 6.5 && a.recovery.checkIns7 >= 3) {
    out.push({
      id: id('sleep'),
      ruleId: 'sleep_low',
      category: 'recovery',
      priority: 3,
      tone: 'neutral',
      title: 'Ton sommeil freine tes progrès',
      message: 'Moins de 6 h 30 par nuit augmente la faim et réduit la récupération. Objectif : +30 min cette semaine.',
      reason: `Moyenne ${f1(a.recovery.avgSleep7!)} h sur ${a.recovery.checkIns7} nuits.`,
      actions: ['Écrans coupés 30 min avant le coucher', `Se coucher vers ${p.bedtime}`, 'Pas de caféine après 14 h'],
    });
  }

  // ——— 12. Hydratation ———
  if (a.activity.avgWater7 !== undefined && a.activity.avgWater7 < a.targets.waterMl * 0.6) {
    out.push({
      id: id('water'),
      ruleId: 'water_low',
      category: 'habit',
      priority: 4,
      tone: 'neutral',
      title: 'Hydratation à améliorer',
      message: 'Un verre au réveil, un à chaque repas, une gourde pendant la séance : c’est déjà 1,5 L.',
      reason: `Moyenne ${round(a.activity.avgWater7, 50)} ml / ${a.targets.waterMl} ml.`,
      actions: ['Gourde visible sur ton bureau', 'Un verre avant chaque repas'],
    });
  }

  // ——— 13. Activité quotidienne ———
  if (a.activity.stepsDays7 >= 4 && (a.activity.avgSteps7 ?? 0) < a.targets.steps * 0.7) {
    out.push({
      id: id('steps'),
      ruleId: 'steps_low',
      category: 'habit',
      priority: 4,
      tone: 'neutral',
      title: 'Bouge un peu plus au quotidien',
      message: 'Les pas comptent souvent plus que la séance pour la dépense totale. Ajoute 10 minutes de marche après un repas.',
      reason: `Moyenne ${round(a.activity.avgSteps7!, 100).toLocaleString('fr-FR')} pas / objectif ${a.targets.steps.toLocaleString('fr-FR')}.`,
      actions: ['10 min de marche après le déjeuner', 'Escaliers plutôt qu’ascenseur'],
    });
  }

  // ——— 14. Motivation / régularité ———
  if ((a.recovery.avgMotivation5 ?? 10) <= 4) {
    out.push({
      id: id('motivation'),
      ruleId: 'motivation_low',
      category: 'motivation',
      priority: 3,
      tone: 'positive',
      title: 'Motivation en baisse ? Normal.',
      message: 'La motivation va et vient, les habitudes restent. Cette semaine, on vise le minimum : une action par jour.',
      reason: `Motivation moyenne ${f1(a.recovery.avgMotivation5!)}/10.`,
      actions: ['Version courte de chaque séance (20 min)', 'Garder seulement le check-in du matin'],
    });
  }
  if (a.adherence >= 0.8 && a.nutrition.daysLogged7 >= 6) {
    out.push({
      id: id('consistency'),
      ruleId: 'consistency',
      category: 'motivation',
      priority: 5,
      tone: 'positive',
      title: 'Régularité exemplaire',
      message: 'C’est exactement comme ça que les résultats arrivent. Continue sur ce rythme.',
      reason: `Suivi ${a.nutrition.daysLogged7}/7 jours, régularité globale ${Math.round(a.adherence * 100)} %.`,
      actions: [],
    });
  }

  // ——— Difficulté récurrente ———
  const top = a.difficulties[0];
  if (top && top.count >= 3) {
    const tips: Record<string, [string, string[]]> = {
      time: ['Manque de temps', ['Séances de 20 min en circuit', 'Préparer les repas en lot le dimanche']],
      hunger: ['Faim fréquente', ['Plus de protéines et de fibres à chaque repas', 'Grand verre d’eau avant de manger', 'Légumes à volonté']],
      motivation: ['Motivation', ['Programme ta séance comme un rendez-vous', 'Commence par 5 minutes, tu verras ensuite']],
      fatigue: ['Fatigue', ['Prioriser le sommeil', 'Séances plus courtes cette semaine']],
      stress: ['Stress', ['Marche de 15 min', 'Respiration carrée 3 min le soir']],
      social: ['Repas sociaux', ['Choisir une protéine + légumes au restaurant', 'Profiter sans culpabiliser : c’est la moyenne qui compte']],
      pain: ['Douleurs', ['Adapter les exercices', 'Consulter un professionnel']],
    };
    const [label, actions] = tips[top.kind] ?? ['Difficulté', []];
    out.push({
      id: id(`difficulty_${top.kind}`),
      ruleId: 'difficulty',
      category: 'habit',
      priority: 3,
      tone: 'neutral',
      title: `${label} : on s’adapte`,
      message: 'Tu as signalé cette difficulté plusieurs fois. Voici comment on peut la contourner :',
      reason: `Signalée ${top.count} fois en 14 jours.`,
      actions,
    });
  }

  return out
    .filter((i) => !state.dismissedInsights.includes(i.id))
    .sort((x, y) => x.priority - y.priority);
}

function proteinOptions(p: UserProfile): string[] {
  const veg = p.diet === 'vegetarian' || p.diet === 'vegan';
  if (p.diet === 'vegan') return ['Tofu ou tempeh au déjeuner (+20 g)', 'Shaker de protéine de pois (+24 g)', 'Lentilles ou pois chiches au dîner (+15 g)'];
  if (veg) return ['Skyr ou fromage blanc en collation (+20 g)', '2 œufs de plus au petit-déjeuner (+13 g)', 'Lentilles ou tofu au dîner (+15 g)'];
  return ['Skyr en collation (+20 g)', 'Une boîte de thon ou du poulet au déjeuner (+25 g)', '2 œufs au petit-déjeuner (+13 g)'];
}

/** Applique une adaptation acceptée, en respectant les bornes. */
export function applyAdjustment(current: CoachAdjustments, insight: CoachInsight, today: ISODate): CoachAdjustments {
  const adj = insight.adjustment ?? {};
  return {
    kcalDelta: clamp(current.kcalDelta + (adj.kcalDelta ?? 0), LIMITS.kcalDelta.min, LIMITS.kcalDelta.max),
    stepsDelta: clamp(current.stepsDelta + (adj.stepsDelta ?? 0), LIMITS.stepsDelta.min, LIMITS.stepsDelta.max),
    volumeModifier:
      adj.volumeModifier !== undefined ? clamp(adj.volumeModifier, LIMITS.volume.min, LIMITS.volume.max) : current.volumeModifier,
    sessionReduction:
      adj.sessionReduction !== undefined
        ? clamp(adj.sessionReduction, LIMITS.sessionReduction.min, LIMITS.sessionReduction.max)
        : current.sessionReduction,
    updatedAt: new Date().toISOString(),
    history: [
      { date: today, ruleId: insight.ruleId, title: insight.title, reason: insight.reason },
      ...current.history,
    ].slice(0, 50),
  };
}

/** Le volume temporaire revient progressivement vers 1 chaque semaine. */
export function decayAdjustments(current: CoachAdjustments): CoachAdjustments {
  const towardsOne = (v: number) => (Math.abs(v - 1) < 0.06 ? 1 : v + (1 - v) * 0.5);
  return {
    ...current,
    volumeModifier: round(towardsOne(current.volumeModifier), 0.05),
    sessionReduction: Math.max(0, current.sessionReduction - 1),
  };
}

export const defaultAdjustments = (): CoachAdjustments => ({
  kcalDelta: 0,
  stepsDelta: 0,
  volumeModifier: 1,
  sessionReduction: 0,
  updatedAt: new Date().toISOString(),
  history: [],
});

