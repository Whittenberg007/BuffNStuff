import type { ParsedFoodItem } from "@/types";

export interface FoodParseResult {
  items: ParsedFoodItem[];
  error?: string;
}

// Client-side function to call the AI food parsing endpoint
export async function parseFood(description: string): Promise<FoodParseResult> {
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Log this food: ${description}`,
          },
        ],
        mode: "food_parse",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { items: [], error: text || "Failed to parse food" };
    }

    const data = await response.json();
    return { items: data.items || [], error: data.error };
  } catch {
    return { items: [], error: "AI service unavailable" };
  }
}
