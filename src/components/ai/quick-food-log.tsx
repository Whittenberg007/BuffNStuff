"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Check, Loader2, Sparkles, X } from "lucide-react";
import { parseFood } from "@/lib/ai/food-parser";
import { addNutritionEntry } from "@/lib/database/nutrition";
import { toast } from "sonner";
import type { ParsedFoodItem } from "@/types";

interface QuickFoodLogProps {
  date: string;
  onLogged: () => void;
}

export function QuickFoodLog({ date, onLogged }: QuickFoodLogProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParsedFoodItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);

    const result = await parseFood(input);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.items.length === 0) {
      setError("Could not identify any food items");
      return;
    }

    setItems(result.items);
  }

  async function handleConfirm() {
    try {
      for (const item of items) {
        await addNutritionEntry({
          date,
          meal_name: item.meal_name,
          food_item: item.food_item,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fats_g: item.fats_g,
          quantity_note: item.quantity_note,
        });
      }
      toast.success(
        `Logged ${items.length} item${items.length > 1 ? "s" : ""} with AI`
      );
      setItems([]);
      setInput("");
      onLogged();
    } catch {
      toast.error("Failed to log items");
    }
  }

  function handleCancel() {
    setItems([]);
    setError(null);
  }

  // Show confirmation card if items are parsed
  if (items.length > 0) {
    return (
      <Card className="border-primary/30">
        <CardContent className="py-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Bot className="size-4" /> AI parsed {items.length} item
            {items.length > 1 ? "s" : ""}:
          </p>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {item.quantity_note} {item.food_item}
              </span>
              <span className="tabular-nums">
                {item.calories} cal | {item.protein_g}P / {item.carbs_g}C /{" "}
                {item.fats_g}F
              </span>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="gap-1" onClick={handleConfirm}>
              <Check className="size-3" /> Log All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={handleCancel}
            >
              <X className="size-3" /> Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleParse();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you ate..."
            className="pl-9"
            disabled={loading}
          />
        </div>
        <Button type="submit" size="sm" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Parse"}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
