import type {
  ActivityLevel,
  Allergen,
  Diet,
  Difficulty,
  Equipment,
  Goal,
  Level,
  Limitation,
  MealSlot,
  PainArea,
  Sex,
  TrainingStyle,
} from '../core/types';
import { GOAL_LABELS } from '../core/training/programGenerator';

type Opt<T> = { id: T; label: string }[];

export const SEX_OPTIONS: Opt<Sex> = [
  { id: 'female', label: 'Femme' },
  { id: 'male', label: 'Homme' },
];

export const GOAL_OPTIONS: Opt<Goal> = (Object.keys(GOAL_LABELS) as Goal[]).map((id) => ({ id, label: GOAL_LABELS[id] }));

export const GOAL_EMOJI: Record<Goal, string> = {
  fat_loss: '🔥',
  muscle_gain: '💪',
  recomposition: '⚖️',
  endurance: '🏃',
  cardio: '❤️',
  strength: '🏋️',
  mobility: '🧘',
  general_fitness: '✨',
};

export const LEVEL_OPTIONS: Opt<Level> = [
  { id: 'beginner', label: 'Débutant' },
  { id: 'intermediate', label: 'Intermédiaire' },
  { id: 'advanced', label: 'Avancé' },
];

export const STYLE_OPTIONS: Opt<TrainingStyle> = [
  { id: 'strength', label: 'Musculation' },
  { id: 'bodyweight', label: 'Poids du corps' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'mixed', label: 'Mixte' },
  { id: 'mobility', label: 'Mobilité / yoga' },
];

export const EQUIPMENT_OPTIONS: Opt<Equipment> = [
  { id: 'dumbbells', label: 'Haltères' },
  { id: 'barbell', label: 'Barre' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'bands', label: 'Élastiques' },
  { id: 'pullup_bar', label: 'Barre de traction' },
  { id: 'bench', label: 'Banc' },
  { id: 'machines', label: 'Machines (salle)' },
  { id: 'cardio_machine', label: 'Vélo / rameur / tapis' },
  { id: 'jump_rope', label: 'Corde à sauter' },
  { id: 'mat', label: 'Tapis' },
];

export const GYM_EQUIPMENT: Equipment[] = ['dumbbells', 'barbell', 'kettlebell', 'bands', 'pullup_bar', 'bench', 'machines', 'cardio_machine', 'mat'];

export const ACTIVITY_OPTIONS: Opt<ActivityLevel> = [
  { id: 'sedentary', label: 'Sédentaire (bureau, peu de marche)' },
  { id: 'light', label: 'Légèrement actif' },
  { id: 'moderate', label: 'Modérément actif (debout souvent)' },
  { id: 'active', label: 'Actif (métier physique)' },
  { id: 'very_active', label: 'Très actif' },
];

export const DIET_OPTIONS: Opt<Diet> = [
  { id: 'omnivore', label: 'Omnivore' },
  { id: 'no_pork', label: 'Sans porc' },
  { id: 'pescatarian', label: 'Pescétarien' },
  { id: 'vegetarian', label: 'Végétarien' },
  { id: 'vegan', label: 'Végan' },
];

export const ALLERGEN_OPTIONS: Opt<Allergen> = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'lactose', label: 'Lactose' },
  { id: 'nuts', label: 'Fruits à coque' },
  { id: 'peanuts', label: 'Arachide' },
  { id: 'eggs', label: 'Œufs' },
  { id: 'fish', label: 'Poisson' },
  { id: 'shellfish', label: 'Crustacés' },
  { id: 'soy', label: 'Soja' },
  { id: 'sesame', label: 'Sésame' },
];

export const LIMITATION_OPTIONS: Opt<Limitation> = [
  { id: 'knee', label: 'Genoux' },
  { id: 'lower_back', label: 'Bas du dos' },
  { id: 'shoulder', label: 'Épaules' },
  { id: 'wrist', label: 'Poignets' },
  { id: 'neck', label: 'Nuque' },
  { id: 'hip', label: 'Hanches' },
  { id: 'ankle', label: 'Chevilles' },
  { id: 'no_jumping', label: 'Pas de sauts / impacts' },
  { id: 'no_floor', label: 'Pas d’exercices au sol' },
  { id: 'cardiac', label: 'Pas d’effort intense (cardio / tension)' },
];

export const PAIN_OPTIONS: Opt<PainArea> = [
  { id: 'knee', label: 'Genou' },
  { id: 'lower_back', label: 'Bas du dos' },
  { id: 'shoulder', label: 'Épaule' },
  { id: 'wrist', label: 'Poignet' },
  { id: 'neck', label: 'Nuque' },
  { id: 'hip', label: 'Hanche' },
  { id: 'ankle', label: 'Cheville' },
  { id: 'chest', label: 'Poitrine' },
  { id: 'other', label: 'Autre' },
];

export const DIFFICULTY_OPTIONS: Opt<Difficulty> = [
  { id: 'none', label: 'Aucune' },
  { id: 'time', label: 'Manque de temps' },
  { id: 'hunger', label: 'Faim' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'stress', label: 'Stress' },
  { id: 'social', label: 'Repas social' },
  { id: 'pain', label: 'Douleur' },
];

export const SLOT_OPTIONS: Opt<MealSlot> = [
  { id: 'breakfast', label: 'Petit-déj' },
  { id: 'lunch', label: 'Déjeuner' },
  { id: 'snack', label: 'Collation' },
  { id: 'dinner', label: 'Dîner' },
];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
};

export function defaultSlot(now = new Date()): MealSlot {
  const h = now.getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export const DIFFICULTY_STARS = (d: 1 | 2 | 3) => '●'.repeat(d) + '○'.repeat(3 - d);
