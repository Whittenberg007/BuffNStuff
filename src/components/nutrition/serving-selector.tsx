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
