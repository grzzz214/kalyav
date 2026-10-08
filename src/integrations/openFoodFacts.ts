import type { Allergen, Food } from '../core/types';
import type { FoodDatabase } from './types';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,brands,nutriments,serving_size,serving_quantity,allergens_tags';

const ALLERGEN_MAP: Record<string, Allergen> = {
  'en:gluten': 'gluten',
  'en:milk': 'lactose',
  'en:nuts': 'nuts',
  'en:peanuts': 'peanuts',
  'en:eggs': 'eggs',
  'en:fish': 'fish',
  'en:crustaceans': 'shellfish',
  'en:molluscs': 'shellfish',
  'en:soybeans': 'soy',
  'en:sesame-seeds': 'sesame',
};

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_size?: string;
  serving_quantity?: number | string;
  allergens_tags?: string[];
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || 0 : 0);

export function offProductToFood(p: OffProduct, code: string): Food | null {
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) || num(n['energy_100g']) / 4.184;
  const name = (p.product_name_fr || p.product_name || '').trim();
  if (!name || !kcal) return null;
  const serving = num(p.serving_quantity);
  return {
    id: `off_${code}`,
    name: p.brands ? `${name} (${p.brands.split(',')[0].trim()})` : name,
    per100: {
      kcal: Math.round(kcal),
      protein: num(n['proteins_100g']),
      carbs: num(n['carbohydrates_100g']),
      fat: num(n['fat_100g']),
      fiber: num(n['fiber_100g']),
    },
    portion: serving > 0 ? { label: p.serving_size || `${serving} g`, grams: serving } : { label: '100 g', grams: 100 },
    category: 'snack',
    allergens: [...new Set((p.allergens_tags ?? []).map((t) => ALLERGEN_MAP[t]).filter(Boolean))],
    barcode: code,
    custom: true,
  };
}

/** Open Food Facts : base collaborative ouverte, sans clé d'API. */
export const openFoodFacts: FoodDatabase = {
  id: 'open_food_facts',
  name: 'Open Food Facts',
  async findByBarcode(code) {
    const clean = code.replace(/\D/g, '');
    if (!clean) return null;
    const res = await fetch(`${BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'Kalyav/0.1 (coach sport & nutrition)' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) return null;
    return offProductToFood(json.product, clean);
  },
  async search(query) {
    const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=15&fields=${FIELDS}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { products?: OffProduct[] };
    return (json.products ?? [])
      .map((p) => (p.code ? offProductToFood(p, p.code) : null))
      .filter((f): f is Food => !!f);
  },
};
