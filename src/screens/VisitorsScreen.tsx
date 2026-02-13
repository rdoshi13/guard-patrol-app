import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, Alert, ActivityIndicator } from "react-native";
import { AppButton } from "../components/AppButton";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSettings } from "../context/SettingsContext";
import { VisitorProfile, getTopVisitorsByFrequency } from "../storage/visitors";
import { t } from "../i18n/strings";
import { syncVisitorEntries } from "../sync/sheets";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const VisitorsScreen: React.FC = () => {
  const { language } = useSettings();
  const navigation = useNavigation<any>();

  const [topVisitors, setTopVisitors] = useState<VisitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadTop = async () => {
    setLoading(true);

    const top = await getTopVisitorsByFrequency(10);
    setTopVisitors(top);

    setLoading(false);
  };

  // ✅ Runs every time this screen becomes active again
  // (So after saving a visitor and going back, this refreshes automatically)
  useFocusEffect(
    useCallback(() => {
      loadTop();
    }, [])
  );

  const manualSyncVisitors = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);

      const result = await syncVisitorEntries(SHEETS_SYNC_CONFIG);
      if (!result.ok) {
        Alert.alert(
          t(language, "visitorsSyncFailed"),
          result.message ?? t(language, "patrolSyncDidNotComplete"),
        );
        return;
      }

      const attempted = Number(result.attempted ?? 0);
      const synced = Number(result.synced ?? 0);
      const skipped = Number(result.skipped ?? 0);

      if (attempted === 0) {
        Alert.alert(t(language, "visitorsSyncComplete"), t(language, "visitorsSyncNoPending"));
      } else {
        Alert.alert(
          t(language, "visitorsSyncComplete"),
          `${t(language, "visitorsAttempted")}: ${attempted}\n${t(language, "visitorsSynced")}: ${synced}\n${t(language, "visitorsSkipped")}: ${skipped}`,
        );
      }
    } catch (e: any) {
      Alert.alert(t(language, "visitorsSyncFailed"), String(e?.message ?? e));
    } finally {
      setIsSyncing(false);
    }
  };

  const visitTypeLabel = (type: string) => {
    const map: Record<
      string,
      | "visitorsCourier"
      | "visitorsSweeper"
      | "visitorsGuest"
      | "visitorsGardener"
      | "visitorsMilkman"
      | "visitorsPaperboy"
    > = {
      "Courier/Delivery": "visitorsCourier",
      Milkman: "visitorsMilkman",
      Maid: "visitorsSweeper",
      Guest: "visitorsGuest",
      Paperboy: "visitorsPaperboy",
      "Electrician/Plumber/Gardener": "visitorsGardener",
    };
    const key = map[type];
    return key ? t(language, key) : type;
  };

  const renderItem = ({ item }: { item: VisitorProfile }) => {
    return (
      <View style={styles.row}>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {visitTypeLabel(item.type)} • {item.visitCount}{" "}
            {t(language, "visitorsVisits")} • {t(language, "visitorsLast")}:{" "}
            {formatDateTime(item.lastSeenAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topArea}>
        <AppButton
          title={t(language, "visitorsAddButton")}
          onPress={() => navigation.navigate("AddVisitor")}
        />
      </View>
      <Text style={styles.sectionTitle}>{t(language, "visitorsDailyHelp")}</Text>
      <Text style={styles.sectionSub}>{t(language, "visitorsQuickAddHelp")}</Text>

      <View style={styles.dailyRow}>
        <AppButton
          title={t(language, "visitorsMilkman")}
          onPress={() =>
            navigation.navigate("AddVisitor", { presetType: "Milkman" })
          }
          variant="secondary"
        />
        <View style={{ width: 10 }} />
        <AppButton
          title={t(language, "visitorsGardener")}
          onPress={() =>
            navigation.navigate("AddVisitor", {
              presetType: "Electrician/Plumber/Gardener",
            })
          }
          variant="secondary"
        />
        <View style={{ width: 10 }} />
        <AppButton
          title={t(language, "visitorsSweeper")}
          onPress={() =>
            navigation.navigate("AddVisitor", { presetType: "Maid" })
          }
          variant="secondary"
        />
      </View>

      <View style={{ height: 18 }} />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t(language, "visitorsFrequentTop10")}
        </Text>
        <View style={styles.sectionActions}>
          <View style={{ width: 100 }}>
            {isSyncing ? (
              <View style={styles.syncSpinnerWrap}>
                <ActivityIndicator />
              </View>
            ) : (
              <AppButton
                title={t(language, "sync")}
                onPress={manualSyncVisitors}
                variant="secondary"
              />
            )}
          </View>
          <View style={{ width: 10 }} />
          <View style={{ width: 100 }}>
            <AppButton
              title={t(language, "visitorsRefresh")}
              onPress={loadTop}
              variant="secondary"
            />
          </View>
        </View>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>{t(language, "loading")}</Text>
      ) : topVisitors.length === 0 ? (
        <Text style={styles.emptyText}>{t(language, "visitorsEmpty")}</Text>
      ) : (
        <FlatList
          data={topVisitors}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  topArea: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionActions: {
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  syncSpinnerWrap: {
    height: 40,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  // sectionTitle: {
  //   fontSize: 16,
  //   fontWeight: "600",
  // },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: "#555",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 12,
    color: "#546e7a",
    marginBottom: 10,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
