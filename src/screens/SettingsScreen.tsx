// src/screens/SettingsScreen.tsx
import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import { AppButton } from "../components/AppButton";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";
import { syncDailyHelpTemplates } from "../sync/sheets";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";

export const SettingsScreen: React.FC = () => {
  const { language, setLanguage } = useSettings();
  const navigation = useNavigation<any>();
  const [isSyncingDailyHelp, setIsSyncingDailyHelp] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("Home");
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [navigation]),
  );

  const syncDailyHelpNow = async () => {
    if (isSyncingDailyHelp) return;

    try {
      setIsSyncingDailyHelp(true);
      const result = await syncDailyHelpTemplates(SHEETS_SYNC_CONFIG);
      if (!result.ok) {
        Alert.alert(
          t(language, "settingsDailyHelpSyncFailed"),
          result.message ?? t(language, "patrolSyncDidNotComplete"),
        );
        return;
      }

      if (result.synced === 0 && result.attempted === 0) {
        Alert.alert(
          t(language, "settingsDailyHelpSyncComplete"),
          t(language, "settingsDailyHelpSyncNoData"),
        );
        return;
      }

      Alert.alert(
        t(language, "settingsDailyHelpSyncComplete"),
        `${t(language, "visitorsAttempted")}: ${result.attempted}\n${t(language, "visitorsSynced")}: ${result.synced}\n${t(language, "visitorsSkipped")}: ${result.skipped}`,
      );
    } catch (e: any) {
      Alert.alert(
        t(language, "settingsDailyHelpSyncFailed"),
        String(e?.message ?? e),
      );
    } finally {
      setIsSyncingDailyHelp(false);
    }
  };

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

        <Text style={styles.helper}>{t(language, "settingsSyncHelper")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t(language, "settingsAdminTitle")}
        </Text>

        <AppButton
          title={t(language, "settingsManageGuards")}
          onPress={() => navigation.navigate("AdminPin")}
          variant="secondary"
        />

        <View style={{ height: 10 }} />
        {isSyncingDailyHelp ? (
          <View style={styles.syncSpinnerWrap}>
            <ActivityIndicator />
          </View>
        ) : (
          <AppButton
            title={t(language, "settingsSyncDailyHelpNow")}
            onPress={syncDailyHelpNow}
            variant="secondary"
          />
        )}

        <Text style={styles.helper}>{t(language, "settingsAdminHelper")}</Text>
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
  syncSpinnerWrap: {
    height: 40,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  helper: { marginTop: 10, fontSize: 12, color: "#546e7a" },
});
