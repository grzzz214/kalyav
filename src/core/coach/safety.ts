import type { MorningCheckIn, PainReport } from '../types';

export const MEDICAL_DISCLAIMER =
  'Les recommandations de l’application sont générales et ne remplacent pas l’avis d’un médecin ou d’un professionnel de santé. En cas de doute, de pathologie, de grossesse ou de traitement, consulte avant de commencer.';

export const EMERGENCY_NOTE =
  'Douleur thoracique, essoufflement inhabituel, malaise, vertiges ou palpitations : arrête immédiatement l’effort et appelle le 15 (SAMU) ou le 112.';

export type TrainingClearance = 'ok' | 'lighter' | 'recovery' | 'rest';

export interface SafetyDecision {
  clearance: TrainingClearance;
  messages: string[];
  seeProfessional: boolean;
}

/**
 * Décide si l'entraînement du jour peut avoir lieu. La règle est
 * conservatrice : en cas de doute, la récupération l'emporte.
 */
export function trainingClearance(checkIn?: MorningCheckIn, recentPainDays = 0): SafetyDecision {
  if (!checkIn) return { clearance: 'ok', messages: [], seeProfessional: false };
  const msgs: string[] = [];
  const pain: PainReport | null = checkIn.pain;

  if (pain?.alarming || pain?.area === 'chest') {
    return {
      clearance: 'rest',
      messages: ['Symptôme à prendre au sérieux : aucun effort aujourd’hui.', EMERGENCY_NOTE],
      seeProfessional: true,
    };
  }
  if (pain && pain.intensity >= 7) {
    return {
      clearance: 'rest',
      messages: ['Douleur importante : repos aujourd’hui. On ne s’entraîne jamais sur une douleur forte.', 'Si elle persiste plus de 48 h ou s’aggrave, consulte un professionnel de santé.'],
      seeProfessional: true,
    };
  }
  if (pain && pain.intensity >= 4) {
    msgs.push('Douleur modérée : séance de récupération sans solliciter la zone concernée.');
    if (recentPainDays >= 3) msgs.push('Cette douleur revient : un avis médical ou kiné est recommandé.');
    return { clearance: 'recovery', messages: msgs, seeProfessional: recentPainDays >= 3 };
  }
  if (checkIn.fatigue >= 8 || checkIn.sleepHours < 5 || checkIn.energy <= 2) {
    return { clearance: 'recovery', messages: ['Fatigue élevée : récupération active aujourd’hui, tu progresseras mieux demain.'], seeProfessional: false };
  }
  if (checkIn.fatigue >= 6 || checkIn.sleepHours < 6 || checkIn.energy <= 4 || (pain && pain.intensity > 0)) {
    return {
      clearance: 'lighter',
      messages: [pain && pain.intensity > 0 ? 'Légère gêne : version allégée, en évitant la zone sensible.' : 'Énergie un peu basse : version allégée de ta séance.'],
      seeProfessional: false,
    };
  }
  return { clearance: 'ok', messages: [], seeProfessional: false };
}

/** Bornes de saisie pour éviter des objectifs dangereux dès l'onboarding. */
export function validateTargetWeight(heightCm: number, targetKg: number): string | null {
  const m = heightCm / 100;
  const bmi = targetKg / (m * m);
  if (bmi < 18.5) {
    return `Ce poids cible correspond à un IMC de ${bmi.toFixed(1)}, sous le seuil de santé (18,5). Choisis un objectif d’au moins ${Math.ceil(18.5 * m * m)} kg ou parles-en à un professionnel.`;
  }
  return null;
}
