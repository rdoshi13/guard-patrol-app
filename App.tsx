// App.tsx
import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AppState, AppStateStatus } from "react-native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SessionProvider } from "./src/context/SessionContext";
import { SettingsProvider } from "./src/context/SettingsContext";
import { runAutoSyncIfDue } from "./src/sync/autoSync";

const AppBootstrap: React.FC = () => {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    runAutoSyncIfDue().catch(() => {
      // Best-effort sync only; do not block UI boot.
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground =
        appStateRef.current === "inactive" || appStateRef.current === "background";
      appStateRef.current = nextState;

      if (wasBackground && nextState === "active") {
        runAutoSyncIfDue().catch(() => {
          // Best-effort sync on resume.
        });
      }
    });

    return () => subscription.remove();
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
