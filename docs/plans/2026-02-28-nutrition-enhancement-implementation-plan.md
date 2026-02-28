# Phase 12: Nutrition Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform manual nutrition logging into a smart, offline-capable system with OpenFoodFacts search, barcode scanning, meal planning with time slots, and intermittent fasting tracking with streaks.

**Architecture:** Four independent feature modules that integrate into the existing nutrition page. Food search & barcode scanner enhance the existing `FoodEntryForm`. Meal planning adds new routes under `/nutrition/plans`. Fasting tracker adds a timer widget to the nutrition page and settings to `/settings`. All features use Dexie for offline caching alongside Supabase for cloud persistence.

**Tech Stack:** OpenFoodFacts API (v1 search + v2 barcode), `@capacitor/barcode-scanner` v3.0.1, Dexie ^4.3.0 (existing), Supabase (existing), Next.js 16 App Router, shadcn/ui

---

### Task 1: Install barcode scanner plugin

**Files:**
- Modify: `package.json`

**Step 1: Install the plugin**

Run:
```bash
npm install @capacitor/barcode-scanner
```

**Step 2: Sync native projects**

Run:
```bash
npm run build:cap && npx cap sync
```

Expected: Build succeeds and plugin syncs to Android/iOS.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @capacitor/barcode-scanner plugin"
```

---

### Task 2: Add types for new data models

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add new types**

Append the following types after the existing `UserSettings` interface (after line 186):

```typescript
export type FastingProtocol = "12:12" | "14:10" | "16:8" | "18:6" | "20:4" | "23:1" | "custom";

export interface MealPlan {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  eating_window_start: string | null;
  eating_window_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealPlanItem {
  id: string;
  plan_id: string;
  meal_name: string;
  target_time: string | null;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  serving_size: string | null;
  sort_order: number;
  created_at: string;
}

export interface FastingSettings {
  id: string;
  user_id: string;
  protocol: FastingProtocol;
  target_fast_hours: number;
  eating_window_start: string;
  eating_window_end: string;
  notifications_enabled: boolean;
  updated_at: string;
}

export interface FastingLog {
  id: string;
  user_id: string;
  date: string;
  eating_start: string | null;
  eating_end: string | null;
  target_fast_hours: number;
  achieved_fast_hours: number | null;
  hit_target: boolean | null;
  notes: string | null;
  created_at: string;
}
```

**Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add types for meal plans, fasting settings, and fasting log"
```

---

### Task 3: Extend Dexie offline database with food cache and fasting tables

**Files:**
- Modify: `src/lib/offline/db.ts`

**Step 1: Add new interfaces and tables**

The existing file defines `PendingSet` and `PendingSession` interfaces and a Dexie DB at version 1. Add the new interfaces and bump to version 2.

Add these interfaces after `PendingSession` (after line 23):

```typescript
interface FoodSearchCache {
  query: string;
  results: string; // JSON stringified array of search results
  cached_at: number; // timestamp ms
}

interface BarcodeCache {
  barcode: string;
  product: string; // JSON stringified product data
  cached_at: number;
}

interface PendingFastingLog {
  id: string;
  date: string;
  eating_start: string | null;
  eating_end: string | null;
  target_fast_hours: number;
  achieved_fast_hours: number | null;
  hit_target: boolean | null;
  notes: string | null;
  synced: boolean;
}

interface PendingMealPlan {
  id: string;
  name: string;
  description: string | null;
  eating_window_start: string | null;
  eating_window_end: string | null;
  synced: boolean;
}

interface PendingMealPlanItem {
  id: string;
  plan_id: string;
  meal_name: string;
  target_time: string | null;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  serving_size: string | null;
  sort_order: number;
  synced: boolean;
}
```

Update the DB type to include new tables:

```typescript
const db = new Dexie("BuffNStuffOffline") as Dexie & {
  pendingSets: EntityTable<PendingSet, "id">;
  pendingSessions: EntityTable<PendingSession, "id">;
  foodSearchCache: EntityTable<FoodSearchCache, "query">;
  barcodeCache: EntityTable<BarcodeCache, "barcode">;
  pendingFastingLogs: EntityTable<PendingFastingLog, "id">;
  pendingMealPlans: EntityTable<PendingMealPlan, "id">;
  pendingMealPlanItems: EntityTable<PendingMealPlanItem, "id">;
};
```

Keep version 1 stores, then add version 2:

```typescript
db.version(1).stores({
  pendingSets: "id, session_id, synced",
  pendingSessions: "id, synced",
});

db.version(2).stores({
  pendingSets: "id, session_id, synced",
  pendingSessions: "id, synced",
  foodSearchCache: "query, cached_at",
  barcodeCache: "barcode, cached_at",
  pendingFastingLogs: "id, date, synced",
  pendingMealPlans: "id, synced",
  pendingMealPlanItems: "id, plan_id, synced",
});
```

Export the new types alongside existing ones.

**Step 2: Commit**

```bash
git add src/lib/offline/db.ts
git commit -m "feat: extend Dexie DB with food cache, fasting, and meal plan tables"
```

---

### Task 4: Create OpenFoodFacts search and barcode lookup utilities

**Files:**
- Create: `src/lib/nutrition/food-search.ts`
- Create: `src/lib/nutrition/food-cache.ts`

**Step 1: Create `src/lib/nutrition/food-cache.ts`**

This module handles Dexie-based caching for food search results and barcode lookups with a 7-day TTL.

```typescript
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
```

**Step 2: Create `src/lib/nutrition/food-search.ts`**

This module calls the OpenFoodFacts API and maps results to our app's format, with offline cache fallback.

```typescript
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
```

**Step 3: Commit**

```bash
git add src/lib/nutrition/food-search.ts src/lib/nutrition/food-cache.ts
git commit -m "feat: add OpenFoodFacts search, barcode lookup, and offline food cache"
```

---

### Task 5: Build food search input component with autocomplete dropdown

**Files:**
- Create: `src/components/nutrition/food-search-input.tsx`
- Create: `src/components/nutrition/serving-selector.tsx`

**Step 1: Create `src/components/nutrition/serving-selector.tsx`**

A dropdown that lets the user choose "Per serving", "Per 100g", or a custom gram amount. Emits scaled macro values.

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodProduct } from "@/lib/nutrition/food-search";
import { scaleMacros } from "@/lib/nutrition/food-search";

