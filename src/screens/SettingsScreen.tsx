// src/screens/SettingsScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { AppButton } from "../components/AppButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";

export const SettingsScreen: React.FC = () => {
  const { language, setLanguage } = useSettings();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(language, "settingsTitle")}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t(language, "currentLanguage")}
        </Text>

        <View style={styles.langRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <AppButton
              title={t(language, "english")}
              onPress={() => setLanguage("en")}
              variant={language === "en" ? "primary" : "secondary"}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 8 }}>
            <AppButton
              title={t(language, "gujarati")}
              onPress={() => setLanguage("gu")}
              variant={language === "gu" ? "primary" : "secondary"}
            />
          </View>
        </View>

        <Text style={styles.helper}>
          Patrol + visitors sync runs automatically every 12 hours (once Sheets
          is connected).
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Admin</Text>

        <AppButton
          title="Manage Guards"
          onPress={() => navigation.navigate("AdminPin")}
          variant="secondary"
        />

        <Text style={styles.helper}>
          Requires PIN. You can’t edit/delete a guard who is currently on duty.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "800", marginTop: 8, marginBottom: 12 },

  card: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
  },

  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },

  langRow: { flexDirection: "row" },

  helper: { marginTop: 10, fontSize: 12, color: "#546e7a" },
});
