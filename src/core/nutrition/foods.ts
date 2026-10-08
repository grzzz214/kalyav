import type { Allergen, Diet, Food, FoodCategory, Macros } from '../types';

/**
 * Base d'aliments courants (valeurs moyennes pour 100 g, ordre de grandeur
 * des tables CIQUAL). Le scanner code-barres complète avec Open Food Facts.
 */
type Row = [
  id: string,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  portionLabel: string,
  portionGrams: number,
  category: FoodCategory,
  allergens?: Allergen[],
];

const ROWS: Row[] = [
  // Protéines animales
  ['chicken_breast', 'Blanc de poulet cuit', 165, 31, 0, 3.6, 0, '1 filet', 130, 'poultry'],
  ['turkey_slice', 'Blanc de dinde (tranches)', 105, 22, 1, 1.5, 0, '2 tranches', 60, 'poultry'],
  ['beef_5', 'Steak haché 5 % MG', 137, 21, 0, 5, 0, '1 steak', 100, 'meat'],
  ['beef_15', 'Steak haché 15 % MG', 215, 19, 0, 15, 0, '1 steak', 100, 'meat'],
  ['ham', 'Jambon blanc', 115, 20, 1, 3.5, 0, '2 tranches', 80, 'pork'],
  ['salmon', 'Saumon cuit', 206, 22, 0, 13, 0, '1 pavé', 125, 'fish', ['fish']],
  ['tuna_can', 'Thon au naturel', 116, 26, 0, 1, 0, '1 boîte égouttée', 112, 'fish', ['fish']],
  ['white_fish', 'Cabillaud cuit', 90, 20, 0, 1, 0, '1 filet', 140, 'fish', ['fish']],
  ['shrimp', 'Crevettes cuites', 99, 24, 0, 0.3, 0, '1 portion', 100, 'seafood', ['shellfish']],
  ['sardines', 'Sardines à l’huile égouttées', 210, 24, 0, 12.5, 0, '1 boîte', 90, 'fish', ['fish']],
  ['egg', 'Œuf entier', 143, 12.6, 0.7, 9.5, 0, '1 œuf', 55, 'egg', ['eggs']],
  ['egg_white', 'Blanc d’œuf', 52, 11, 0.7, 0.2, 0, '100 ml', 100, 'egg', ['eggs']],
  // Produits laitiers
  ['skyr', 'Skyr nature', 63, 11, 4, 0.2, 0, '1 pot', 150, 'dairy', ['lactose']],
  ['greek_yogurt', 'Yaourt grec 2 %', 73, 9.9, 3.9, 2, 0, '1 pot', 150, 'dairy', ['lactose']],
  ['fromage_blanc', 'Fromage blanc 0 %', 46, 7.5, 4, 0.2, 0, '1 bol', 150, 'dairy', ['lactose']],
  ['cottage', 'Cottage cheese', 98, 11, 3.4, 4.3, 0, '1/2 pot', 100, 'dairy', ['lactose']],
  ['milk', 'Lait demi-écrémé', 46, 3.3, 4.8, 1.6, 0, '1 verre', 250, 'dairy', ['lactose']],
  ['emmental', 'Emmental râpé', 380, 28, 0, 29, 0, '1 poignée', 20, 'dairy', ['lactose']],
  ['mozzarella', 'Mozzarella', 250, 18, 2, 19, 0, '1/2 boule', 60, 'dairy', ['lactose']],
  ['feta', 'Feta', 265, 14, 4, 21, 0, '1 portion', 40, 'dairy', ['lactose']],
  ['whey', 'Whey protéine', 380, 78, 7, 5, 0, '1 dose', 30, 'dairy', ['lactose']],
  // Protéines végétales
  ['tofu', 'Tofu ferme', 144, 15, 2, 8.7, 2.3, '1/2 bloc', 125, 'plant_protein', ['soy']],
  ['tempeh', 'Tempeh', 192, 20, 7.6, 10.8, 5, '1 portion', 100, 'plant_protein', ['soy']],
  ['lentils', 'Lentilles cuites', 116, 9, 16, 0.4, 7.9, '1 portion', 180, 'legume'],
  ['chickpeas', 'Pois chiches cuits', 139, 7.6, 18, 2.6, 7.6, '1 portion', 150, 'legume'],
  ['red_beans', 'Haricots rouges cuits', 113, 8.7, 15, 0.5, 6.4, '1 portion', 150, 'legume'],
  ['pea_protein', 'Protéine de pois', 375, 80, 3, 6, 1, '1 dose', 30, 'plant_protein'],
  ['seitan', 'Seitan', 140, 25, 6, 2, 1, '1 portion', 100, 'plant_protein', ['gluten']],
  // Féculents
  ['rice', 'Riz basmati cuit', 130, 2.7, 28, 0.3, 0.4, '1 portion', 180, 'grain'],
  ['pasta', 'Pâtes cuites', 150, 5.5, 30, 0.9, 1.8, '1 portion', 200, 'grain', ['gluten']],
  ['pasta_wholegrain', 'Pâtes complètes cuites', 140, 5.8, 26, 1.1, 4, '1 portion', 200, 'grain', ['gluten']],
  ['quinoa', 'Quinoa cuit', 120, 4.4, 21, 1.9, 2.8, '1 portion', 180, 'grain'],
  ['oats', 'Flocons d’avoine', 372, 13.5, 58, 7, 10, '1 bol', 50, 'grain', ['gluten']],
  ['bread_whole', 'Pain complet', 240, 9, 41, 3, 7, '2 tranches', 70, 'grain', ['gluten']],
  ['baguette', 'Baguette', 270, 9, 55, 1.2, 3, '1/4 baguette', 60, 'grain', ['gluten']],
  ['potato', 'Pomme de terre cuite', 85, 2, 18, 0.1, 2, '2 moyennes', 250, 'grain'],
  ['sweet_potato', 'Patate douce cuite', 90, 2, 20, 0.2, 3.3, '1 moyenne', 200, 'grain'],
  ['wrap', 'Tortilla de blé', 300, 8.5, 50, 7, 3, '1 wrap', 60, 'grain', ['gluten']],
  ['rice_cakes', 'Galettes de riz', 380, 8, 80, 3, 3, '3 galettes', 27, 'grain'],
  ['semolina', 'Semoule cuite', 112, 3.8, 23, 0.2, 1.4, '1 portion', 180, 'grain', ['gluten']],
  // Légumes
  ['broccoli', 'Brocoli', 35, 2.8, 4, 0.4, 3.3, '1 portion', 200, 'vegetable'],
  ['green_beans', 'Haricots verts', 31, 1.8, 4.5, 0.2, 3.4, '1 portion', 200, 'vegetable'],
  ['spinach', 'Épinards', 23, 2.9, 1.4, 0.4, 2.2, '1 portion', 150, 'vegetable'],
  ['tomato', 'Tomate', 18, 0.9, 3, 0.2, 1.2, '1 tomate', 120, 'vegetable'],
  ['zucchini', 'Courgette', 17, 1.2, 2.2, 0.3, 1, '1 courgette', 200, 'vegetable'],
  ['carrot', 'Carotte', 36, 0.8, 7, 0.3, 2.8, '1 carotte', 100, 'vegetable'],
  ['salad', 'Salade verte', 15, 1.4, 1.5, 0.2, 1.3, '1 bol', 80, 'vegetable'],
  ['bell_pepper', 'Poivron', 26, 1, 5, 0.3, 2, '1 poivron', 150, 'vegetable'],
  ['mixed_veg', 'Poêlée de légumes', 45, 2, 6, 1.2, 3, '1 portion', 250, 'vegetable'],
  ['mushrooms', 'Champignons', 22, 3, 0.5, 0.3, 2, '1 portion', 150, 'vegetable'],
  ['cucumber', 'Concombre', 13, 0.6, 2, 0.1, 0.6, '1/2 concombre', 150, 'vegetable'],
  ['avocado', 'Avocat', 160, 2, 2, 15, 6.7, '1/2 avocat', 80, 'fat'],
  // Fruits
  ['banana', 'Banane', 90, 1.1, 20, 0.3, 2.6, '1 banane', 120, 'fruit'],
  ['apple', 'Pomme', 52, 0.3, 12, 0.2, 2.4, '1 pomme', 150, 'fruit'],
  ['berries', 'Fruits rouges', 45, 1, 8, 0.4, 4, '1 bol', 125, 'fruit'],
  ['orange', 'Orange', 47, 0.9, 9, 0.1, 2.4, '1 orange', 150, 'fruit'],
  ['dates', 'Dattes', 280, 2.5, 66, 0.4, 7, '3 dattes', 25, 'fruit'],
  ['kiwi', 'Kiwi', 61, 1.1, 12, 0.5, 3, '1 kiwi', 75, 'fruit'],
  // Matières grasses / oléagineux
  ['olive_oil', 'Huile d’olive', 900, 0, 0, 100, 0, '1 c. à soupe', 10, 'fat'],
  ['butter', 'Beurre', 745, 0.7, 0.6, 82, 0, '1 noisette', 10, 'fat', ['lactose']],
  ['almonds', 'Amandes', 620, 25, 6, 52, 12, '1 poignée', 25, 'nut', ['nuts']],
  ['walnuts', 'Noix', 700, 15, 7, 65, 6.7, '1 poignée', 20, 'nut', ['nuts']],
  ['peanut_butter', 'Beurre de cacahuète', 600, 25, 14, 50, 6, '1 c. à soupe', 15, 'nut', ['peanuts']],
  ['chia', 'Graines de chia', 490, 17, 8, 31, 34, '1 c. à soupe', 12, 'nut'],
  ['tahini', 'Purée de sésame', 640, 20, 10, 55, 9, '1 c. à soupe', 15, 'nut', ['sesame']],
  // Divers
  ['honey', 'Miel', 330, 0.4, 82, 0, 0, '1 c. à café', 8, 'snack'],
  ['dark_chocolate', 'Chocolat noir 70 %', 570, 8, 33, 42, 11, '2 carrés', 20, 'snack', ['lactose']],
  ['hummus', 'Houmous', 300, 7, 14, 24, 6, '2 c. à soupe', 40, 'legume', ['sesame']],
  ['tomato_sauce', 'Sauce tomate', 45, 1.5, 7, 1.2, 1.5, '1 portion', 100, 'vegetable'],
  ['soy_sauce', 'Sauce soja', 60, 8, 6, 0, 0, '1 c. à soupe', 15, 'snack', ['soy', 'gluten']],
  ['soy_milk', 'Boisson soja', 40, 3.3, 2.5, 1.8, 0.5, '1 verre', 250, 'plant_protein', ['soy']],
  ['protein_bar', 'Barre protéinée', 360, 33, 35, 10, 8, '1 barre', 55, 'snack', ['lactose', 'soy']],
  ['granola', 'Granola', 450, 9, 64, 16, 7, '1 bol', 45, 'grain', ['gluten', 'nuts']],
  ['pizza', 'Pizza margherita', 250, 11, 31, 9, 2, '1/2 pizza', 200, 'grain', ['gluten', 'lactose']],
  ['orange_juice', 'Jus d’orange', 44, 0.7, 10, 0.1, 0.2, '1 verre', 200, 'drink'],
  ['coffee_milk', 'Café au lait', 30, 1.7, 2.4, 1, 0, '1 tasse', 200, 'drink', ['lactose']],
];

