/**
 * Modèle de données du domaine. Ce dossier `core` est du TypeScript pur
 * (aucune dépendance React Native) : il peut être testé, réutilisé côté
 * serveur ou dans un futur worker de recommandations.
 */

export type ISODate = string; // 'YYYY-MM-DD' (date locale)

export type Sex = 'male' | 'female';

export type Goal =
  | 'fat_loss'
  | 'muscle_gain'
  | 'recomposition'
  | 'endurance'
  | 'cardio'
  | 'strength'
  | 'mobility'
  | 'general_fitness';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export type Equipment =
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'bands'
  | 'pullup_bar'
  | 'bench'
  | 'machines'
  | 'cardio_machine'
  | 'jump_rope'
  | 'mat';

export type TrainingStyle = 'strength' | 'hiit' | 'cardio' | 'bodyweight' | 'mixed' | 'mobility';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Diet = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'no_pork';

export type Allergen =
  | 'gluten'
  | 'lactose'
  | 'nuts'
  | 'peanuts'
  | 'eggs'
  | 'fish'
  | 'shellfish'
  | 'soy'
  | 'sesame';

/** Zones articulaires / contraintes utilisées pour filtrer les exercices. */
export type Limitation =
  | 'knee'
  | 'lower_back'
  | 'shoulder'
  | 'wrist'
  | 'neck'
  | 'hip'
  | 'ankle'
  | 'no_jumping'
  | 'no_floor'
  | 'cardiac';

export interface UserProfile {
  firstName: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  targetWeightKg: number;
  level: Level;
  sessionsPerWeek: number;
  /** 0 = lundi … 6 = dimanche */
  availableDays: number[];
  sessionMinutes: number;
  preferredStyles: TrainingStyle[];
  equipment: Equipment[];
  diet: Diet;
  eatingHabits: string;
  mealsPerDay: number;
  allergies: Allergen[];
  likedFoods: string[];
  dislikedFoods: string[];
  /** 'HH:MM' */
  bedtime: string;
  wakeTime: string;
  /** heure d'entraînement préférée 'HH:MM' */
  trainingTime: string;
  occupation: string;
  activityLevel: ActivityLevel;
  limitations: Limitation[];
  limitationNotes: string;
  createdAt: string;
}

export interface NutritionTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  steps: number;
  sleepHours: number;
  /** explications lisibles des calculs */
  notes: string[];
  bmr: number;
  tdee: number;
  floorKcal: number;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLogEntry extends Macros {
  id: string;
  date: ISODate;
  slot: MealSlot;
  name: string;
  quantityLabel: string;
  foodId?: string;
  recipeId?: string;
  createdAt: string;
}

export interface WeightEntry {
  date: ISODate;
  kg: number;
}

export interface Measurement {
  date: ISODate;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
}

export type PainArea = 'knee' | 'lower_back' | 'shoulder' | 'wrist' | 'neck' | 'hip' | 'ankle' | 'chest' | 'other';

export interface PainReport {
  area: PainArea;
  /** 0 – 10 */
  intensity: number;
  /** douleur thoracique, essoufflement anormal, malaise… */
  alarming?: boolean;
}

export interface MorningCheckIn {
  date: ISODate;
  sleepHours: number;
  /** 1 – 5 */
  sleepQuality: number;
  energy: number;
  fatigue: number;
  motivation: number;
  pain: PainReport | null;
  weightKg?: number;
  createdAt: string;
}

export type TriState = 'yes' | 'partial' | 'no';

export type Difficulty = 'none' | 'time' | 'hunger' | 'motivation' | 'fatigue' | 'pain' | 'social' | 'stress';

export interface EveningCheckIn {
  date: ISODate;
  trainingDone: TriState;
  nutritionRespected: TriState;
  waterMl: number;
  /** 1 – 5 */
  mood: number;
  difficulty: Difficulty;
  note?: string;
  createdAt: string;
}

export interface DailyActivity {
  date: ISODate;
  steps: number;
  waterMl: number;
  /** minutes de cardio hors séance (marche rapide, vélo…) */
  activeMinutes?: number;
  distanceKm?: number;
}

export interface SetLog {
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  distanceKm?: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  date: ISODate;
  plannedSessionId?: string;
  title: string;
  sessionType: SessionType;
  durationMin: number;
  kcal: number;
  /** effort perçu 1 – 10 */
  rpe: number;
  completed: boolean;
  fatigueMode: boolean;
  exercises: ExerciseLog[];
  createdAt: string;
}

export type SessionType =
  | 'full_body'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'hiit'
  | 'cardio_z2'
  | 'intervals'
  | 'mobility'
  | 'recovery'
  | 'core';

