"use client";

import { X } from "lucide-react";
import type { NutritionFavorite } from "@/types";

interface FavoritesListProps {
  favorites: NutritionFavorite[];
  onSelect: (favorite: NutritionFavorite) => void;
  onDelete: (id: string) => void;
}

export function FavoritesList({
  favorites,
  onSelect,
  onDelete,
}: FavoritesListProps) {
  if (favorites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No favorites yet. Add entries and check &quot;Save as favorite&quot; to
        build your quick-add list.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="group relative inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-sm transition-colors hover:bg-secondary cursor-pointer"
          onClick={() => onSelect(fav)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(fav);
            }
          }}
        >
          <span className="font-medium">{fav.food_item}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {fav.calories}cal &middot; {fav.protein_g}p
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(fav.id);
            }}
            className="ml-0.5 inline-flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
            aria-label={`Remove ${fav.food_item} from favorites`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
