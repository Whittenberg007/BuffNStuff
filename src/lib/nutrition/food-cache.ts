import { db } from "@/lib/offline/db";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getCachedSearch(query: string): Promise<unknown[] | null> {
  const entry = await db.foodSearchCache.get(query.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.cached_at > CACHE_TTL_MS) {
    await db.foodSearchCache.delete(query.toLowerCase());
    return null;
  }
  return JSON.parse(entry.results);
}

export async function setCachedSearch(query: string, results: unknown[]): Promise<void> {
  await db.foodSearchCache.put({
    query: query.toLowerCase(),
    results: JSON.stringify(results),
    cached_at: Date.now(),
  });
}

export async function getCachedBarcode(barcode: string): Promise<unknown | null> {
  const entry = await db.barcodeCache.get(barcode);
  if (!entry) return null;
  if (Date.now() - entry.cached_at > CACHE_TTL_MS) {
    await db.barcodeCache.delete(barcode);
    return null;
  }
  return JSON.parse(entry.product);
}

export async function setCachedBarcode(barcode: string, product: unknown): Promise<void> {
  await db.barcodeCache.put({
    barcode,
    product: JSON.stringify(product),
    cached_at: Date.now(),
  });
}