export const FOODS: Food[] = ROWS.map(
  ([id, name, kcal, protein, carbs, fat, fiber, label, grams, category, allergens = []]) => ({
    id,
    name,
    per100: { kcal, protein, carbs, fat, fiber },
    portion: { label, grams },
    category,
    allergens,
  }),
);

const FOOD_INDEX = new Map(FOODS.map((f) => [f.id, f]));

export function getFood(id: string, custom: Food[] = []): Food | undefined {
  return FOOD_INDEX.get(id) ?? custom.find((f) => f.id === id);
}

export function macrosFor(food: Food, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: food.per100.kcal * f,
    protein: food.per100.protein * f,
    carbs: food.per100.carbs * f,
    fat: food.per100.fat * f,
    fiber: food.per100.fiber * f,
  };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’']/g, ' ');

export function searchFoods(query: string, extra: Food[] = [], limit = 30): Food[] {
  const q = normalize(query.trim());
  const all = [...extra, ...FOODS];
  if (!q) return all.slice(0, limit);
  const terms = q.split(/\s+/);
  return all
    .map((f) => {
      const n = normalize(f.name);
      const score = terms.every((t) => n.includes(t)) ? (n.startsWith(terms[0]) ? 2 : 1) : 0;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

const EXCLUDED_BY_DIET: Record<Diet, FoodCategory[]> = {
  omnivore: [],
  no_pork: ['pork'],
  pescatarian: ['meat', 'pork', 'poultry'],
  vegetarian: ['meat', 'pork', 'poultry', 'fish', 'seafood'],
  vegan: ['meat', 'pork', 'poultry', 'fish', 'seafood', 'egg', 'dairy'],
};

export function isFoodAllowed(
  food: Food,
  opts: { diet: Diet; allergies: string[]; dislikedFoods: string[] },
): boolean {
  if (EXCLUDED_BY_DIET[opts.diet].includes(food.category)) return false;
  if (opts.diet === 'vegan' && food.allergens.includes('lactose')) return false;
  if (food.allergens.some((a) => opts.allergies.includes(a))) return false;
  const n = normalize(food.name);
  return !opts.dislikedFoods.some((d) => d.trim() && n.includes(normalize(d.trim())));
}
