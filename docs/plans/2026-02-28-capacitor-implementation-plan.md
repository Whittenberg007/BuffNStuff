# Capacitor Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Capacitor for native Android and iOS builds with full plugin suite (StatusBar, SplashScreen, App, Haptics, Camera, Push/Local Notifications) while preserving SSR web deployment.

**Architecture:** Dual-target build — `npm run build` produces SSR for Vercel, `npm run build:cap` produces static export for Capacitor. A client-side auth guard replaces middleware on native. Platform detection utility gates native-only features.

**Tech Stack:** Capacitor 8, @capacitor/ios, @capacitor/android, @capacitor/status-bar, @capacitor/splash-screen, @capacitor/app, @capacitor/haptics, @capacitor/camera, @capacitor/push-notifications, @capacitor/local-notifications

---

### Task 1: Install Capacitor plugins and native platform packages

**Files:**
- Modify: `package.json`

**Step 1: Install all Capacitor plugins**

Run:
```bash
npm install @capacitor/ios @capacitor/android @capacitor/status-bar @capacitor/splash-screen @capacitor/app @capacitor/haptics @capacitor/camera @capacitor/push-notifications @capacitor/local-notifications
```

**Step 2: Verify installation**

Run: `npx cap --version`
Expected: Version 8.x.x output

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install Capacitor plugins and native platform packages"
```

---

### Task 2: Create Capacitor config and update Next.js for dual-target builds

**Files:**
- Create: `capacitor.config.ts`
- Modify: `next.config.ts`
- Modify: `package.json` (scripts only)

**Step 1: Create `capacitor.config.ts`**

```typescript
/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/push-notifications" />
/// <reference types="@capacitor/local-notifications" />
/// <reference types="@capacitor/status-bar" />

import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.buffnstuff.app",
  appName: "BuffNStuff",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#09090b",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#09090b",
    },
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
```

**Step 2: Update `next.config.ts` for conditional static export**

```typescript
import type { NextConfig } from "next";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: "export",
    images: {
      unoptimized: true,
    },
  }),
};

export default nextConfig;
```

**Step 3: Add build scripts to `package.json`**

Add these scripts (keep existing ones):
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:cap": "CAPACITOR_BUILD=true next build",
    "start": "next start",
    "lint": "eslint",
    "cap:sync": "npx cap sync",
    "cap:android": "npx cap open android",
    "cap:ios": "npx cap open ios"
  }
}
```

Note: On Windows, `CAPACITOR_BUILD=true` in the npm script requires `cross-env` or using `set CAPACITOR_BUILD=true&&`. Use cross-env for cross-platform support:

Run: `npm install -D cross-env`

Then the script becomes:
```json
"build:cap": "cross-env CAPACITOR_BUILD=true next build"
```

**Step 4: Commit**

```bash
git add capacitor.config.ts next.config.ts package.json package-lock.json
git commit -m "feat: add Capacitor config and dual-target build system"
```

---

### Task 3: Create platform detection utility

**Files:**
- Create: `src/lib/capacitor/platform.ts`

**Step 1: Create the platform utility**

```typescript
import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function isWeb(): boolean {
  return Capacitor.getPlatform() === "web";
}
```

**Step 2: Commit**

```bash
git add src/lib/capacitor/platform.ts
git commit -m "feat: add Capacitor platform detection utility"
```

---

### Task 4: Create client-side auth guard for native

**Files:**
- Create: `src/components/capacitor/auth-guard.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Step 1: Create `src/components/capacitor/auth-guard.tsx`**

This component checks Supabase auth client-side when running inside Capacitor (where middleware doesn't exist).

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isNative } from "@/lib/capacitor/platform";

export function CapacitorAuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) {
      // On web, middleware handles auth — skip client-side check
      setChecked(true);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      } else {
        setChecked(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
```

**Step 2: Wrap `(app)` layout with the auth guard**

Modify `src/app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { CapacitorAuthGuard } from "@/components/capacitor/auth-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CapacitorAuthGuard>
      <AppShell>{children}</AppShell>
    </CapacitorAuthGuard>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/capacitor/auth-guard.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: add client-side auth guard for Capacitor native builds"
```

