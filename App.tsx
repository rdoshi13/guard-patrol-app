// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SessionProvider } from "./src/context/SessionContext";
import { SettingsProvider } from "./src/context/SettingsContext";

export default function App() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SettingsProvider>
  );
}
