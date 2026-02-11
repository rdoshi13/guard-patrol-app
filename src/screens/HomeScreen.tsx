// src/screens/HomeScreen.tsx
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppButton } from "../components/AppButton";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";
import { Ionicons } from "@expo/vector-icons";
import { syncPatrolHourRecordsToSheets } from "../sync/sheets";
import { SHEETS_SYNC_URL, SHEETS_SYNC_TOKEN } from "../constants/sheets";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// helper to format dates nicely
function formatDateTime(iso: string | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { session, lastSession, endSession } = useSession();
  const { language } = useSettings();

  const hasActive = !!session;
  const hasLast = !!lastSession;

  useEffect(() => {
    // Silent best-effort sync whenever Home loads
    (async () => {
      try {
        await syncPatrolHourRecordsToSheets({
          url: SHEETS_SYNC_URL,
          token: SHEETS_SYNC_TOKEN || undefined,
        });
      } catch {
        // silent retry later
      }
    })();
  }, []);
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t(language, "homeTitle")}</Text>

      {/* shift info block */}
      <View style={styles.card}>
        {hasActive ? (
          <>
            <Text style={styles.cardTitle}>
              {t(language, "onDuty")}: {session!.guardName} ({session!.shift})
            </Text>
            <Text style={styles.cardText}>
              {t(language, "startedAt")}: {formatDateTime(session!.startedAt)}
            </Text>
          </>
        ) : hasLast ? (
          <>
            <Text style={styles.cardTitle}>
              {t(language, "previousShift")}: {lastSession!.guardName} (
              {lastSession!.shift})
            </Text>
            <Text style={styles.cardText}>
              {t(language, "startedAt")}:{" "}
              {formatDateTime(lastSession!.startedAt)}
            </Text>
            {lastSession!.endedAt && (
              <Text style={styles.cardText}>
                {t(language, "endedAt")}: {formatDateTime(lastSession!.endedAt)}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.cardTitle}>{t(language, "noActiveShift")}</Text>
        )}
      </View>

      {/* End shift button */}
      <View style={styles.buttonRow}>
        <AppButton
          title={t(language, "endShift")}
          onPress={endSession}
          disabled={!hasActive}
          variant="danger"
        />
      </View>

      {/* navigation list */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Actions</Text>
      </View>

      <View style={styles.buttonRow}>
        <AppButton
          onPress={() =>
            navigation.navigate("MainTabs", { initialTab: "Shift" })
          }
          disabled={hasActive}
          variant={hasActive ? "secondary" : "primary"}
        >
          <View style={styles.buttonContent}>
            <Ionicons
              name="shield-outline"
              size={18}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonTextPrimary}>
              {t(language, "selectGuardButton")}
            </Text>
          </View>
        </AppButton>
      </View>

      <View style={styles.buttonRow}>
        <AppButton
          onPress={() =>
            navigation.navigate("MainTabs", { initialTab: "Patrol" })
          }
        >
          <View style={styles.buttonContent}>
            <Ionicons
              name="qr-code-outline"
              size={18}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonTextPrimary}>
              {t(language, "patrol")}
            </Text>
          </View>
        </AppButton>
      </View>

      <View style={styles.buttonRow}>
        <AppButton
          onPress={() =>
            navigation.navigate("MainTabs", { initialTab: "Visitors" })
          }
        >
          <View style={styles.buttonContent}>
            <Ionicons
              name="people-outline"
              size={18}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonTextPrimary}>
              {t(language, "visitors")}
            </Text>
          </View>
        </AppButton>
      </View>

      <View style={styles.buttonRow}>
        <AppButton
          onPress={() =>
            navigation.navigate("MainTabs", { initialTab: "Settings" })
          }
        >
          <View style={styles.buttonContent}>
            <Ionicons
              name="settings-outline"
              size={18}
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonTextPrimary}>
              {t(language, "goToSettings")}
            </Text>
          </View>
        </AppButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fafafa",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  cardText: {
    fontSize: 14,
    marginTop: 4,
  },
  buttonRow: {
    marginTop: 16,
  },
  sectionHeader: {
    marginTop: 24,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
    color: "#fff",
  },
  buttonTextPrimary: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
