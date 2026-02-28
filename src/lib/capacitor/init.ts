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
