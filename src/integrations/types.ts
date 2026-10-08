import type { AppState, Food, ISODate, Measurement, WeightEntry } from '../core/types';
import type { Analysis } from '../core/coach/analysis';
import type { ChatMessage } from '../core/coach/chat';

/**
 * Contrats des intégrations externes. Chaque source de données implémente
 * l'interface qui la concerne et s'enregistre dans `registry.ts` :
 * le reste de l'application ne dépend jamais d'un fournisseur précis.
 */

export interface DailyMetric {
  date: ISODate;
  value: number;
}

export interface ExternalWorkout {
  date: ISODate;
  type: string;
  durationMin: number;
  kcal?: number;
  distanceKm?: number;
}

/** Apple Health, Google Fit / Health Connect, montres connectées. */
export interface HealthDataProvider {
  id: 'apple_health' | 'health_connect' | 'garmin' | 'fitbit' | 'withings' | string;
  name: string;
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  readSteps(from: ISODate, to: ISODate): Promise<DailyMetric[]>;
  readSleepHours?(from: ISODate, to: ISODate): Promise<DailyMetric[]>;
  readWeights?(from: ISODate, to: ISODate): Promise<WeightEntry[]>;
  readWorkouts?(from: ISODate, to: ISODate): Promise<ExternalWorkout[]>;
  readRestingHeartRate?(from: ISODate, to: ISODate): Promise<DailyMetric[]>;
}

/** Balance connectée (poids + composition corporelle). */
export interface SmartScaleProvider {
  id: string;
  name: string;
  readMeasurements(from: ISODate, to: ISODate): Promise<(Measurement & { weightKg: number })[]>;
}

/** Bases alimentaires (code-barres, recherche en ligne, reconnaissance photo). */
export interface FoodDatabase {
  id: string;
  name: string;
  findByBarcode(code: string): Promise<Food | null>;
  search?(query: string): Promise<Food[]>;
}

/** IA conversationnelle : reçoit le même contexte que le coach hors-ligne. */
export interface ConversationalCoach {
  id: string;
  reply(history: ChatMessage[], context: { state: AppState; analysis: Analysis }): Promise<string>;
}

/** Communauté et challenges (fonctionnalités futures). */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  startsOn: ISODate;
  endsOn: ISODate;
  metric: 'workouts' | 'steps' | 'checkins' | 'nutrition_days';
  target: number;
}

export interface CommunityService {
  listChallenges(): Promise<Challenge[]>;
  joinChallenge(id: string): Promise<void>;
}
