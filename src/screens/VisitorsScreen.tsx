import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  BackHandler,
  TouchableOpacity,
} from "react-native";
import { AppButton } from "../components/AppButton";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSettings } from "../context/SettingsContext";
import { VisitorProfile, getTopVisitorsByFrequency } from "../storage/visitors";
import { t } from "../i18n/strings";
import { syncDailyHelpTemplates, syncVisitorEntries, SyncResult } from "../sync/sheets";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import { DailyHelpTemplate, loadDailyHelpTemplates } from "../storage/dailyHelp";

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
  const [dailyHelp, setDailyHelp] = useState<DailyHelpTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDailyHelp, setLoadingDailyHelp] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadTop = async () => {
    setLoading(true);
    const top = await getTopVisitorsByFrequency(10);
    setTopVisitors(top);
    setLoading(false);
  };

  const loadDailyHelp = async () => {
    setLoadingDailyHelp(true);
    const templates = await loadDailyHelpTemplates();
    setDailyHelp(templates);
    setLoadingDailyHelp(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadTop();
      loadDailyHelp();
    }, []),
  );

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

  const summarizeSync = (
    label: string,
    result: SyncResult,
    noPendingKey: "visitorsSyncNoPending" | "visitorsDailyHelpSyncNoData",
  ) => {
    if (!result.ok) {
      return `${label}: ${t(language, "visitorsSyncFailed")}\n${result.message ?? t(language, "patrolSyncDidNotComplete")}`;
    }

    const attempted = Number(result.attempted ?? 0);
    const synced = Number(result.synced ?? 0);
    const skipped = Number(result.skipped ?? 0);

    if (attempted === 0 && synced === 0) {
      return `${label}: ${t(language, noPendingKey)}`;
    }

    return `${label}:\n${t(language, "visitorsAttempted")}: ${attempted}\n${t(language, "visitorsSynced")}: ${synced}\n${t(language, "visitorsSkipped")}: ${skipped}`;
  };

  const manualSyncVisitors = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);

      const visitorResult = await syncVisitorEntries(SHEETS_SYNC_CONFIG);
      const dailyHelpResult = await syncDailyHelpTemplates(SHEETS_SYNC_CONFIG);

      if (dailyHelpResult.ok) {
        await loadDailyHelp();
      }

      const message = [
        summarizeSync(
          t(language, "visitorsSyncVisitorRecordsLabel"),
          visitorResult,
          "visitorsSyncNoPending",
        ),
        "",
        summarizeSync(
          t(language, "visitorsSyncDailyHelpLabel"),
          dailyHelpResult,
          "visitorsDailyHelpSyncNoData",
        ),
      ].join("\n");

      const allOk = visitorResult.ok && dailyHelpResult.ok;
      Alert.alert(
        allOk ? t(language, "visitorsSyncComplete") : t(language, "visitorsSyncFailed"),
        message,
      );
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
      | "visitorsMaid"
      | "visitorsSweeper"
      | "visitorsGuest"
      | "visitorsGardener"
      | "visitorsMilkman"
      | "visitorsPaperboy"
    > = {
      "Courier/Delivery": "visitorsCourier",
      Maid: "visitorsMaid",
      Sweeper: "visitorsSweeper",
      Milkman: "visitorsMilkman",
      Guest: "visitorsGuest",
      Paperboy: "visitorsPaperboy",
      "Electrician/Plumber/Gardener": "visitorsGardener",
    };
    const key = map[type];
    return key ? t(language, key) : type;
  };

  const openTemplate = (item: DailyHelpTemplate) => {
    navigation.navigate("AddVisitor", {
      prefill: {
        name: item.name,
        phone: item.phone,
        type: item.type,
        vehicle: item.vehicle,
        wing: item.wing,
        flatNumber: item.flatNumber,
        photoUri: item.photoUrl,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator
    >
      <View style={styles.topArea}>
        <AppButton
          title={t(language, "visitorsAddButton")}
          onPress={() => navigation.navigate("AddVisitor")}
        />
      </View>

      <Text style={styles.sectionTitle}>{t(language, "visitorsDailyHelp")}</Text>
      <Text style={styles.sectionSub}>{t(language, "visitorsQuickAddHelp")}</Text>

      {loadingDailyHelp ? (
        <Text style={styles.emptyText}>{t(language, "loading")}</Text>
      ) : dailyHelp.length === 0 ? (
        <Text style={styles.emptyText}>{t(language, "visitorsDailyHelpEmpty")}</Text>
      ) : (
        <FlatList
          data={dailyHelp}
          horizontal
          keyExtractor={(item) => item.id}
          style={styles.dailyList}
          removeClippedSubviews={false}
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dailyCardsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dailyCard}
              activeOpacity={0.85}
              onPress={() => openTemplate(item)}
            >
              <View style={styles.dailyAvatarWrap}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.dailyAvatar} />
                ) : (
                  <View style={styles.dailyAvatarPlaceholder}>
                    <Text style={styles.dailyAvatarInitial}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.dailyTextWrap}>
                <Text numberOfLines={1} style={styles.dailyName}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.dailyMeta}>
                  {visitTypeLabel(item.type)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={{ height: 18 }} />
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>
          {t(language, "visitorsFrequentTop10")}
        </Text>
        <View style={styles.sectionActions}>
          <View style={{ width: 90 }}>
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
          <View style={{ width: 90 }}>
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
        topVisitors.map((item) => (
          <View key={item.id} style={styles.row}>
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
                {t(language, "visitorsVisits")} • {t(language, "visitorsLast")}:
                {" "}
                {formatDateTime(item.lastSeenAt)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 20,
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
  emptyText: {
    marginTop: 8,
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
  dailyCardsRow: {
    paddingRight: 8,
  },
  dailyList: {
    minHeight: 130,
  },
  dailyCard: {
    width: 118,
    height: 130,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "#d6dee2",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  dailyAvatarWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 4,
  },
  dailyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  dailyAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  dailyTextWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  dailyAvatarInitial: {
    fontSize: 20,
    fontWeight: "700",
  },
  dailyName: {
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2933",
  },
  dailyMeta: {
    width: "100%",
    textAlign: "center",
    marginTop: 2,
    fontSize: 12,
    color: "#5f6b73",
  },
});