---

### Task 5: Create native initialization module (StatusBar, SplashScreen, App back button)

**Files:**
- Create: `src/lib/capacitor/init.ts`
- Create: `src/components/capacitor/native-init.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create `src/lib/capacitor/init.ts`**

This module initializes native features on app startup.

```typescript
import { isNative, isAndroid } from "./platform";

export async function initializeNativeApp(): Promise<void> {
  if (!isNative()) return;

  const { StatusBar, Style } = await import("@capacitor/status-bar");
  const { SplashScreen } = await import("@capacitor/splash-screen");
  const { App } = await import("@capacitor/app");

  // Dark status bar to match app theme
  await StatusBar.setStyle({ style: Style.Dark });

  if (isAndroid()) {
    await StatusBar.setBackgroundColor({ color: "#09090b" });
  }

  // Hide splash screen after init
  await SplashScreen.hide();

  // Handle Android hardware back button
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });
}
```

**Step 2: Create `src/components/capacitor/native-init.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { initializeNativeApp } from "@/lib/capacitor/init";

export function NativeInit() {
  useEffect(() => {
    initializeNativeApp();
  }, []);

  return null;
}
```

**Step 3: Add `<NativeInit />` to root layout**

Modify `src/app/layout.tsx` — add the import and component alongside existing PWA components:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import { NativeInit } from "@/components/capacitor/native-init";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BuffNStuff",
  description: "Track your workouts, nutrition, and progress",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-100 antialiased`}
      >
        <NativeInit />
        <ServiceWorkerRegister />
        {children}
        <OfflineIndicator />
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/capacitor/init.ts src/components/capacitor/native-init.tsx src/app/layout.tsx
git commit -m "feat: add native initialization — StatusBar, SplashScreen, back button handling"
```

---

### Task 6: Create haptics utility and integrate into workout flow

**Files:**
- Create: `src/lib/capacitor/haptics.ts`
- Modify: `src/components/workout/set-logger.tsx` (line ~100, after `onSetLogged(newSet)`)
- Modify: `src/components/workout/rest-timer.tsx` (line ~58, inside `onComplete?.()` block)

**Step 1: Create `src/lib/capacitor/haptics.ts`**

```typescript
import { isNative } from "./platform";

export async function hapticImpact(style: "light" | "medium" | "heavy" = "medium"): Promise<void> {
  if (!isNative()) return;

  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  const styleMap = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };
  await Haptics.impact({ style: styleMap[style] });
}

export async function hapticNotification(type: "success" | "warning" | "error" = "success"): Promise<void> {
  if (!isNative()) return;

  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  const typeMap = {
    success: NotificationType.Success,
    warning: NotificationType.Warning,
    error: NotificationType.Error,
  };
  await Haptics.notification({ type: typeMap[type] });
}
```

**Step 2: Add haptic feedback to set-logger**

In `src/components/workout/set-logger.tsx`, add import at top:

```typescript
import { hapticNotification } from "@/lib/capacitor/haptics";
```

Then after line 100 (`onSetLogged(newSet);`), add:

```typescript
      hapticNotification("success");
```

**Step 3: Add haptic feedback to rest timer completion**

In `src/components/workout/rest-timer.tsx`, add import at top:

```typescript
import { hapticNotification } from "@/lib/capacitor/haptics";
```

Then in the countdown effect (line ~58), inside the `if (prev <= 1)` block, after `onComplete?.();`, add:

```typescript
            hapticNotification("warning");
```

**Step 4: Commit**

```bash
git add src/lib/capacitor/haptics.ts src/components/workout/set-logger.tsx src/components/workout/rest-timer.tsx
git commit -m "feat: add haptic feedback on set logging and rest timer completion"
```

---

### Task 7: Create camera utility for progress photos

**Files:**
- Create: `src/lib/capacitor/camera.ts`

**Step 1: Create the camera utility**

```typescript
import { isNative } from "./platform";

export interface PhotoResult {
  dataUrl: string;
  format: string;
}

