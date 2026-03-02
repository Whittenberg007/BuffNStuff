"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import { Loader2, Send, Check } from "lucide-react";
import { toast } from "sonner";
import { addNutritionEntry } from "@/lib/database/nutrition";
import { format } from "date-fns";
import { v4 as uuid } from "uuid";
import type { ChatMessage as ChatMessageType, ParsedFoodItem } from "@/types";

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingFoodItems, setPendingFoodItems] = useState<ParsedFoodItem[]>(
    []
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessageType = {
      id: uuid(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const allMessages = [...messages, userMessage];
    setMessages(allMessages);
    setInput("");
    setIsStreaming(true);

    // Create placeholder for assistant response
    const assistantId = uuid();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode: "chat",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errorText || "Something went wrong." }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Check for food items marker
        const foodMatch = fullText.match(/<!--FOOD_ITEMS:(.*?)-->/);
        if (foodMatch) {
          try {
            const parsed = JSON.parse(foodMatch[1]);
            if (parsed.action === "confirm_food_log" && parsed.items?.length) {
              setPendingFoodItems(parsed.items);
            }
          } catch {
            // ignore parse errors
          }
          // Remove the marker from displayed text
          fullText = fullText.replace(/<!--FOOD_ITEMS:.*?-->/, "");
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullText.trim() } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: "Sorry, the AI coach is unavailable right now.",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, isStreaming, messages]);

  async function handleConfirmFood() {
    if (!pendingFoodItems.length) return;

    const today = format(new Date(), "yyyy-MM-dd");
    try {
      for (const item of pendingFoodItems) {
        await addNutritionEntry({
          date: today,
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
        `Logged ${pendingFoodItems.length} food item${pendingFoodItems.length > 1 ? "s" : ""}`
      );
      setPendingFoodItems([]);
    } catch {
      toast.error("Failed to log food items");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="size-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <span className="text-2xl">💪</span>
            </div>
            <h2 className="text-lg font-semibold">BuffCoach</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Your AI training coach. Ask about your progress, get workout
              suggestions, or log food with natural language.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                "How's my training this week?",
                "What should I work on today?",
                "Log: chicken breast with rice",
                "Am I hitting my protein goals?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-muted-foreground hover:bg-zinc-800 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}

        {/* Streaming indicator */}
        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-3 px-4 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Food confirmation card */}
      {pendingFoodItems.length > 0 && (
        <Card className="mx-4 mb-2 border-primary/30">
          <CardContent className="py-3 space-y-2">
            <p className="text-sm font-medium">Confirm food log:</p>
            {pendingFoodItems.map((item, i) => (
              <div
                key={i}
                className="flex justify-between text-xs text-muted-foreground"
              >
                <span>
                  {item.quantity_note} {item.food_item}
                </span>
                <span>
                  {item.calories} cal | {item.protein_g}g P
                </span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="gap-1"
                onClick={handleConfirmFood}
              >
                <Check className="size-3" /> Log Items
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingFoodItems([])}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input area */}
      <div className="border-t border-zinc-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach anything..."
            className="flex-1"
            disabled={isStreaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isStreaming || !input.trim()}
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
