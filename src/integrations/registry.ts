import type { ConversationalCoach, FoodDatabase, HealthDataProvider, SmartScaleProvider } from './types';
import { openFoodFacts } from './openFoodFacts';

/**
 * Registre central des intégrations. Pour brancher Apple Health ou
 * Health Connect : implémenter `HealthDataProvider` (ex. avec
 * react-native-health / react-native-health-connect dans un development
 * build) puis l'ajouter à `healthProviders`.
 */
export interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'planned';
}

export const healthProviders: HealthDataProvider[] = [];
export const scaleProviders: SmartScaleProvider[] = [];
export const foodDatabases: FoodDatabase[] = [openFoodFacts];
export let conversationalCoach: ConversationalCoach | null = null;

export function registerConversationalCoach(c: ConversationalCoach) {
  conversationalCoach = c;
}

export const INTEGRATIONS: IntegrationInfo[] = [
  { id: 'open_food_facts', name: 'Open Food Facts', description: 'Scanner de code-barres et base alimentaire mondiale', status: 'active' },
  { id: 'apple_health', name: 'Apple Santé', description: 'Pas, sommeil, poids et séances', status: 'planned' },
  { id: 'health_connect', name: 'Health Connect / Google Fit', description: 'Pas, sommeil, poids et séances', status: 'planned' },
  { id: 'watches', name: 'Montres connectées', description: 'Garmin, Fitbit, Polar via Santé / Health Connect', status: 'planned' },
  { id: 'scale', name: 'Balance connectée', description: 'Poids, masse grasse, masse musculaire', status: 'planned' },
  { id: 'llm', name: 'IA conversationnelle', description: 'Discussion libre avec le coach (modèle de langage)', status: 'planned' },
  { id: 'community', name: 'Communauté & challenges', description: 'Défis entre amis, classements bienveillants', status: 'planned' },
];
