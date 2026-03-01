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