type ServingMode = "serving" | "100g" | "custom";

interface ServingSelectorProps {
  product: FoodProduct;
  onMacrosChange: (macros: { calories: number; protein: number; carbs: number; fats: number }) => void;
}

export function ServingSelector({ product, onMacrosChange }: ServingSelectorProps) {
  const [mode, setMode] = useState<ServingMode>(product.perServing ? "serving" : "100g");
  const [customGrams, setCustomGrams] = useState("");

  function handleModeChange(newMode: ServingMode) {
    setMode(newMode);
    if (newMode === "serving" && product.perServing) {
      onMacrosChange(product.perServing);
    } else if (newMode === "100g") {
      onMacrosChange(product.per100g);
    }
    // custom mode waits for user input
  }

  function handleCustomGrams(value: string) {
    setCustomGrams(value);
    const grams = parseFloat(value);
    if (grams > 0) {
      onMacrosChange(scaleMacros(product.per100g, grams));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={mode} onValueChange={(v) => handleModeChange(v as ServingMode)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {product.perServing && (
            <SelectItem value="serving">
              Per serving{product.servingSize ? ` (${product.servingSize})` : ""}
            </SelectItem>
          )}
          <SelectItem value="100g">Per 100g</SelectItem>
          <SelectItem value="custom">Custom (g)</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <Input
          type="number"
          placeholder="grams"
          min={0}
          value={customGrams}
          onChange={(e) => handleCustomGrams(e.target.value)}
          className="w-24"
        />
      )}
    </div>
  );
}
```

**Step 2: Create `src/components/nutrition/food-search-input.tsx`**

An autocomplete input that searches OpenFoodFacts with a 300ms debounce, shows results in a dropdown, and lets the user select a product to auto-fill macros.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchFoods, type FoodProduct } from "@/lib/nutrition/food-search";
import { ServingSelector } from "./serving-selector";

interface FoodSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onProductSelect: (macros: {
    food_item: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  }) => void;
}

export function FoodSearchInput({ value, onChange, onProductSelect }: FoodSearchInputProps) {
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const products = await searchFoods(query);
      setResults(products);
      setShowDropdown(products.length > 0);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleInputChange(newValue: string) {
    onChange(newValue);
    setSelectedProduct(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(newValue), 300);
  }

  function handleSelectProduct(product: FoodProduct) {
    const macros = product.perServing || product.per100g;
    onChange(product.brand ? `${product.name} (${product.brand})` : product.name);
    setSelectedProduct(product);
    setShowDropdown(false);
    onProductSelect({
      food_item: product.brand ? `${product.name} (${product.brand})` : product.name,
      calories: macros.calories,
      protein_g: macros.protein,
      carbs_g: macros.carbs,
      fats_g: macros.fats,
    });
  }

  function handleServingChange(macros: { calories: number; protein: number; carbs: number; fats: number }) {
    if (!selectedProduct) return;
    onProductSelect({
      food_item: selectedProduct.brand
        ? `${selectedProduct.name} (${selectedProduct.brand})`
        : selectedProduct.name,
      calories: macros.calories,
      protein_g: macros.protein,
      carbs_g: macros.carbs,
      fats_g: macros.fats,
    });
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search foods or enter custom..."
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          className="pl-9 pr-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search results dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full rounded-lg border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {results.map((product, idx) => {
            const macros = product.perServing || product.per100g;
            return (
              <button
                key={`${product.barcode || product.name}-${idx}`}
                type="button"
                onClick={() => handleSelectProduct(product)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  {product.brand && (
                    <p className="text-xs text-muted-foreground truncate">{product.brand}</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  <p>{macros.calories} cal</p>
                  <p>{macros.protein}p / {macros.carbs}c / {macros.fats}f</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Serving selector — shown after selecting a product */}
      {selectedProduct && (
        <ServingSelector product={selectedProduct} onMacrosChange={handleServingChange} />
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/nutrition/food-search-input.tsx src/components/nutrition/serving-selector.tsx
git commit -m "feat: add food search autocomplete with serving size selector"
```

