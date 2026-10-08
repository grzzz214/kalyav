import type { Diet, Food, Macros, MealSlot, MealTag, Recipe, UserProfile } from '../types';
import { RECIPES } from './recipes';
import { getFood, isFoodAllowed, macrosFor } from './foods';
import { addMacros, emptyMacros, roundMacros } from './calculator';
import { clamp } from '../utils/stats';

export type MealMode = 'quick' | 'budget' | 'high_protein' | 'vegetarian' | 'gourmet' | 'meal_prep';

export const MEAL_MODES: { id: MealMode; label: string; emoji: string }[] = [
  { id: 'quick', label: 'Rapide', emoji: '⚡' },
  { id: 'budget', label: 'Économique', emoji: '💶' },
  { id: 'high_protein', label: 'Riche en protéines', emoji: '💪' },
  { id: 'vegetarian', label: 'Végétarien', emoji: '🌱' },
  { id: 'gourmet', label: 'Gourmand', emoji: '😋' },
  { id: 'meal_prep', label: 'Meal prep', emoji: '🥡' },
];

export interface MealRequest {
  remaining: Macros;
  slot?: MealSlot;
  modes: MealMode[];
  maxMinutes?: number;
  /** 1 – 3 */
  maxCost?: number;
  /** ids d'aliments disponibles à la maison (optionnel) */
  availableFoodIds?: string[];
  profile: Pick<UserProfile, 'diet' | 'allergies' | 'dislikedFoods' | 'likedFoods'>;
  customFoods?: Food[];
  customRecipes?: Recipe[];
  /** pour varier les propositions */
  excludeRecipeIds?: string[];
}

export interface MealSuggestion {
  recipe: Recipe;
  portionFactor: number;
  ingredients: { food: Food; grams: number }[];
  macros: Macros;
  score: number;
  why: string[];
}

export function recipeMacros(recipe: Recipe, factor = 1, custom: Food[] = []): Macros {
  return recipe.ingredients.reduce((acc, ing) => {
    const food = getFood(ing.foodId, custom);
    return food ? addMacros(acc, macrosFor(food, ing.grams * factor)) : acc;
  }, emptyMacros());
}

function recipeAllowed(recipe: Recipe, profile: MealRequest['profile'], custom: Food[]): boolean {
  return recipe.ingredients.every((ing) => {
    const food = getFood(ing.foodId, custom);
    return food ? isFoodAllowed(food, profile) : false;
  });
}

const VEG_DIETS: Diet[] = ['vegetarian', 'vegan'];

/**
 * Propose jusqu'à `count` repas qui s'insèrent dans le budget restant.
 * Les portions sont ajustées (×0,6 à ×1,6) pour coller aux calories restantes
 * tout en maximisant les protéines.
 */
export function generateMeals(req: MealRequest, count = 3): MealSuggestion[] {
  const custom = req.customFoods ?? [];
  const pool = [...(req.customRecipes ?? []), ...RECIPES];
  const remainingKcal = Math.max(req.remaining.kcal, 0);
  const remainingProtein = Math.max(req.remaining.protein, 0);
  // Si presque plus de calories : proposer une collation légère plutôt que rien.
  const targetKcal = remainingKcal < 200 ? 200 : Math.min(remainingKcal, 1100);

  const candidates: MealSuggestion[] = [];
  for (const recipe of pool) {
    if (req.excludeRecipeIds?.includes(recipe.id)) continue;
    if (!recipeAllowed(recipe, req.profile, custom)) continue;
    if (req.slot && !recipe.slots.includes(req.slot)) continue;
    if (req.maxMinutes && recipe.prepMinutes > req.maxMinutes) continue;
    if (req.maxCost && recipe.cost > req.maxCost) continue;
    const wantsVeg = req.modes.includes('vegetarian') || VEG_DIETS.includes(req.profile.diet);
    if (wantsVeg && !recipe.tags.includes('vegetarian')) continue;
    if (req.modes.some((m) => m !== 'vegetarian' && !recipe.tags.includes(m as MealTag))) continue;

    const base = recipeMacros(recipe, 1, custom);
    if (base.kcal <= 0) continue;
    const factor = clamp(Math.round((targetKcal / base.kcal) * 10) / 10, 0.6, 1.6);
    const macros = roundMacros(recipeMacros(recipe, factor, custom));

    const why: string[] = [];
    let score = 0;
    // adéquation calories (pénalise surtout le dépassement)
    const over = macros.kcal - remainingKcal;
    score -= over > 0 ? over / 20 : Math.abs(over) / 60;
    // contribution protéique
    const proteinFit = remainingProtein > 0 ? Math.min(macros.protein / remainingProtein, 1.2) : 0.5;
    score += proteinFit * 30;
    if (proteinFit >= 0.8) why.push('Couvre l’essentiel de tes protéines restantes');
    // préférences
    const likes = req.profile.likedFoods.map((l) => l.toLowerCase()).filter(Boolean);
    const ingredients = recipe.ingredients
      .map((i) => ({ food: getFood(i.foodId, custom)!, grams: Math.round(i.grams * factor) }))
      .filter((i) => i.food);
    if (likes.some((l) => ingredients.some((i) => i.food.name.toLowerCase().includes(l)))) {
      score += 8;
      why.push('Contient des aliments que tu aimes');
    }
    if (req.availableFoodIds?.length) {
      const have = recipe.ingredients.filter((i) => req.availableFoodIds!.includes(i.foodId)).length;
      const ratio = have / recipe.ingredients.length;
      score += ratio * 20;
      if (ratio >= 0.75) why.push('Faisable avec ce que tu as');
    }
    if (recipe.prepMinutes <= 10) why.push(`Prêt en ${recipe.prepMinutes} min`);
    if (recipe.cost === 1) why.push('Petit budget');
    if (recipe.tags.includes('meal_prep')) why.push('Se prépare à l’avance');
    candidates.push({ recipe, portionFactor: factor, ingredients, macros, score, why });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, count);
}

export function remainingSummary(remaining: Macros): string {
  const kcal = Math.max(0, Math.round(remaining.kcal));
  const prot = Math.max(0, Math.round(remaining.protein));
  if (kcal < 100) return 'Tu as quasiment atteint ton objectif calorique. Si tu as faim, privilégie une option légère et protéinée.';
  return `Il te reste ${kcal} kcal et ${prot} g de protéines.`;
}
