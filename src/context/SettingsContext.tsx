// src/context/SettingsContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SupportedLanguage } from "../i18n/strings";

type SettingsContextValue = {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

const LANGUAGE_KEY = "language";

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");

  // load saved language once
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (stored === "en" || stored === "gu" || stored === "hi") {
          setLanguageState(stored);
        }
      } catch {
        // ignore errors for now
      }
    };

    load();
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang); // update state
    AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(() => {
      // ignore storage error
    });
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
};