---

### Task 6: Build barcode scanner component

**Files:**
- Create: `src/components/nutrition/barcode-scanner.tsx`

**Step 1: Create the component**

The barcode scanner button is only visible on native platforms. It opens the device camera, scans a barcode, and looks up the product via OpenFoodFacts.

```tsx
"use client";

import { useState } from "react";
import { ScanBarcode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNative } from "@/lib/capacitor/platform";
import { lookupBarcode, type FoodProduct } from "@/lib/nutrition/food-search";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onProductFound: (product: FoodProduct) => void;
}

export function BarcodeScanner({ onProductFound }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);

  if (!isNative()) return null;

  async function handleScan() {
    setIsScanning(true);
    try {
      const { BarcodeScanner: Scanner } = await import("@capacitor/barcode-scanner");

      const permission = await Scanner.checkPermission({ force: true });
      if (!permission.granted) {
        toast.error("Camera permission required for barcode scanning");
        return;
      }

      document.body.classList.add("barcode-scanner-active");
      const result = await Scanner.startScan();
      document.body.classList.remove("barcode-scanner-active");

      if (!result.hasContent || !result.content) {
        return;
      }

      const product = await lookupBarcode(result.content);
      if (product) {
        onProductFound(product);
        toast.success(`Found: ${product.name}`);
      } else {
        toast.error("Product not found — enter manually");
      }
    } catch {
      document.body.classList.remove("barcode-scanner-active");
      toast.error("Scan failed — try again");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleScan}
      disabled={isScanning}
      aria-label="Scan barcode"
    >
      {isScanning ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ScanBarcode className="size-4" />
      )}
    </Button>
  );
}
```

Note: The `barcode-scanner-active` CSS class is needed to make the webview transparent so the native camera shows through. Add this to `src/app/globals.css`:

```css
/* Barcode scanner overlay — makes webview transparent for camera */
body.barcode-scanner-active {
  background: transparent !important;
}
body.barcode-scanner-active * {
  visibility: hidden;
}
```

**Step 2: Commit**

```bash
git add src/components/nutrition/barcode-scanner.tsx src/app/globals.css
git commit -m "feat: add native barcode scanner component with OpenFoodFacts lookup"
```

---

### Task 7: Integrate food search and barcode scanner into FoodEntryForm

**Files:**
- Modify: `src/components/nutrition/food-entry-form.tsx`

**Step 1: Replace the plain food item input with FoodSearchInput + BarcodeScanner**

Read the existing `food-entry-form.tsx` first. The key changes:

1. Add imports for `FoodSearchInput` and `BarcodeScanner`
2. Replace the plain `<Input>` for food item (lines 156-165) with a row containing `<FoodSearchInput>` and `<BarcodeScanner>`
3. When a product is selected (from search or barcode), auto-fill the food_item, calories, protein, carbs, and fats fields
4. Keep all existing functionality: meal selector, favorites, manual entry, save-as-favorite

Add imports:
```typescript
import { FoodSearchInput } from "./food-search-input";
import { BarcodeScanner } from "./barcode-scanner";
import type { FoodProduct } from "@/lib/nutrition/food-search";
```

Replace the food item input section with:
```tsx
{/* Food item search with barcode scanner */}
<div className="space-y-2">
  <Label htmlFor="food-item">Food Item</Label>
  <div className="flex gap-2">
    <div className="flex-1">
      <FoodSearchInput
        value={foodItem}
        onChange={setFoodItem}
        onProductSelect={(macros) => {
          setFoodItem(macros.food_item);
          setCalories(macros.calories.toString());
          setProteinG(macros.protein_g.toString());
          setCarbsG(macros.carbs_g.toString());
          setFatsG(macros.fats_g.toString());
        }}
      />
    </div>
    <BarcodeScanner
      onProductFound={(product: FoodProduct) => {
        const macros = product.perServing || product.per100g;
        setFoodItem(
          product.brand
            ? `${product.name} (${product.brand})`
            : product.name
        );
        setCalories(macros.calories.toString());
        setProteinG(macros.protein.toString());
        setCarbsG(macros.carbs.toString());
        setFatsG(macros.fats.toString());
      }}
    />
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/components/nutrition/food-entry-form.tsx
git commit -m "feat: integrate food search and barcode scanner into food entry form"
```

---

### Task 8: Create Supabase database layer for fasting

**Files:**
- Create: `src/lib/database/fasting.ts`

**Step 1: Create the fasting database module**

