import type { AppState } from '../types';
import type { Analysis } from './analysis';
import type { CoachInsight } from './adaptationEngine';
import { EMERGENCY_NOTE, MEDICAL_DISCLAIMER } from './safety';

/**
 * Coach conversationnel hors-ligne, à base d'intentions. L'interface
 * `ConversationalCoach` (voir integrations) permet de brancher plus tard
 * un modèle de langage en lui passant le même contexte (analyse + profil).
 */
export interface ChatMessage {
  id: string;
  from: 'user' | 'coach';
  text: string;
  at: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export const QUICK_QUESTIONS = [
  'Que dois-je faire aujourd’hui ?',
  'Pourquoi mon poids stagne ?',
  'Je suis fatigué',
  'Comment manger plus de protéines ?',
  'J’ai mal au genou',
  'Je n’ai pas de motivation',
];

export function coachReply(input: string, state: AppState, a: Analysis, insights: CoachInsight[]): string {
  const t = norm(input);
  const p = state.profile!;
  const r = (n?: number, d = 1) => (n === undefined ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR'));

  if (has(t, ['poitrine', 'thorac', 'malaise', 'vertige', 'essouffl', 'palpitation', 'evanoui'])) {
    return `${EMERGENCY_NOTE}\n\nNe reprends l’entraînement qu’après avis médical.`;
  }
  if (has(t, ['mal ', 'douleur', 'blesse', 'blessure', 'tendin', 'entorse', 'mal au', 'mal a '])) {
    return [
      'Merci de me le dire. Règle n°1 : on ne s’entraîne jamais sur une douleur importante.',
      '• Indique la zone dans ton check-in du matin : je retirerai automatiquement les exercices qui la sollicitent.',
      '• Sur chaque exercice, le bouton « Je ne peux pas faire cet exercice » te propose une alternative sans cette zone.',
      '• Si la douleur dépasse 48 h, s’aggrave, ou gêne au repos : consulte un médecin ou un kiné.',
      '',
      MEDICAL_DISCLAIMER,
    ].join('\n');
  }
  if (has(t, ['fatigu', 'creve', 'epuise', 'pas d energie', 'dormi', 'sommeil'])) {
    const sleep = a.recovery.avgSleep7;
    return [
      sleep !== undefined ? `Ton sommeil moyen cette semaine : ${r(sleep)} h (objectif ${a.targets.sleepHours} h).` : 'Je n’ai pas encore assez de données de sommeil : fais ton check-in du matin.',
      'Aujourd’hui, ouvre ta séance et touche « Je suis fatigué aujourd’hui » : je réduis le volume ou je la transforme en récupération active.',
      'Pour ce soir : écrans coupés 30 min avant le coucher, dîner léger, chambre fraîche.',
    ].join('\n');
  }
  if (has(t, ['stagn', 'plateau', 'bouge pas', 'perds pas', 'perd pas', 'poids'])) {
    const w = a.weight;
    return [
      w.slope14 !== undefined ? `Tendance sur 14 jours : ${w.slope14 > 0 ? '+' : ''}${r(w.slope14, 2)} kg/semaine.` : 'Pèse-toi 3 à 4 matins par semaine pour que je puisse lire ta tendance.',
      w.plateauDays ? `Stagnation détectée depuis ${w.plateauDays} jours.` : 'Pas de vraie stagnation détectée : le poids varie naturellement de ±1 kg d’un jour à l’autre (eau, sel, digestion).',
      `Ta régularité : nutrition suivie ${a.nutrition.daysLogged14}/14 jours, séances ${a.training.done14}/${a.training.planned14 || '—'}.`,
      'Avant de baisser les calories, on vérifie : suivi précis des repas, pas quotidiens, sommeil. Je n’ajuste les apports qu’après 3 semaines de plateau avec une bonne régularité.',
    ].join('\n');
  }
  if (has(t, ['proteine', 'proteines', 'prot'])) {
    const avg = a.nutrition.avgProtein7;
    const veg = p.diet === 'vegan' || p.diet === 'vegetarian';
    return [
      `Ton objectif : ${a.targets.protein} g/jour.${avg !== undefined ? ` Moyenne actuelle : ${Math.round(avg)} g.` : ''}`,
      'Une source de protéines à chaque repas, c’est la règle simple :',
      veg
        ? '• Petit-déj : skyr/yaourt soja + avoine\n• Midi : lentilles, tofu ou tempeh\n• Collation : fromage blanc ou shaker de pois\n• Soir : œufs, seitan ou pois chiches'
        : '• Petit-déj : œufs ou skyr\n• Midi : poulet, poisson ou bœuf 5 %\n• Collation : fromage blanc ou une barre protéinée\n• Soir : poisson, tofu ou viande maigre',
      'Le générateur de repas (onglet Nutrition) te propose des repas calés sur tes protéines restantes.',
    ].join('\n');
  }
  if (has(t, ['motiv', 'envie', 'flemme', 'abandonn', 'decourag'])) {
    return [
      'C’est normal : la motivation fluctue chez tout le monde. Ce qui compte, c’est le minimum non négociable.',
      '• Aujourd’hui : fais seulement 10 minutes. Souvent, la suite vient toute seule.',
      '• Garde ta série : un check-in suffit à la maintenir.',
      `• Rappelle-toi pourquoi tu as commencé : ${p.goal === 'fat_loss' ? 'te sentir mieux dans ton corps' : 'devenir plus fort et en forme'}.`,
      'Je ne te jugerai jamais sur une mauvaise journée. On regarde la tendance, pas le détail.',
    ].join('\n');
  }
  if (has(t, ['faim', 'fringale', 'craquer', 'grignot'])) {
    return [
      'La faim est un signal utile. Pour la calmer sans dépasser :',
      '• Protéines + fibres à chaque repas (légumes, légumineuses).',
      '• Un grand verre d’eau avant de manger.',
      '• Une collation prévue (skyr + fruit) plutôt qu’un grignotage subi.',
      'Si la faim est constante, ton déficit est peut-être trop fort : dis-le dans le bilan du soir, j’ajusterai.',
    ].join('\n');
  }
  if (has(t, ['aujourd', 'faire', 'programme', 'seance', 'quoi'])) {
    const top = insights[0];
    return [
      `Ton cap : ${a.targets.kcal} kcal, ${a.targets.protein} g de protéines, ${(a.targets.waterMl / 1000).toFixed(1).replace('.', ',')} L d’eau, ${a.targets.steps.toLocaleString('fr-FR')} pas.`,
      'Ta séance du jour est sur l’accueil, déjà adaptée à ton check-in.',
      top ? `Mon conseil prioritaire : ${top.title}. ${top.message}` : 'Rien d’alarmant dans tes tendances : continue ton plan.',
    ].join('\n');
  }
  if (has(t, ['alcool', 'biere', 'vin', 'soiree', 'restaurant'])) {
    return 'Une soirée ne ruine pas une semaine. Choisis un plat avec une protéine et des légumes, alterne un verre d’alcool avec un verre d’eau, et reprends normalement le lendemain sans compenser en jeûnant.';
  }
  if (has(t, ['regime', 'jeune', 'secher vite', 'perdre vite', '1000 kcal', '800 kcal'])) {
    return `Je ne recommande pas les régimes très restrictifs : perte musculaire, fatigue, reprise de poids. Ton plancher calculé est de ${a.targets.floorKcal} kcal et une perte durable se situe entre 0,5 et 1 % de ton poids par semaine.`;
  }
  return [
    'Je peux t’aider sur : ton programme du jour, ta nutrition, la stagnation du poids, la fatigue, les douleurs ou la motivation.',
    insights[0] ? `En ce moment, je surveille surtout : « ${insights[0].title} ».` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
