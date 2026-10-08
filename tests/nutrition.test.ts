import { describe, expect, it } from 'vitest';
import { ABSOLUTE_FLOOR, bmrMifflin, computeTargets } from '../src/core/nutrition/calculator';
import { generateMeals } from '../src/core/nutrition/mealGenerator';
import { FOODS, getFood, isFoodAllowed, searchFoods } from '../src/core/nutrition/foods';
import { RECIPES } from '../src/core/nutrition/recipes';
import { makeProfile } from './fixtures';

describe('calculs nutritionnels', () => {
  it('calcule le métabolisme de base (Mifflin-St Jeor)', () => {
    expect(Math.round(bmrMifflin({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }))).toBe(1780);
    expect(Math.round(bmrMifflin({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 }))).toBe(1320);
  });

  it('crée un déficit modéré pour la perte de gras', () => {
    const t = computeTargets(makeProfile());
    expect(t.kcal).toBeLessThan(t.tdee);
    expect(t.tdee - t.kcal).toBeLessThanOrEqual(560);
    expect(t.protein).toBeGreaterThanOrEqual(150);
    // la somme des macros correspond aux calories (±5 %)
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(fromMacros - t.kcal) / t.kcal).toBeLessThan(0.05);
  });

  it('ne descend jamais sous le plancher de sécurité', () => {
    const tiny = makeProfile({ sex: 'female', weightKg: 48, heightCm: 152, age: 60, activityLevel: 'sedentary', sessionsPerWeek: 1, targetWeightKg: 45 });
    const t = computeTargets(tiny, { kcalDelta: -300 });
    expect(t.kcal).toBeGreaterThanOrEqual(ABSOLUTE_FLOOR.female);
    expect(t.kcal).toBeGreaterThanOrEqual(t.bmr - 10);
  });

  it('ajoute un surplus pour la prise de muscle', () => {
    const t = computeTargets(makeProfile({ goal: 'muscle_gain', targetWeightKg: 90 }));
    expect(t.kcal).toBeGreaterThan(t.tdee);
  });

  it('passe en maintien quand le poids cible est atteint', () => {
    const t = computeTargets(makeProfile({ weightKg: 77, targetWeightKg: 78 }));
    expect(Math.abs(t.kcal - t.tdee)).toBeLessThan(15);
  });
});

describe('aliments', () => {
  it('recherche sans tenir compte des accents', () => {
    expect(searchFoods('oeuf').some((f) => f.id === 'egg')).toBe(true);
    expect(searchFoods('pates').length).toBeGreaterThan(0);
  });

  it('respecte régime et allergies', () => {
    const salmon = getFood('salmon')!;
    expect(isFoodAllowed(salmon, { diet: 'vegetarian', allergies: [], dislikedFoods: [] })).toBe(false);
    expect(isFoodAllowed(salmon, { diet: 'omnivore', allergies: ['fish'], dislikedFoods: [] })).toBe(false);
    expect(isFoodAllowed(salmon, { diet: 'omnivore', allergies: [], dislikedFoods: ['saumon'] })).toBe(false);
  });

  it('toutes les recettes référencent des aliments existants', () => {
    for (const r of RECIPES) for (const i of r.ingredients) expect(getFood(i.foodId), `${r.id} → ${i.foodId}`).toBeDefined();
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });
});

describe('générateur de repas', () => {
  const profile = { diet: 'omnivore' as const, allergies: [], dislikedFoods: [], likedFoods: [] };

  it('propose 3 repas proches des calories restantes', () => {
    const meals = generateMeals({ remaining: { kcal: 650, protein: 45, carbs: 60, fat: 20, fiber: 10 }, modes: [], profile });
    expect(meals).toHaveLength(3);
    for (const m of meals) expect(m.macros.kcal).toBeLessThan(650 * 1.25);
    expect(meals[0].macros.protein).toBeGreaterThan(25);
  });

  it('respecte les filtres végétarien, rapide et allergies', () => {
    const meals = generateMeals({
      remaining: { kcal: 600, protein: 40, carbs: 60, fat: 20, fiber: 10 },
      modes: ['vegetarian', 'quick'],
      profile: { ...profile, allergies: ['eggs'] },
    });
    expect(meals.length).toBeGreaterThan(0);
    for (const m of meals) {
      expect(m.recipe.tags).toContain('vegetarian');
      expect(m.recipe.tags).toContain('quick');
      expect(m.ingredients.some((i) => i.food.allergens.includes('eggs'))).toBe(false);
    }
  });

  it('propose des repas végans compatibles', () => {
    const meals = generateMeals({ remaining: { kcal: 700, protein: 40, carbs: 80, fat: 20, fiber: 10 }, modes: [], profile: { ...profile, diet: 'vegan' } });
    for (const m of meals) expect(m.ingredients.every((i) => !['dairy', 'egg', 'meat', 'fish', 'poultry'].includes(i.food.category))).toBe(true);
  });
});
