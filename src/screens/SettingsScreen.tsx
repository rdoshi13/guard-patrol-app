// src/screens/SettingsScreen.tsx
import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppButton } from "../components/AppButton";
import { useSettings } from "../context/SettingsContext";
import { useSession } from "../context/SessionContext";
import { t } from "../i18n/strings";

export const SettingsScreen: React.FC = () => {
  const { language, setLanguage } = useSettings();
  const { session } = useSession();
  const navigation = useNavigation<any>();
  const [isExporting, setIsExporting] = React.useState(false);

  const EXPORT_KEYS = [
    "guards",
    "patrol_hour_records_v1",
    "visitor_profiles_v1",
    "visitor_entries_v1",
    "daily_help_local_v2",
    "daily_help_templates_v1",
    "shift_session_v1",
    "shift_last_session_v1",
    "language",
    "last_sync_patrol_at_v1",
    "last_sync_visitors_at_v1",
  ] as const;

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

  const openManageDailyHelp = () => {
    if (!session) {
      Alert.alert(
        t(language, "dailyHelpManageRequiresShiftTitle"),
        t(language, "dailyHelpManageRequiresShiftMsg"),
      );
      return;
    }

    navigation.navigate("ManageDailyHelp");
  };

  const exportLocalData = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const allKnownKeys = Array.from(EXPORT_KEYS);
      const existing = await AsyncStorage.multiGet(allKnownKeys);

      const records: Record<string, unknown> = {};
      let presentKeys = 0;

      for (const [key, raw] of existing) {
        if (raw == null) continue;
        presentKeys += 1;
        try {
          records[key] = JSON.parse(raw);
        } catch {
          records[key] = raw;
        }
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        app: "guard-patrol-app",
        deviceScope: "local",
        presentKeys,
        records,
      };

      const message = JSON.stringify(payload, null, 2);
      await Share.share({
        title: t(language, "settingsExportLocalDataTitle"),
        message,
      });
    } catch (e: any) {
      Alert.alert(
        t(language, "settingsExportLocalDataFailed"),
        String(e?.message ?? e),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(language, "settingsTitle")}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "currentLanguage")}</Text>

        <View style={styles.langRow}>
          <View style={styles.langButtonCell}>
            <AppButton
              title={t(language, "english")}
              onPress={() => setLanguage("en")}
              variant={language === "en" ? "primary" : "secondary"}
            />
          </View>

          <View style={styles.langButtonCell}>
            <AppButton
              title={t(language, "gujarati")}
              onPress={() => setLanguage("gu")}
              variant={language === "gu" ? "primary" : "secondary"}
            />
          </View>

          <View style={styles.langButtonCell}>
            <AppButton
              title={t(language, "hindi")}
              onPress={() => setLanguage("hi")}
              variant={language === "hi" ? "primary" : "secondary"}
            />
          </View>
        </View>

        <Text style={styles.helper}>{t(language, "settingsSyncHelper")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "settingsAdminTitle")}</Text>

        <AppButton
          title={t(language, "settingsManageGuards")}
          onPress={() => navigation.navigate("AdminPin")}
          variant="secondary"
        />

        <View style={{ height: 10 }} />

        <AppButton
          title={t(language, "settingsManageDailyHelp")}
          onPress={openManageDailyHelp}
          variant="secondary"
        />

        <View style={{ height: 10 }} />
        {isExporting ? (
          <View style={styles.actionSpinnerWrap}>
            <ActivityIndicator />
          </View>
        ) : (
          <AppButton
            title={t(language, "settingsExportLocalDataButton")}
            onPress={exportLocalData}
            variant="secondary"
          />
        )}

        <Text style={styles.helper}>{t(language, "settingsDailyHelpManageHelper")}</Text>
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

  langRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  langButtonCell: {
    width: "33.33%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  actionSpinnerWrap: {
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
