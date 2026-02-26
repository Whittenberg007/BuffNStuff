"use client";

import { useEffect, useState, useCallback } from "react";
import { WifiOff, X, RefreshCw } from "lucide-react";
import { getPendingSyncCount, syncPendingData } from "@/lib/offline/sync";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
      refreshPendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      refreshPendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check pending count on mount and periodically
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 10_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPendingData();
      await refreshPendingCount();
    } catch {
      // Sync failed
    } finally {
      setSyncing(false);
    }
  };

  // Nothing to show
  if (isOnline && pendingCount === 0) return null;
  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 shadow-lg">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex-1 text-sm">
          {!isOnline && (
            <p className="text-amber-400">
              You&apos;re offline. Data will sync when connected.
            </p>
          )}
          {pendingCount > 0 && (
            <p className="text-zinc-400">
              {pendingCount} {pendingCount === 1 ? "item" : "items"} pending
              sync
              {isOnline && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="ml-2 inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync now"}
                </button>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-zinc-500 hover:text-zinc-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
