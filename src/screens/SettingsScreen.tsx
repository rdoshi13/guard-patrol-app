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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { AppButton } from "../components/AppButton";
import { useSettings } from "../context/SettingsContext";
import { useSession } from "../context/SessionContext";
import { t } from "../i18n/strings";
import { loadGuards } from "../storage/guards";
import { loadPatrolHourRecords, PatrolHourRecord } from "../storage/patrol";
import { loadVisitorEntries, loadVisitorProfiles } from "../storage/visitors";
import { loadDailyHelpTemplates } from "../storage/dailyHelp";

type ExportMode = "csv" | "json" | null;
const SHOW_JSON_EXPORT_BUTTON = false;

const CSV_COLUMNS = [
  "table",
  "id",
  "name",
  "phone",
  "type",
  "vehicle",
  "wing",
  "flatNumber",
  "visitCount",
  "lastSeenAt",
  "guardId",
  "guardName",
  "shift",
  "society",
  "dateKey",
  "hourStart",
  "hourWindow",
  "status",
  "completedCount",
  "pointsScanned",
  "event",
  "createdAt",
  "finalizedAt",
  "syncedAt",
  "photo",
  "recordId",
  "notes",
  "displayOrder",
  "value",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvRow = Partial<Record<CsvColumn, string | number>>;

function escapeCsvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function patrolHourWindow(hourStart: number): string {
  const start = String(hourStart).padStart(2, "0");
  const end = String(hourStart + 1).padStart(2, "0");
  return `${start}:00-${end}:00`;
}

function patrolPointsScanned(record: PatrolHourRecord): string {
  const points: string[] = [];
  for (const key of Object.keys(record.scans)) {
    const point = Number(key);
    if (!Number.isInteger(point)) continue;
    if (record.scans[point as 1 | 2 | 3 | 4 | 5 | 6]) {
      points.push(String(point));
    }
  }
  return points.join(",");
}

function toCsv(rows: CsvRow[]): string {
  const lines: string[] = [CSV_COLUMNS.join(",")];

  for (const row of rows) {
    const line = CSV_COLUMNS.map((column) => escapeCsvCell(row[column])).join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

export const SettingsScreen: React.FC = () => {
  const { language, setLanguage } = useSettings();
  const { session, lastSession } = useSession();
  const navigation = useNavigation<any>();
  const [exportMode, setExportMode] = React.useState<ExportMode>(null);
  const isExporting = exportMode !== null;

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

  const exportCsvData = async () => {
    if (isExporting) return;

    try {
      setExportMode("csv");

      const [guards, patrolRecords, visitorProfiles, visitorEntries, dailyHelp] =
        await Promise.all([
          loadGuards(),
          loadPatrolHourRecords(),
          loadVisitorProfiles(),
          loadVisitorEntries(),
          loadDailyHelpTemplates(),
        ]);

      const syncMeta = await AsyncStorage.multiGet([
        "last_sync_patrol_at_v1",
        "last_sync_visitors_at_v1",
      ]);
      const syncMap = Object.fromEntries(syncMeta);

      const exportedAt = new Date().toISOString();
      const rows: CsvRow[] = [
        { table: "meta", name: "exportedAt", value: exportedAt },
        { table: "meta", name: "app", value: "guard-patrol-app" },
        { table: "meta", name: "deviceScope", value: "local" },
        { table: "meta", name: "language", value: language },
        {
          table: "meta",
          name: "lastSyncPatrolAt",
          value: syncMap.last_sync_patrol_at_v1 || "",
        },
        {
          table: "meta",
          name: "lastSyncVisitorsAt",
          value: syncMap.last_sync_visitors_at_v1 || "",
        },
      ];

      if (session) {
        rows.push({
          table: "current_shift",
          guardId: session.guardId,
          guardName: session.guardName,
          shift: session.shift,
          createdAt: session.startedAt,
          finalizedAt: session.endedAt ?? "",
        });
      }

      if (lastSession) {
        rows.push({
          table: "last_shift",
          guardId: lastSession.guardId,
          guardName: lastSession.guardName,
          shift: lastSession.shift,
          createdAt: lastSession.startedAt,
          finalizedAt: lastSession.endedAt ?? "",
        });
      }

      guards.forEach((guard) => {
        rows.push({
          table: "guards",
          id: guard.id,
          name: guard.name,
          phone: guard.phone,
          photo: guard.photoUri ?? "",
        });
      });

      dailyHelp.forEach((item) => {
        rows.push({
          table: "daily_help",
          id: item.id,
          name: item.name,
          phone: item.phone,
          type: item.type,
          vehicle: item.vehicle,
          wing: item.wing,
          flatNumber: item.flatNumber,
          displayOrder: item.displayOrder,
          photo: item.photoUrl ?? "",
        });
      });

      visitorProfiles.forEach((profile) => {
        rows.push({
          table: "visitor_profiles",
          id: profile.id,
          name: profile.name,
          phone: profile.phone,
          type: profile.type,
          vehicle: profile.vehicle,
          wing: profile.wing ?? "",
          flatNumber: profile.flatNumber ?? "",
          visitCount: profile.visitCount,
          lastSeenAt: profile.lastSeenAt ?? "",
          photo: profile.photoUri ?? "",
        });
      });

      visitorEntries.forEach((entry) => {
        rows.push({
          table: "visitor_entries",
          id: entry.id,
          recordId: entry.id,
          name: entry.name,
          phone: entry.phone,
          type: entry.type,
          vehicle: entry.vehicle,
          wing: entry.wing ?? "",
          flatNumber: entry.flatNumber ?? "",
          guardId: entry.guardId,
          guardName: entry.guardName,
          society: entry.society,
          event: entry.event,
          createdAt: entry.createdAt,
          syncedAt: entry.syncedAt ?? "",
          notes: entry.notes ?? "",
        });
      });

      patrolRecords.forEach((record) => {
        rows.push({
          table: "patrol_records",
          id: record.id,
          recordId: record.id,
          society: record.society,
          guardId: record.guardId,
          guardName: record.guardName,
          dateKey: record.dateKey,
          hourStart: record.hourStart,
          hourWindow: patrolHourWindow(record.hourStart),
          status: record.status,
          completedCount: record.completedCount,
          pointsScanned: patrolPointsScanned(record),
          createdAt: record.createdAt,
          finalizedAt: record.finalizedAt ?? "",
          syncedAt: record.syncedAt ?? "",
        });
      });

      const csv = toCsv(rows);
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No writable directory available for export.");
      }

      const fileUri = `${baseDir}guard-patrol-export-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error("Sharing is not available on this device.");
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: t(language, "settingsExportReadableDataTitle"),
      });
    } catch (e: any) {
      Alert.alert(
        t(language, "settingsExportReadableDataFailed"),
        String(e?.message ?? e),
      );
    } finally {
      setExportMode(null);
    }
  };

  const exportJsonBackup = async () => {
    if (isExporting) return;

    try {
      setExportMode("json");

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
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("No writable directory available for export.");
      }

      const fileUri = `${baseDir}guard-patrol-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, message, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error("Sharing is not available on this device.");
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        UTI: "public.json",
        dialogTitle: t(language, "settingsExportLocalDataTitle"),
      });
    } catch (e: any) {
      Alert.alert(
        t(language, "settingsExportLocalDataFailed"),
        String(e?.message ?? e),
      );
    } finally {
      setExportMode(null);
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
          <>
            <AppButton
              title={t(language, "settingsExportReadableDataButton")}
              onPress={exportCsvData}
              variant="secondary"
            />
            {SHOW_JSON_EXPORT_BUTTON ? (
              <>
                <View style={{ height: 10 }} />
                <AppButton
                  title={t(language, "settingsExportLocalDataButton")}
                  onPress={exportJsonBackup}
                  variant="secondary"
                />
              </>
            ) : null}
          </>
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
