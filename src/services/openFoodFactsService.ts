import type { OpenFoodFactsSearchResult } from '@types/index';

const BASE_URL = 'https://world.openfoodfacts.org';

interface OFFProduct {
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  code?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
}

interface TransformedFood {
  name: string;
  brand: string | null;
  barcode: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  serving_size: number | null;
  serving_unit: string | null;
  source: 'openfoodfacts';
}

function safeParse(val: number | string | undefined | null): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'string') val = val.replace(',', '.');
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : parsed;
}

function transformProduct(product: OFFProduct): TransformedFood {
  const n = product.nutriments ?? {};

  const calories = safeParse(
    n['energy-kcal_100g'] ?? n['energy-kcal'] ??
    (n['energy_100g'] ? Number(n['energy_100g']) / 4.184 : 0)
  );
  const protein = safeParse(n.proteins_100g ?? n.proteins);
  const carbs = safeParse(n.carbohydrates_100g ?? n.carbohydrates);
  const fats = safeParse(n.fat_100g ?? n.fat);

  return {
    name: product.product_name ?? product.product_name_fr ?? 'Unknown Product',
    brand: product.brands ?? null,
    barcode: product.code ?? null,
    calories_per_100g: parseFloat(calories.toFixed(2)),
    protein_per_100g: parseFloat(protein.toFixed(2)),
    carbs_per_100g: parseFloat(carbs.toFixed(2)),
    fats_per_100g: parseFloat(fats.toFixed(2)),
    serving_size: safeParse(product.serving_quantity) || 100,
    serving_unit: product.serving_quantity_unit ?? 'g',
    source: 'openfoodfacts',
  };
}

function isValidProduct(p: TransformedFood): boolean {
  return (
    (p.calories_per_100g > 0 ||
      p.protein_per_100g > 0 ||
      p.carbs_per_100g > 0 ||
      p.fats_per_100g > 0) &&
    p.name !== 'Unknown Product'
  );
}

class OpenFoodFactsService {
  async searchFoods(
    query: string,
    page = 1,
    pageSize = 20
  ): Promise<OpenFoodFactsSearchResult> {
    try {
      const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=${pageSize}&fields=product_name,product_name_fr,brands,code,nutriments,serving_quantity,serving_quantity_unit`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`OpenFoodFacts search failed: ${response.status}`);
      const json = await response.json();
      const products: OFFProduct[] = json.products ?? [];
      const transformed = products.map(transformProduct).filter(isValidProduct);
      return {
        foods: transformed,
        count: json.count ?? 0,
        page: parseInt(String(json.page)) || 1,
      };
    } catch (error) {
      console.error('[openFoodFactsService] searchFoods:', error);
      return { foods: [], count: 0, page };
    }
  }

  async getFoodByBarcode(barcode: string): Promise<TransformedFood | null> {
    try {
      const response = await fetch(
        `${BASE_URL}/api/v2/product/${barcode}?fields=product_name,product_name_fr,brands,code,nutriments,serving_quantity,serving_quantity_unit&lc=fr`,
        { headers: { 'User-Agent': 'Nokka/1.0 (mobile app)' } }
      );
      if (!response.ok) return null;
      const json = await response.json();
      if (json.status !== 1 || !json.product) return null;
      const transformed = transformProduct({ ...json.product, code: barcode });
      return isValidProduct(transformed) ? transformed : null;
    } catch (error) {
      console.error('[openFoodFactsService] getFoodByBarcode:', error);
      return null;
    }
  }

  getPopularFoods(): TransformedFood[] {
    return [
      { name: 'Chicken Breast', brand: null, barcode: null, calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fats_per_100g: 3.6, serving_size: 100, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'White Rice (cooked)', brand: null, barcode: null, calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fats_per_100g: 0.3, serving_size: 200, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Whole Eggs', brand: null, barcode: null, calories_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fats_per_100g: 11, serving_size: 50, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Salmon Fillet', brand: null, barcode: null, calories_per_100g: 208, protein_per_100g: 20, carbs_per_100g: 0, fats_per_100g: 13, serving_size: 150, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Oats', brand: null, barcode: null, calories_per_100g: 389, protein_per_100g: 17, carbs_per_100g: 66, fats_per_100g: 7, serving_size: 80, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Greek Yogurt (0%)', brand: null, barcode: null, calories_per_100g: 59, protein_per_100g: 10, carbs_per_100g: 3.6, fats_per_100g: 0.4, serving_size: 150, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Banana', brand: null, barcode: null, calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fats_per_100g: 0.3, serving_size: 120, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Broccoli', brand: null, barcode: null, calories_per_100g: 34, protein_per_100g: 2.8, carbs_per_100g: 7, fats_per_100g: 0.4, serving_size: 200, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Peanut Butter', brand: null, barcode: null, calories_per_100g: 588, protein_per_100g: 25, carbs_per_100g: 20, fats_per_100g: 50, serving_size: 30, serving_unit: 'g', source: 'openfoodfacts' },
      { name: 'Sweet Potato', brand: null, barcode: null, calories_per_100g: 86, protein_per_100g: 1.6, carbs_per_100g: 20, fats_per_100g: 0.1, serving_size: 150, serving_unit: 'g', source: 'openfoodfacts' },
    ];
  }
}

export const openFoodFactsService = new OpenFoodFactsService();
