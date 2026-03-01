"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NutritionFavorite } from "@/types";
import { FoodSearchInput } from "./food-search-input";
import { BarcodeScanner } from "./barcode-scanner";
import type { FoodProduct } from "@/lib/nutrition/food-search";

const MEAL_PRESETS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Post-workout",
] as const;

export interface FoodEntryFormData {
  meal_name: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  save_as_favorite: boolean;
}

interface FoodEntryFormProps {
  onSubmit: (data: FoodEntryFormData) => Promise<void>;
  favorites?: NutritionFavorite[];
  onFavoriteSelect?: (favorite: NutritionFavorite) => void;
  initialData?: Partial<FoodEntryFormData>;
  submitLabel?: string;
}

export function FoodEntryForm({
  onSubmit,
  favorites = [],
  initialData,
  submitLabel = "Add Entry",
}: FoodEntryFormProps) {
  const [mealName, setMealName] = useState(initialData?.meal_name || "");
  const [customMeal, setCustomMeal] = useState("");
  const [foodItem, setFoodItem] = useState(initialData?.food_item || "");
  const [calories, setCalories] = useState(
    initialData?.calories?.toString() || ""
  );
  const [proteinG, setProteinG] = useState(
    initialData?.protein_g?.toString() || ""
  );
  const [carbsG, setCarbsG] = useState(
    initialData?.carbs_g?.toString() || ""
  );
  const [fatsG, setFatsG] = useState(
    initialData?.fats_g?.toString() || ""
  );
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCustomMeal = mealName === "Custom";
  const effectiveMealName = isCustomMeal ? customMeal : mealName;

  function fillFromFavorite(fav: NutritionFavorite) {
    setFoodItem(fav.food_item);
    setCalories(fav.calories.toString());
    setProteinG(fav.protein_g.toString());
    setCarbsG(fav.carbs_g.toString());
    setFatsG(fav.fats_g.toString());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveMealName || !foodItem) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        meal_name: effectiveMealName,
        food_item: foodItem,
        calories: parseFloat(calories) || 0,
        protein_g: parseFloat(proteinG) || 0,
        carbs_g: parseFloat(carbsG) || 0,
        fats_g: parseFloat(fatsG) || 0,
        save_as_favorite: saveAsFavorite,
      });
      // Reset form
      setFoodItem("");
      setCalories("");
      setProteinG("");
      setCarbsG("");
      setFatsG("");
      setSaveAsFavorite(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Quick add from favorites */}
      {favorites.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Quick add from favorites
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((fav) => (
              <button
                key={fav.id}
                type="button"
                onClick={() => fillFromFavorite(fav)}
                className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary"
              >
                {fav.food_item}
                <span className="ml-1 text-muted-foreground">
                  {fav.calories}cal
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meal selector */}
      <div className="space-y-2">
        <Label htmlFor="meal-name">Meal</Label>
        <Select value={mealName} onValueChange={setMealName}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a meal" />
          </SelectTrigger>
          <SelectContent>
            {MEAL_PRESETS.map((meal) => (
              <SelectItem key={meal} value={meal}>
                {meal}
              </SelectItem>
            ))}
            <SelectItem value="Custom">Custom...</SelectItem>
          </SelectContent>
        </Select>
        {isCustomMeal && (
          <Input
            placeholder="Enter custom meal name"
            value={customMeal}
            onChange={(e) => setCustomMeal(e.target.value)}
          />
        )}
      </div>

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

      {/* Macro inputs row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="calories" className="text-xs">
            Calories
          </Label>
          <Input
            id="calories"
            type="number"
            placeholder="0"
            min={0}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="protein" className="text-xs">
            Protein (g)
          </Label>
          <Input
            id="protein"
            type="number"
            placeholder="0"
            min={0}
            step="0.1"
            value={proteinG}
            onChange={(e) => setProteinG(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="carbs" className="text-xs">
            Carbs (g)
          </Label>
          <Input
            id="carbs"
            type="number"
            placeholder="0"
            min={0}
            step="0.1"
            value={carbsG}
            onChange={(e) => setCarbsG(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fats" className="text-xs">
            Fats (g)
          </Label>
          <Input
            id="fats"
            type="number"
            placeholder="0"
            min={0}
            step="0.1"
            value={fatsG}
            onChange={(e) => setFatsG(e.target.value)}
          />
        </div>
      </div>

      {/* Save as favorite */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={saveAsFavorite}
          onChange={(e) => setSaveAsFavorite(e.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        <span className="text-muted-foreground">Save as favorite</span>
      </label>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isSubmitting || !effectiveMealName || !foodItem}
        className="w-full"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
