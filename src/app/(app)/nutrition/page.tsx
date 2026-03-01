"use client";

import { useCallback, useEffect, useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Star, UtensilsCrossed, Save, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MacroProgressBars } from "@/components/nutrition/macro-progress-bars";
import {
  FoodEntryForm,
  type FoodEntryFormData,
} from "@/components/nutrition/food-entry-form";
import { MealSection } from "@/components/nutrition/meal-section";
import { FavoritesList } from "@/components/nutrition/favorites-list";
import {
  getDailyLog,
  addNutritionEntry,
  updateNutritionEntry,
  deleteNutritionEntry,
  getDailyTotals,
  getFavorites,
  addFavorite,
  deleteFavorite,
} from "@/lib/database/nutrition";
import type { NutritionEntry, NutritionFavorite } from "@/types";
import { FastingTimer } from "@/components/nutrition/fasting-timer";
import { FastingStreak } from "@/components/nutrition/fasting-streak";
import { saveDayAsPlan } from "@/lib/database/meal-plans";
import Link from "next/link";
import { toast } from "sonner";

// Default targets — will be overridden by user settings when available
const DEFAULT_TARGETS = {
  calories: 2500,
  protein: 180,
  carbs: 280,
  fats: 80,
};

export default function NutritionPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [totals, setTotals] = useState({
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fats_g: 0,
  });
  const [favorites, setFavorites] = useState<NutritionFavorite[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NutritionEntry | null>(null);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [logData, totalsData, favsData] = await Promise.all([
        getDailyLog(date),
        getDailyTotals(date),
        getFavorites(),
      ]);
      setEntries(logData);
      setTotals(totalsData);
      setFavorites(favsData);
    } catch {
      // Silently handle errors — user may not be authenticated yet
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function goToPreviousDay() {
    setDate((d) => format(subDays(new Date(d + "T00:00:00"), 1), "yyyy-MM-dd"));
  }

  function goToNextDay() {
    setDate((d) => format(addDays(new Date(d + "T00:00:00"), 1), "yyyy-MM-dd"));
  }

  function goToToday() {
    setDate(format(new Date(), "yyyy-MM-dd"));
  }

  const isToday = date === format(new Date(), "yyyy-MM-dd");

  // Group entries by meal name
  const mealGroups = entries.reduce<Record<string, NutritionEntry[]>>(
    (groups, entry) => {
      const key = entry.meal_name;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
      return groups;
    },
    {}
  );

  // Sort meals in a sensible order
  const MEAL_ORDER = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snack",
    "Post-workout",
  ];
  const sortedMealNames = Object.keys(mealGroups).sort((a, b) => {
    const aIdx = MEAL_ORDER.indexOf(a);
    const bIdx = MEAL_ORDER.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  async function handleAddEntry(data: FoodEntryFormData) {
    await addNutritionEntry({
      date,
      meal_name: data.meal_name,
      food_item: data.food_item,
      calories: data.calories,
      protein_g: data.protein_g,
      carbs_g: data.carbs_g,
      fats_g: data.fats_g,
    });

    if (data.save_as_favorite) {
      await addFavorite({
        food_item: data.food_item,
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fats_g: data.fats_g,
      });
    }

    setIsAddOpen(false);
    await loadData();
  }

  async function handleUpdateEntry(data: FoodEntryFormData) {
    if (!editingEntry) return;
    await updateNutritionEntry(editingEntry.id, {
      meal_name: data.meal_name,
      food_item: data.food_item,
      calories: data.calories,
      protein_g: data.protein_g,
      carbs_g: data.carbs_g,
      fats_g: data.fats_g,
    });

    if (data.save_as_favorite) {
      await addFavorite({
        food_item: data.food_item,
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fats_g: data.fats_g,
      });
    }

    setEditingEntry(null);
    await loadData();
  }

  async function handleDeleteEntry(id: string) {
    await deleteNutritionEntry(id);
    await loadData();
  }

  async function handleDeleteFavorite(id: string) {
    await deleteFavorite(id);
    await loadData();
  }

  function handleFavoriteSelect(fav: NutritionFavorite) {
    setIsAddOpen(true);
    // The form will be pre-filled via initialData on next render cycle
    // We use a small trick: set a temp state so the dialog opens with data
    setEditingEntry(null);
    setFavPrefill(fav);
  }

  const [favPrefill, setFavPrefill] = useState<NutritionFavorite | null>(null);

  // Clear prefill when dialog closes
  useEffect(() => {
    if (!isAddOpen) setFavPrefill(null);
  }, [isAddOpen]);

  const displayDate = format(new Date(date + "T00:00:00"), "EEEE, MMM d");

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted-foreground">
          Track your daily macros
        </p>
      </div>

      {/* Fasting Timer */}
      <FastingTimer />

      {/* Date navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <button
            onClick={goToToday}
            className="text-sm font-medium hover:underline"
          >
            {isToday ? "Today" : displayDate}
          </button>
          {!isToday && (
            <p className="text-xs text-muted-foreground">{date}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={goToNextDay}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Macro progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Macros</CardTitle>
        </CardHeader>
        <CardContent>
          <MacroProgressBars totals={totals} targets={DEFAULT_TARGETS} />
        </CardContent>
      </Card>

      {/* Add Food button */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="size-4" />
            Add Food
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Food Entry</DialogTitle>
          </DialogHeader>
          <FoodEntryForm
            onSubmit={handleAddEntry}
            favorites={favorites}
            initialData={
              favPrefill
                ? {
                    food_item: favPrefill.food_item,
                    calories: favPrefill.calories,
                    protein_g: favPrefill.protein_g,
                    carbs_g: favPrefill.carbs_g,
                    fats_g: favPrefill.fats_g,
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>

      {/* Fasting streak + Meal plan actions */}
      <div className="flex items-center justify-between">
        <FastingStreak />
        <div className="flex gap-2">
          <Link href="/share">
            <Button variant="outline" size="sm" className="gap-1">
              <Share2 className="size-3.5" />
              Share
            </Button>
          </Link>
          <Link href="/nutrition/plans">
            <Button variant="outline" size="sm" className="gap-1">
              <UtensilsCrossed className="size-3.5" />
              Plans
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              try {
                const planName = `${displayDate} Plan`;
                await saveDayAsPlan(date, planName);
                toast.success("Day saved as meal plan!");
              } catch {
                toast.error("Failed to save as plan (no entries?)");
              }
            }}
          >
            <Save className="size-3.5" />
            Save Day
          </Button>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Food Entry</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <FoodEntryForm
              onSubmit={handleUpdateEntry}
              favorites={favorites}
              initialData={{
                meal_name: editingEntry.meal_name,
                food_item: editingEntry.food_item,
                calories: editingEntry.calories,
                protein_g: editingEntry.protein_g,
                carbs_g: editingEntry.carbs_g,
                fats_g: editingEntry.fats_g,
              }}
              submitLabel="Update Entry"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Meal sections */}
      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : sortedMealNames.length > 0 ? (
        <Card>
          <CardContent className="divide-y divide-border">
            {sortedMealNames.map((mealName) => (
              <MealSection
                key={mealName}
                mealName={mealName}
                entries={mealGroups[mealName]}
                onEdit={setEditingEntry}
                onDelete={handleDeleteEntry}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No food entries for this day. Tap &quot;Add Food&quot; to get started.
        </div>
      )}

      {/* Favorites section (collapsible) */}
      <div>
        <Separator className="mb-4" />
        <button
          onClick={() => setFavoritesExpanded(!favoritesExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Star className="size-4" />
          Favorites ({favorites.length})
          <ChevronRight
            className={`size-4 ml-auto transition-transform ${
              favoritesExpanded ? "rotate-90" : ""
            }`}
          />
        </button>
        {favoritesExpanded && (
          <div className="mt-3">
            <FavoritesList
              favorites={favorites}
              onSelect={handleFavoriteSelect}
              onDelete={handleDeleteFavorite}
            />
          </div>
        )}
      </div>
    </div>
  );
}
