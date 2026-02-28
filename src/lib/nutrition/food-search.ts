import { getCachedSearch, setCachedSearch, getCachedBarcode, setCachedBarcode } from "./food-cache";

const USER_AGENT = "BuffNStuff/1.0 (buffnstuff@example.com)";

export interface FoodProduct {
  name: string;
  brand: string | null;
  barcode: string | null;
  servingSize: string | null;
  servingGrams: number | null;
  per100g: { calories: number; protein: number; carbs: number; fats: number };
  perServing: { calories: number; protein: number; carbs: number; fats: number } | null;
}

function mapProduct(product: Record<string, unknown>): FoodProduct | null {
  const nutriments = product.nutriments as Record<string, number> | undefined;
  if (!nutriments) return null;

  const name = (product.product_name as string) || "";
  if (!name) return null;

  return {
    name,
    brand: (product.brands as string) || null,
    barcode: (product.code as string) || null,
    servingSize: (product.serving_size as string) || null,
    servingGrams: (product.serving_quantity as number) || null,
    per100g: {
      calories: Math.round(nutriments["energy-kcal_100g"] || 0),
      protein: Math.round((nutriments["proteins_100g"] || 0) * 10) / 10,
      carbs: Math.round((nutriments["carbohydrates_100g"] || 0) * 10) / 10,
      fats: Math.round((nutriments["fat_100g"] || 0) * 10) / 10,
    },
    perServing: nutriments["energy-kcal_serving"] != null
      ? {
          calories: Math.round(nutriments["energy-kcal_serving"] || 0),
          protein: Math.round((nutriments["proteins_serving"] || 0) * 10) / 10,
          carbs: Math.round((nutriments["carbohydrates_serving"] || 0) * 10) / 10,
          fats: Math.round((nutriments["fat_serving"] || 0) * 10) / 10,
        }
      : null,
  };
}

export async function searchFoods(query: string): Promise<FoodProduct[]> {
  if (!query || query.length < 2) return [];

  // Check cache first
  const cached = await getCachedSearch(query);
  if (cached) return cached as FoodProduct[];

  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "10");
    url.searchParams.set("fields", "product_name,brands,code,nutriments,serving_size,serving_quantity");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const products = (data.products || [])
      .map((p: Record<string, unknown>) => mapProduct(p))
      .filter((p: FoodProduct | null): p is FoodProduct => p !== null);

    // Cache results
    await setCachedSearch(query, products);
    return products;
  } catch {
    // Offline — return empty (cache miss already checked above)
    return [];
  }
}

export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  if (!barcode) return null;

  // Check cache first
  const cached = await getCachedBarcode(barcode);
  if (cached) return cached as FoodProduct;

  try {
    const url = `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=product_name,brands,code,nutriments,serving_size,serving_quantity`;

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const product = mapProduct(data.product);
    if (product) {
      await setCachedBarcode(barcode, product);
    }
    return product;
  } catch {
    return null;
  }
}

/** Scale macros from per-100g to a custom gram amount */
export function scaleMacros(
  per100g: FoodProduct["per100g"],
  grams: number
): { calories: number; protein: number; carbs: number; fats: number } {
  const factor = grams / 100;
  return {
    calories: Math.round(per100g.calories * factor),
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fats: Math.round(per100g.fats * factor * 10) / 10,
  };
}