export async function takePhoto(): Promise<PhotoResult | null> {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      width: 1080,
      height: 1080,
    });

    if (!photo.dataUrl) return null;

    return {
      dataUrl: photo.dataUrl,
      format: photo.format,
    };
  } catch {
    // User cancelled or permission denied
    return null;
  }
}

export async function pickFromGallery(): Promise<PhotoResult | null> {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      width: 1080,
      height: 1080,
    });

    if (!photo.dataUrl) return null;

    return {
      dataUrl: photo.dataUrl,
      format: photo.format,
    };
  } catch {
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/capacitor/camera.ts
git commit -m "feat: add camera utility for progress photos"
```

---

### Task 8: Create notifications utility (push + local)

**Files:**
- Create: `src/lib/capacitor/notifications.ts`

**Step 1: Create the notifications utility**

```typescript
import { isNative } from "./platform";

/** Register for push notifications and return the device token */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isNative()) return null;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") return null;

  return new Promise((resolve) => {
    PushNotifications.addListener("registration", (token) => {
      resolve(token.value);
    });

    PushNotifications.addListener("registrationError", () => {
      resolve(null);
    });

    PushNotifications.register();
  });
}

/** Schedule a local notification (e.g., rest timer alert, workout reminder) */
export async function scheduleLocalNotification(options: {
  title: string;
  body: string;
  id?: number;
  scheduleAt?: Date;
}): Promise<void> {
  if (!isNative()) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: options.id ?? Date.now(),
        title: options.title,
        body: options.body,
        ...(options.scheduleAt && {
          schedule: { at: options.scheduleAt },
        }),
      },
    ],
  });
}

/** Cancel all pending local notifications */
export async function cancelAllLocalNotifications(): Promise<void> {
  if (!isNative()) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/capacitor/notifications.ts
git commit -m "feat: add push and local notification utilities"
```

---

### Task 9: Skip service worker on native + update .gitignore

**Files:**
- Modify: `src/components/pwa/sw-register.tsx`
- Modify: `.gitignore`

**Step 1: Skip SW registration on native**

Replace `src/components/pwa/sw-register.tsx` content:

```tsx
"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/capacitor/platform";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Skip service worker on native — Capacitor handles caching
    if (isNative()) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed
      });
    }
  }, []);

  return null;
}
```

**Step 2: Add native project directories to `.gitignore`**

Append to `.gitignore`:

```
# capacitor native projects
/android/
/ios/
```

**Step 3: Commit**

```bash
git add src/components/pwa/sw-register.tsx .gitignore
git commit -m "feat: skip service worker on native, add Capacitor dirs to gitignore"
```

---

### Task 10: Add native platforms and verify build

**Files:**
- No source file changes — CLI commands only

**Step 1: Run the Capacitor static export build**

Run:
```bash
npm run build:cap
```

Expected: Next.js builds successfully and outputs to `out/` directory.

**Step 2: Add Android platform**

Run:
```bash
npx cap add android
```

Expected: `android/` directory created with native project.

**Step 3: Add iOS platform**

Run:
```bash
npx cap add ios
```

Expected: `ios/` directory created with native project. (Will fail on Windows without Xcode — that's OK.)

**Step 4: Sync web assets to native projects**

Run:
```bash
npx cap sync
```

Expected: Copies `out/` contents into native projects and syncs plugin configurations.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize Capacitor Android and iOS platforms"
```

Note: Since `android/` and `ios/` are in `.gitignore`, this commit will only capture any other generated files (like `capacitor.config.ts` updates if any).

---

### Task 11: Final verification — build both targets

**Step 1: Verify web build still works**

Run:
```bash
npm run build
```

Expected: Standard Next.js SSR build succeeds (no `output: 'export'` since env var is not set).

**Step 2: Verify Capacitor build works**

Run:
```bash
npm run build:cap && npx cap sync
```

Expected: Static export to `out/` succeeds, cap sync copies assets to native projects.

**Step 3: Verify lint passes**

Run:
```bash
npm run lint
```

Expected: No errors.
