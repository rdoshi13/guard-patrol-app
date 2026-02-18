// App.tsx
import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AppState, AppStateStatus } from "react-native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SessionProvider } from "./src/context/SessionContext";
import { SettingsProvider } from "./src/context/SettingsContext";
import { runAutoSyncIfDue } from "./src/sync/autoSync";

const AUTO_SYNC_POLL_MS = 60 * 1000;

const AppBootstrap: React.FC = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const triggerAutoSync = () =>
      runAutoSyncIfDue().catch(() => {
        // Best-effort sync only; do not block UI boot.
      });

    triggerAutoSync();

    const intervalId = setInterval(() => {
      // Keep scheduled auto-sync running while app stays in foreground.
      if (appStateRef.current === "active") {
        triggerAutoSync();
      }
    }, AUTO_SYNC_POLL_MS);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground =
        appStateRef.current === "inactive" || appStateRef.current === "background";
      appStateRef.current = nextState;

      if (wasBackground && nextState === "active") {
        triggerAutoSync();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  return null;
};

export default function App() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <AppBootstrap />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SettingsProvider>
  );
}