This module provides CRUD for fasting settings and the daily fasting log, plus streak calculation.

```typescript
import { createClient } from "@/lib/supabase/client";
import type { FastingSettings, FastingLog } from "@/types";

/** Get or create fasting settings for the current user */
export async function getFastingSettings(): Promise<FastingSettings | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("fasting_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as FastingSettings | null;
}

/** Update or create fasting settings */
export async function updateFastingSettings(settings: {
  protocol: string;
  target_fast_hours: number;
  eating_window_start: string;
  eating_window_end: string;
  notifications_enabled: boolean;
}): Promise<FastingSettings> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("fasting_settings")
    .upsert(
      { user_id: user.id, ...settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as FastingSettings;
}

/** Get today's fasting log entry */
export async function getTodayFastingLog(date: string): Promise<FastingLog | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("fasting_log")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as FastingLog | null;
}

/** Start or stop eating — upsert today's fasting log */
export async function upsertFastingLog(entry: {
  date: string;
  eating_start?: string | null;
  eating_end?: string | null;
  target_fast_hours: number;
  achieved_fast_hours?: number | null;
  hit_target?: boolean | null;
  notes?: string | null;
}): Promise<FastingLog> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("fasting_log")
    .upsert(
      { user_id: user.id, ...entry },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as FastingLog;
}

/** Get fasting streak — consecutive days where hit_target = true */
export async function getFastingStreak(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("fasting_log")
    .select("date, hit_target")
    .eq("user_id", user.id)
    .eq("hit_target", true)
    .order("date", { ascending: false })
    .limit(365);

  if (error || !data) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < data.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];

    if (data[i].date === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/** Get fasting log history for the last N days */
export async function getFastingHistory(days: number = 30): Promise<FastingLog[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("fasting_log")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) return [];
  return data as FastingLog[];
}
```

**Step 2: Commit**

```bash
git add src/lib/database/fasting.ts
git commit -m "feat: add Supabase database layer for fasting settings and log"
```

---

### Task 9: Build fasting timer widget and streak counter

**Files:**
- Create: `src/lib/nutrition/fasting.ts`
- Create: `src/components/nutrition/fasting-timer.tsx`
- Create: `src/components/nutrition/fasting-streak.tsx`

**Step 1: Create `src/lib/nutrition/fasting.ts`**

Pure logic for fasting state calculations — no UI, no database calls.

```typescript
export type FastingState = "fasting" | "eating" | "window_closed";

export interface FastingStatus {
  state: FastingState;
  elapsedMinutes: number;
  remainingMinutes: number | null;
  progress: number; // 0-1 for the circular ring
}

/** Compute current fasting status from settings and today's log */
export function computeFastingStatus(
  eatingWindowStart: string, // "HH:MM"
  eatingWindowEnd: string,
  targetFastHours: number,
  eatingStart: string | null, // ISO timestamp
  eatingEnd: string | null,
  now: Date = new Date()
): FastingStatus {
  const todayStr = now.toISOString().split("T")[0];
  const windowStart = new Date(`${todayStr}T${eatingWindowStart}:00`);
  const windowEnd = new Date(`${todayStr}T${eatingWindowEnd}:00`);

  // If user has ended eating, they're fasting
  if (eatingEnd) {
    const endTime = new Date(eatingEnd);
    const elapsedMs = now.getTime() - endTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const targetMinutes = targetFastHours * 60;
    const remaining = Math.max(0, targetMinutes - elapsedMinutes);
    return {
      state: "fasting",
      elapsedMinutes,
      remainingMinutes: remaining,
      progress: Math.min(1, elapsedMinutes / targetMinutes),
    };
  }

  // If user has started eating, they're in eating window
  if (eatingStart) {
    const startTime = new Date(eatingStart);
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const windowMs = windowEnd.getTime() - windowStart.getTime();
    const windowMinutes = Math.floor(windowMs / 60000);
    const remaining = Math.max(0, windowMinutes - elapsedMinutes);

    if (remaining <= 0) {
      return {
        state: "window_closed",
        elapsedMinutes,
        remainingMinutes: 0,
        progress: 1,
      };
    }

    return {
      state: "eating",
      elapsedMinutes,
      remainingMinutes: remaining,
      progress: elapsedMinutes / windowMinutes,
    };
  }

  // No eating logged yet — check if we're before or after window
  if (now < windowStart) {
    // Still fasting from yesterday
    // Calculate from previous day's window end
    const yesterdayEnd = new Date(windowEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    const elapsedMs = now.getTime() - yesterdayEnd.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const targetMinutes = targetFastHours * 60;
    return {
      state: "fasting",
      elapsedMinutes,
      remainingMinutes: Math.max(0, targetMinutes - elapsedMinutes),
      progress: Math.min(1, elapsedMinutes / targetMinutes),
    };
  }

  // Past window start but no eating logged
  return {
    state: "fasting",
    elapsedMinutes: 0,
    remainingMinutes: targetFastHours * 60,
    progress: 0,
  };
}

export function formatFastingTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}
```

