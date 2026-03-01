"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FoodSearchInput } from "@/components/nutrition/food-search-input";
import { BarcodeScanner } from "@/components/nutrition/barcode-scanner";
import { createMealPlan, addMealPlanItem } from "@/lib/database/meal-plans";
import type { FoodProduct } from "@/lib/nutrition/food-search";
import { toast } from "sonner";

const MEAL_PRESETS = ["Breakfast", "Lunch", "Dinner", "Snack", "Post-workout"] as const;

interface PlanItem {
  tempId: string;
  meal_name: string;
  target_time: string;
  food_item: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

export default function NewMealPlanPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // New item form state
  const [newMeal, setNewMeal] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newFood, setNewFood] = useState("");
  const [newCal, setNewCal] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFats, setNewFats] = useState("");

  function handleProductSelect(macros: {
    food_item: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  }) {
    setNewFood(macros.food_item);
    setNewCal(macros.calories.toString());
    setNewProtein(macros.protein_g.toString());
    setNewCarbs(macros.carbs_g.toString());
    setNewFats(macros.fats_g.toString());
  }

  function handleBarcodeProduct(product: FoodProduct) {
    const macros = product.perServing || product.per100g;
    setNewFood(product.brand ? `${product.name} (${product.brand})` : product.name);
    setNewCal(macros.calories.toString());
    setNewProtein(macros.protein.toString());
    setNewCarbs(macros.carbs.toString());
    setNewFats(macros.fats.toString());
  }

  function addItem() {
    if (!newMeal || !newFood) return;
    setItems((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        meal_name: newMeal,
        target_time: newTime,
        food_item: newFood,
        calories: parseFloat(newCal) || 0,
        protein_g: parseFloat(newProtein) || 0,
        carbs_g: parseFloat(newCarbs) || 0,
        fats_g: parseFloat(newFats) || 0,
      },
    ]);
    // Reset item form
    setNewFood("");
    setNewCal("");
    setNewProtein("");
    setNewCarbs("");
    setNewFats("");
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  async function handleSave() {
    if (!name) {
      toast.error("Plan name is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one food item");
      return;
    }

    setIsSaving(true);
    try {
      const plan = await createMealPlan({
        name,
        description: description || null,
        eating_window_start: windowStart || null,
        eating_window_end: windowEnd || null,
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await addMealPlanItem({
          plan_id: plan.id,
          meal_name: item.meal_name,
          target_time: item.target_time || null,
          food_item: item.food_item,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fats_g: item.fats_g,
          sort_order: i,
        });
      }

      toast.success("Meal plan created!");
      router.push("/nutrition/plans");
    } catch {
      toast.error("Failed to create plan");
    } finally {
      setIsSaving(false);
    }
  }

  const totalMacros = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein_g,
      carbs: acc.carbs + item.carbs_g,
      fats: acc.fats + item.fats_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold">New Meal Plan</h1>
      </div>

      {/* Plan details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan Name</Label>
            <Input
              id="plan-name"
              placeholder='e.g. "Cutting Day", "High Carb Day"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-desc">Description (optional)</Label>
            <Input
              id="plan-desc"
              placeholder="Notes about this plan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
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
        </CardContent>
      </Card>

      {/* Add food item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Food Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Meal</Label>
              <Select value={newMeal} onValueChange={setNewMeal}>
                <SelectTrigger>
                  <SelectValue placeholder="Select meal" />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_PRESETS.map((meal) => (
                    <SelectItem key={meal} value={meal}>{meal}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Time</Label>
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Food Item</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <FoodSearchInput
                  value={newFood}
                  onChange={setNewFood}
                  onProductSelect={handleProductSelect}
                />
              </div>
              <BarcodeScanner onProductFound={handleBarcodeProduct} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Calories</Label>
              <Input type="number" min={0} value={newCal} onChange={(e) => setNewCal(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Protein</Label>
              <Input type="number" min={0} step="0.1" value={newProtein} onChange={(e) => setNewProtein(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Carbs</Label>
              <Input type="number" min={0} step="0.1" value={newCarbs} onChange={(e) => setNewCarbs(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fats</Label>
              <Input type="number" min={0} step="0.1" value={newFats} onChange={(e) => setNewFats(e.target.value)} placeholder="0" />
            </div>
          </div>

          <Button type="button" variant="secondary" className="w-full" onClick={addItem} disabled={!newMeal || !newFood}>
            <Plus className="size-4 mr-1" />
            Add to Plan
          </Button>
        </CardContent>
      </Card>

      {/* Items list */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Plan Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => (
              <div key={item.tempId} className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.food_item}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.meal_name}</span>
                    {item.target_time && <span>at {item.target_time}</span>}
                    <span className="tabular-nums">{item.calories} cal</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive shrink-0"
                  onClick={() => removeItem(item.tempId)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}

            <Separator />
            <div className="flex justify-between text-sm font-medium tabular-nums">
              <span>Total</span>
              <span>{totalMacros.calories} cal | {totalMacros.protein}P {totalMacros.carbs}C {totalMacros.fats}F</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <Button className="w-full" onClick={handleSave} disabled={isSaving || !name || items.length === 0}>
        {isSaving ? "Saving..." : "Save Meal Plan"}
      </Button>
    </div>
  );
}