export interface PrescribedExercise {
  exerciseId: string;
  sets: number;
  /** ex. '8-12', '30 s', '5' */
  reps: string;
  restSec: number;
  /** durée de travail par série si l'exercice est chronométré */
  workSec?: number;
  note?: string;
  /** remplacé suite à « je ne peux pas faire cet exercice » */
  swappedFrom?: string;
}

export interface PlannedSession {
  id: string;
  /** 0 = lundi … 6 = dimanche */
  dayIndex: number;
  date: ISODate;
  type: SessionType;
  title: string;
  focus: string;
  durationMin: number;
  difficulty: 1 | 2 | 3;
  warmup: string[];
  exercises: PrescribedExercise[];
  cooldown: string[];
  estimatedKcal: number;
  /** séance allégée (fatigue/douleur) */
  adapted?: 'fatigue' | 'pain' | 'recovery';
}

export interface WeeklyPlan {
  weekStart: ISODate;
  goal: Goal;
  /** 0.6 = semaine très légère, 1 = normal, 1.1 = progression */
  volumeModifier: number;
  sessions: PlannedSession[];
  rationale: string[];
  createdAt: string;
}

export interface CoachAdjustments {
  /** delta cumulé appliqué aux calories de base, borné */
  kcalDelta: number;
  stepsDelta: number;
  volumeModifier: number;
  /** nombre de séances temporairement retirées */
  sessionReduction: number;
  updatedAt: string;
  history: AppliedAdaptation[];
}

export interface AppliedAdaptation {
  date: ISODate;
  ruleId: string;
  title: string;
  reason: string;
}

export interface ReminderConfig {
  id: ReminderKind;
  label: string;
  /** 'HH:MM' */
  time: string;
  enabled: boolean;
  message: string;
}

export type ReminderKind = 'wake' | 'water' | 'lunch' | 'training' | 'nutrition_review' | 'sleep' | 'checkin';

export interface ReminderStats {
  /** dates où le rappel a été planifié */
  scheduled: ISODate[];
  /** dates où l'action associée a été réalisée */
  acted: ISODate[];
  /** heures ('HH:MM') auxquelles l'utilisateur fait réellement l'action */
  actualTimes: string[];
  /** proposition de changement déjà refusée jusqu'à cette date */
  snoozedUntil?: ISODate;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: { foodId: string; grams: number }[];
  prepMinutes: number;
  /** 1 économique – 3 plus cher */
  cost: 1 | 2 | 3;
  tags: MealTag[];
  slots: MealSlot[];
  steps: string[];
  custom?: boolean;
}

export type MealTag = 'quick' | 'budget' | 'high_protein' | 'vegetarian' | 'gourmet' | 'meal_prep';

export interface Food {
  id: string;
  name: string;
  /** valeurs pour 100 g (ou 100 ml) */
  per100: Macros;
  /** portion usuelle */
  portion: { label: string; grams: number };
  category: FoodCategory;
  allergens: Allergen[];
  barcode?: string;
  custom?: boolean;
}

export type FoodCategory =
  | 'meat'
  | 'pork'
  | 'poultry'
  | 'fish'
  | 'seafood'
  | 'egg'
  | 'dairy'
  | 'legume'
  | 'grain'
  | 'vegetable'
  | 'fruit'
  | 'fat'
  | 'nut'
  | 'plant_protein'
  | 'snack'
  | 'drink';

export interface WeeklyReview {
  weekStart: ISODate;
  weekEnd: ISODate;
  startWeight?: number;
  endWeight?: number;
  weightChange?: number;
  workoutsDone: number;
  workoutsPlanned: number;
  avgKcal?: number;
  avgProtein?: number;
  nutritionDaysLogged: number;
  avgSleep?: number;
  avgSteps?: number;
  checkIns: number;
  positives: string[];
  weaknesses: string[];
  recommendations: string[];
  createdAt: string;
}

export interface AppState {
  profile: UserProfile | null;
  weights: WeightEntry[];
  measurements: Measurement[];
  foodLog: FoodLogEntry[];
  morningCheckIns: MorningCheckIn[];
  eveningCheckIns: EveningCheckIn[];
  activity: DailyActivity[];
  workouts: WorkoutLog[];
  plans: WeeklyPlan[];
  reviews: WeeklyReview[];
  adjustments: CoachAdjustments;
  reminders: ReminderConfig[];
  reminderStats: Partial<Record<ReminderKind, ReminderStats>>;
  customFoods: Food[];
  customRecipes: Recipe[];
  favoriteFoodIds: string[];
  /** ids d'adaptations déjà vues/acceptées par l'utilisateur */
  dismissedInsights: string[];
}