**Step 2: Create `src/components/nutrition/fasting-timer.tsx`**

A circular progress ring widget showing the current fasting state, with start/stop eating controls.

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Utensils, Moon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  computeFastingStatus,
  formatFastingTime,
  type FastingStatus,
} from "@/lib/nutrition/fasting";
import {
  getFastingSettings,
  getTodayFastingLog,
  upsertFastingLog,
} from "@/lib/database/fasting";
import type { FastingSettings, FastingLog } from "@/types";

export function FastingTimer() {
  const [settings, setSettings] = useState<FastingSettings | null>(null);
  const [todayLog, setTodayLog] = useState<FastingLog | null>(null);
  const [status, setStatus] = useState<FastingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    try {
      const [s, log] = await Promise.all([
        getFastingSettings(),
        getTodayFastingLog(today),
      ]);
      setSettings(s);
      setTodayLog(log);
    } catch {
      // Settings not configured yet
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update status every minute
  useEffect(() => {
    if (!settings) return;

    function tick() {
      if (!settings) return;
      setStatus(
        computeFastingStatus(
          settings.eating_window_start,
          settings.eating_window_end,
          settings.target_fast_hours,
          todayLog?.eating_start || null,
          todayLog?.eating_end || null
        )
      );
    }

    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [settings, todayLog]);

  async function handleStartEating() {
    if (!settings) return;
    const now = new Date().toISOString();
    const log = await upsertFastingLog({
      date: today,
      eating_start: now,
      target_fast_hours: settings.target_fast_hours,
    });
    setTodayLog(log);
  }

  async function handleStopEating() {
    if (!settings || !todayLog) return;
    const now = new Date();
    const start = todayLog.eating_start ? new Date(todayLog.eating_start) : now;
    const fastHoursNeeded = settings.target_fast_hours;
    // Achieved = 24 - eating duration (approximate)
    const eatingHours = (now.getTime() - start.getTime()) / 3600000;
    const achievedFastHours = Math.round((24 - eatingHours) * 10) / 10;
    const hitTarget = achievedFastHours >= fastHoursNeeded;

    const log = await upsertFastingLog({
      date: today,
      eating_start: todayLog.eating_start,
      eating_end: now.toISOString(),
      target_fast_hours: fastHoursNeeded,
      achieved_fast_hours: achievedFastHours,
      hit_target: hitTarget,
    });
    setTodayLog(log);
  }

  if (loading) return null;
  if (!settings || !status) {
    return (
      <Card className="py-3">
        <CardContent className="px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Set up intermittent fasting in{" "}
            <a href="/settings" className="text-primary underline">
              Settings
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - status.progress);

  const stateConfig = {
    fasting: { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Moon, label: "Fasting" },
    eating: { color: "text-amber-500", bg: "bg-amber-500/10", icon: Utensils, label: "Eating Window" },
    window_closed: { color: "text-red-500", bg: "bg-red-500/10", icon: AlertCircle, label: "Window Closed" },
  };

  const config = stateConfig[status.state];
  const Icon = config.icon;

  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-center gap-4">
          {/* Circular progress ring */}
          <div className="relative flex shrink-0 items-center justify-center">
            <svg width="96" height="96" className="-rotate-90">
              <circle
                cx="48" cy="48" r={radius}
                fill="none" stroke="currentColor" strokeWidth="5"
                className="text-muted/30"
              />
              <circle
                cx="48" cy="48" r={radius}
                fill="none" stroke="currentColor" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn("transition-all duration-1000 ease-linear", config.color)}
              />
            </svg>
            <div className={cn("absolute flex size-12 items-center justify-center rounded-full", config.bg)}>
              <Icon className={cn("size-5", config.color)} />
            </div>
          </div>

          {/* Status text and controls */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-sm font-semibold", config.color)}>
                {config.label}
              </span>
              <Badge variant="secondary" className="text-xs">
                {settings.protocol}
              </Badge>
            </div>
            <p className="text-xl font-bold tabular-nums">
              {formatFastingTime(status.elapsedMinutes)}
            </p>
            {status.remainingMinutes != null && status.remainingMinutes > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatFastingTime(status.remainingMinutes)} remaining
              </p>
            )}
            <div className="mt-2">
              {!todayLog?.eating_start ? (
                <Button size="sm" onClick={handleStartEating}>
                  <Utensils className="size-3.5 mr-1.5" /> Start Eating
                </Button>
              ) : !todayLog?.eating_end ? (
                <Button size="sm" variant="secondary" onClick={handleStopEating}>
                  <Moon className="size-3.5 mr-1.5" /> Stop Eating
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Eating window logged for today
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create `src/components/nutrition/fasting-streak.tsx`**

A small streak display similar to the workout streak counter.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { getFastingStreak } from "@/lib/database/fasting";

export function FastingStreak() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    getFastingStreak().then(setStreak).catch(() => setStreak(0));
  }, []);

  if (streak === null || streak === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Timer className="size-3.5 text-emerald-500" />
      <span className="font-medium text-foreground">{streak}</span> day fasting streak
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/nutrition/fasting.ts src/components/nutrition/fasting-timer.tsx src/components/nutrition/fasting-streak.tsx
git commit -m "feat: add fasting timer widget with circular progress ring and streak counter"
```

---

### Task 10: Add fasting settings to the Settings page

**Files:**
- Create: `src/components/settings/fasting-settings.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Create `src/components/settings/fasting-settings.tsx`**

A card component with protocol selector, eating window time pickers, and notification toggle.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getFastingSettings, updateFastingSettings } from "@/lib/database/fasting";
import type { FastingSettings as FastingSettingsType, FastingProtocol } from "@/types";

const PROTOCOLS: { value: FastingProtocol; label: string; fastHours: number; start: string; end: string }[] = [
  { value: "12:12", label: "12:12 — Beginner", fastHours: 12, start: "08:00", end: "20:00" },
  { value: "14:10", label: "14:10 — Moderate", fastHours: 14, start: "10:00", end: "20:00" },
  { value: "16:8", label: "16:8 — Popular", fastHours: 16, start: "12:00", end: "20:00" },
  { value: "18:6", label: "18:6 — Advanced", fastHours: 18, start: "12:00", end: "18:00" },
  { value: "20:4", label: "20:4 — Warrior", fastHours: 20, start: "16:00", end: "20:00" },
  { value: "23:1", label: "OMAD — One Meal", fastHours: 23, start: "18:00", end: "19:00" },
  { value: "custom", label: "Custom", fastHours: 16, start: "12:00", end: "20:00" },
];

export function FastingSettingsCard() {
  const [protocol, setProtocol] = useState<FastingProtocol>("16:8");
  const [fastHours, setFastHours] = useState(16);
  const [windowStart, setWindowStart] = useState("12:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [notifications, setNotifications] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getFastingSettings().then((s) => {
      if (s) {
        setProtocol(s.protocol as FastingProtocol);
        setFastHours(s.target_fast_hours);
        setWindowStart(s.eating_window_start);
        setWindowEnd(s.eating_window_end);
        setNotifications(s.notifications_enabled);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  function handleProtocolChange(value: FastingProtocol) {
    setProtocol(value);
    const preset = PROTOCOLS.find((p) => p.value === value);
    if (preset && value !== "custom") {
      setFastHours(preset.fastHours);
      setWindowStart(preset.start);
      setWindowEnd(preset.end);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateFastingSettings({
        protocol,
        target_fast_hours: fastHours,
        eating_window_start: windowStart,
        eating_window_end: windowEnd,
        notifications_enabled: notifications,
      });
      toast.success("Fasting settings saved");
    } catch {
      toast.error("Failed to save fasting settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intermittent Fasting</CardTitle>
        <CardDescription>Configure your fasting protocol and eating window</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Protocol</Label>
          <Select value={protocol} onValueChange={(v) => handleProtocolChange(v as FastingProtocol)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {protocol === "custom" && (
          <div className="space-y-2">
            <Label>Fasting Hours</Label>
            <Input
              type="number"
              min={1}
              max={23}
              value={fastHours}
              onChange={(e) => setFastHours(parseInt(e.target.value) || 16)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Eating Window Start</Label>
            <Input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Eating Window End</Label>
            <Input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          <span className="text-muted-foreground">Enable fasting notifications</span>
        </label>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Fasting Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add FastingSettingsCard to Settings page**

In `src/app/(app)/settings/page.tsx`, add import:
```typescript
import { FastingSettingsCard } from "@/components/settings/fasting-settings";
```

Add `<FastingSettingsCard />` after `<NutritionSettings>` and before `<TDEECalculator>`.

**Step 3: Commit**

```bash
git add src/components/settings/fasting-settings.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat: add fasting settings to Settings page with protocol presets"
```

---

### Task 11: Create Supabase database layer for meal plans

**Files:**
- Create: `src/lib/database/meal-plans.ts`

**Step 1: Create the meal plans database module**

```typescript
import { createClient } from "@/lib/supabase/client";
import type { MealPlan, MealPlanItem } from "@/types";

export async function getMealPlans(): Promise<MealPlan[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as MealPlan[];
}

export async function getMealPlanWithItems(planId: string): Promise<{
  plan: MealPlan;
  items: MealPlanItem[];
} | null> {
  const supabase = createClient();

  const [planRes, itemsRes] = await Promise.all([
    supabase.from("meal_plans").select("*").eq("id", planId).single(),
    supabase.from("meal_plan_items").select("*").eq("plan_id", planId).order("sort_order"),
  ]);

  if (planRes.error || !planRes.data) return null;
  if (itemsRes.error) throw itemsRes.error;

  return {
    plan: planRes.data as MealPlan,
    items: (itemsRes.data || []) as MealPlanItem[],
  };
}

export async function createMealPlan(plan: {
  name: string;
  description?: string;
  eating_window_start?: string;
  eating_window_end?: string;
  items: Array<{
    meal_name: string;
    target_time?: string;
    food_item: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
    serving_size?: string;
    sort_order: number;
  }>;
}): Promise<MealPlan> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: planData, error: planError } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      name: plan.name,
      description: plan.description || null,
      eating_window_start: plan.eating_window_start || null,
      eating_window_end: plan.eating_window_end || null,
    })
    .select()
    .single();

  if (planError || !planData) throw planError;

  if (plan.items.length > 0) {
    const itemsPayload = plan.items.map((item) => ({
      plan_id: planData.id,
      meal_name: item.meal_name,
      target_time: item.target_time || null,
      food_item: item.food_item,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fats_g: item.fats_g,
      serving_size: item.serving_size || null,
      sort_order: item.sort_order,
    }));

    const { error: itemsError } = await supabase
      .from("meal_plan_items")
      .insert(itemsPayload);

    if (itemsError) throw itemsError;
  }

  return planData as MealPlan;
}

export async function deleteMealPlan(planId: string): Promise<void> {
  const supabase = createClient();
  // Items cascade-delete via FK
  const { error } = await supabase.from("meal_plans").delete().eq("id", planId);
  if (error) throw error;
}

/** Apply a meal plan to today — copies all items as nutrition entries */
export async function applyMealPlanToDay(planId: string, date: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const planData = await getMealPlanWithItems(planId);
  if (!planData) throw new Error("Plan not found");

  const entries = planData.items.map((item) => ({
    user_id: user.id,
    date,
    meal_name: item.meal_name,
    food_item: item.food_item,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fats_g: item.fats_g,
  }));

  const { error } = await supabase.from("nutrition_entries").insert(entries);
  if (error) throw error;
}

/** Save current day's entries as a new meal plan */
export async function saveDayAsMealPlan(
  date: string,
  planName: string
): Promise<MealPlan> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: entries, error } = await supabase
    .from("nutrition_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("created_at");

  if (error) throw error;
  if (!entries || entries.length === 0) throw new Error("No entries to save");

  return createMealPlan({
    name: planName,
    items: entries.map((e, idx) => ({
      meal_name: e.meal_name,
      food_item: e.food_item,
      calories: e.calories,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fats_g: e.fats_g,
      sort_order: idx,
    })),
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/database/meal-plans.ts
git commit -m "feat: add Supabase database layer for meal plans with apply/save-day"
```

---

### Task 12: Build meal plan UI pages

**Files:**
- Create: `src/components/nutrition/meal-plan-card.tsx`
- Create: `src/app/(app)/nutrition/plans/page.tsx`
- Create: `src/app/(app)/nutrition/plans/new/page.tsx`

**Step 1: Create `src/components/nutrition/meal-plan-card.tsx`**

A summary card showing plan name, total macros, meal count, and action buttons.

```tsx
"use client";

import { Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MealPlan } from "@/types";

interface MealPlanCardProps {
  plan: MealPlan;
  totalMacros?: { calories: number; protein: number; carbs: number; fats: number };
  itemCount?: number;
  onApply: (planId: string) => void;
  onDelete: (planId: string) => void;
}

export function MealPlanCard({
  plan,
  totalMacros,
  itemCount,
  onApply,
  onDelete,
}: MealPlanCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4 px-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{plan.name}</h3>
          {plan.description && (
            <p className="text-xs text-muted-foreground truncate">{plan.description}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground tabular-nums">
            {totalMacros && (
              <span>
                {totalMacros.calories} cal · {totalMacros.protein}p · {totalMacros.carbs}c · {totalMacros.fats}f
              </span>
            )}
            {itemCount != null && <span>· {itemCount} items</span>}
            {plan.eating_window_start && plan.eating_window_end && (
              <span>· {plan.eating_window_start}–{plan.eating_window_end}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onApply(plan.id)}
            aria-label="Apply plan to today"
          >
            <Play className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(plan.id)}
            aria-label="Delete plan"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create `src/app/(app)/nutrition/plans/page.tsx`**

The meal plans list page with "New Plan" button and plan cards.

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { MealPlanCard } from "@/components/nutrition/meal-plan-card";
import {
  getMealPlans,
  getMealPlanWithItems,
  applyMealPlanToDay,
  deleteMealPlan,
} from "@/lib/database/meal-plans";
import { toast } from "sonner";
import type { MealPlan } from "@/types";

interface PlanWithMeta extends MealPlan {
  totalMacros?: { calories: number; protein: number; carbs: number; fats: number };
  itemCount?: number;
}

export default function MealPlansPage() {
  const [plans, setPlans] = useState<PlanWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadPlans = useCallback(async () => {
    try {
      const allPlans = await getMealPlans();
      const plansWithMeta: PlanWithMeta[] = await Promise.all(
        allPlans.map(async (plan) => {
          const detail = await getMealPlanWithItems(plan.id);
          if (!detail) return plan;
          const items = detail.items;
          const totals = items.reduce(
            (acc, i) => ({
              calories: acc.calories + i.calories,
              protein: acc.protein + i.protein_g,
              carbs: acc.carbs + i.carbs_g,
              fats: acc.fats + i.fats_g,
            }),
            { calories: 0, protein: 0, carbs: 0, fats: 0 }
          );
          return { ...plan, totalMacros: totals, itemCount: items.length };
        })
      );
      setPlans(plansWithMeta);
    } catch {
      toast.error("Failed to load meal plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  async function handleApply(planId: string) {
    try {
      await applyMealPlanToDay(planId, format(new Date(), "yyyy-MM-dd"));
      toast.success("Plan applied to today");
    } catch {
      toast.error("Failed to apply plan");
    }
  }

  async function handleDelete(planId: string) {
    try {
      await deleteMealPlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
      toast.success("Plan deleted");
    } catch {
      toast.error("Failed to delete plan");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Plans</h1>
          <p className="text-sm text-muted-foreground">Save and reuse your favorite daily meals</p>
        </div>
        <Button onClick={() => router.push("/nutrition/plans/new")}>
          <Plus className="size-4 mr-1.5" /> New Plan
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No meal plans yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <MealPlanCard
              key={plan.id}
              plan={plan}
              totalMacros={plan.totalMacros}
              itemCount={plan.itemCount}
              onApply={handleApply}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create `src/app/(app)/nutrition/plans/new/page.tsx`**

A form to create a new meal plan. Uses the same food entry pattern as the regular nutrition page, but adds items to a local list before saving the whole plan.

This is a larger component — it should include:
- Plan name input
- Optional description
- Optional eating window start/end time inputs
- A list of meal items with ability to add/remove
- Each item: meal name selector, food item (with FoodSearchInput), macros, target time
- Save button that calls `createMealPlan()`
- Back button to return to plans list

The implementer should follow the pattern of `template-builder.tsx` in the workout section for building up a list of items, and use `FoodSearchInput` + `BarcodeScanner` for food selection. The exact implementation should follow the existing codebase conventions (shadcn/ui cards, forms, buttons, toast notifications).

**Step 4: Commit**

```bash
git add src/components/nutrition/meal-plan-card.tsx "src/app/(app)/nutrition/plans/page.tsx" "src/app/(app)/nutrition/plans/new/page.tsx"
git commit -m "feat: add meal plans list and create pages"
```

---

### Task 13: Integrate fasting timer and meal plan links into Nutrition page

**Files:**
- Modify: `src/app/(app)/nutrition/page.tsx`

**Step 1: Add the fasting timer and meal plan navigation**

Read the file first. Add these imports:
```typescript
import { FastingTimer } from "@/components/nutrition/fasting-timer";
import { FastingStreak } from "@/components/nutrition/fasting-streak";
import { saveDayAsMealPlan } from "@/lib/database/meal-plans";
```

Add these elements to the page:

1. **Fasting timer** — add `<FastingTimer />` and `<FastingStreak />` at the very top of the page content, before the date navigator. Wrap them in a section:
```tsx
{/* Fasting tracker */}
<FastingTimer />
<FastingStreak />
```

2. **Meal plan navigation** — add a row of buttons above or near the "Add Food" button:
```tsx
<div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={() => router.push("/nutrition/plans")}>
    Meal Plans
  </Button>
  <Button
    variant="outline"
    size="sm"
    onClick={async () => {
      const name = prompt("Plan name:");
      if (!name) return;
      try {
        await saveDayAsMealPlan(date, name);
        toast.success("Saved as meal plan");
      } catch {
        toast.error("Failed to save plan");
      }
    }}
  >
    Save Day as Plan
  </Button>
</div>
```

Add missing imports for `useRouter` from `next/navigation` and `toast` from `sonner` if not already present.

**Step 2: Commit**

```bash
git add "src/app/(app)/nutrition/page.tsx"
git commit -m "feat: integrate fasting timer and meal plan links into Nutrition page"
```

---

### Task 14: Final verification — lint and build both targets

**Step 1: Lint all new files**

Run:
```bash
npx eslint src/lib/nutrition/ src/components/nutrition/fasting-timer.tsx src/components/nutrition/fasting-streak.tsx src/components/nutrition/food-search-input.tsx src/components/nutrition/serving-selector.tsx src/components/nutrition/barcode-scanner.tsx src/components/nutrition/meal-plan-card.tsx src/components/settings/fasting-settings.tsx src/lib/database/fasting.ts src/lib/database/meal-plans.ts
```

Expected: No errors on new files.

**Step 2: Verify web build**

Run: `npm run build`
Expected: SSR build succeeds.

**Step 3: Verify Capacitor build**

Run: `npm run build:cap && npx cap sync`
Expected: Static export succeeds, syncs to native projects.

**Step 4: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix: resolve lint and build issues for Phase 12"
```
