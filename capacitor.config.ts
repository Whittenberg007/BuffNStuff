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
