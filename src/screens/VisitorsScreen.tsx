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
import { useSession } from "../context/SessionContext";
import { VisitorProfile, getTopVisitorsByFrequency } from "../storage/visitors";
import { t } from "../i18n/strings";
import { syncVisitorEntries, SyncResult } from "../sync/sheets";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import { DailyHelpTemplate, loadDailyHelpTemplates } from "../storage/dailyHelp";

type DailyHelpCard = DailyHelpTemplate & {
  resolvedPhotoUri?: string;
};

function normalizeImageUri(v?: string): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;

  const lowered = s.toLowerCase();
  if (lowered === "null" || lowered === "undefined" || lowered === "nan") {
    return undefined;
  }

  return s;
}

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
  const { session } = useSession();
  const navigation = useNavigation<any>();

  const [topVisitors, setTopVisitors] = useState<VisitorProfile[]>([]);
  const [dailyHelp, setDailyHelp] = useState<DailyHelpCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDailyHelp, setLoadingDailyHelp] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [brokenDailyHelpImages, setBrokenDailyHelpImages] = useState<
    Record<string, boolean>
  >({});
  const [brokenFrequentImages, setBrokenFrequentImages] = useState<
    Record<string, boolean>
  >({});
  const [loadedOnce, setLoadedOnce] = useState(false);

  const sameTopVisitors = (left: VisitorProfile[], right: VisitorProfile[]) => {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      const a = left[i];
      const b = right[i];
      if (
        a.id !== b.id ||
        a.name !== b.name ||
        a.phone !== b.phone ||
        a.type !== b.type ||
        a.vehicle !== b.vehicle ||
        a.photoUri !== b.photoUri ||
        a.visitCount !== b.visitCount ||
        a.lastSeenAt !== b.lastSeenAt
      ) {
        return false;
      }
    }
    return true;
  };

  const sameDailyHelp = (left: DailyHelpCard[], right: DailyHelpCard[]) => {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      const a = left[i];
      const b = right[i];
      if (
        a.id !== b.id ||
        a.name !== b.name ||
        a.phone !== b.phone ||
        a.type !== b.type ||
        a.vehicle !== b.vehicle ||
        a.wing !== b.wing ||
        a.flatNumber !== b.flatNumber ||
        a.photoUrl !== b.photoUrl ||
        a.resolvedPhotoUri !== b.resolvedPhotoUri
      ) {
        return false;
      }
    }
    return true;
  };

  const loadTop = async (forceSpinner: boolean = false) => {
    if (!loadedOnce || forceSpinner) {
      setLoading(true);
    }
    try {
      const top = await getTopVisitorsByFrequency(10);
      setTopVisitors((prev) => {
        if (sameTopVisitors(prev, top)) return prev;
        setBrokenFrequentImages({});
        return top;
      });
    } finally {
      if (!loadedOnce || forceSpinner) {
        setLoading(false);
      }
    }
  };

  const loadDailyHelp = async (forceSpinner: boolean = false) => {
    if (!loadedOnce || forceSpinner) {
      setLoadingDailyHelp(true);
    }
    try {
      const templates = await loadDailyHelpTemplates();

      const next: DailyHelpCard[] = templates.map((item) => ({
        ...item,
        resolvedPhotoUri: normalizeImageUri(item.photoUrl),
      }));

      setDailyHelp((prev) => {
        if (sameDailyHelp(prev, next)) return prev;
        setBrokenDailyHelpImages({});
        return next;
      });
    } finally {
      if (!loadedOnce || forceSpinner) {
        setLoadingDailyHelp(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadTop(false), loadDailyHelp(false)]).finally(() => {
        setLoadedOnce(true);
      });
    }, [loadedOnce]),
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

  const summarizeSync = (label: string, result: SyncResult) => {
    if (!result.ok) {
      return `${label}: ${t(language, "visitorsSyncFailed")}\n${result.message ?? t(language, "patrolSyncDidNotComplete")}`;
    }

    const attempted = Number(result.attempted ?? 0);
    const synced = Number(result.synced ?? 0);
    const skipped = Number(result.skipped ?? 0);

    if (attempted === 0 && synced === 0) {
      return `${label}: ${t(language, "visitorsSyncNoPending")}`;
    }

    return `${label}:\n${t(language, "visitorsAttempted")}: ${attempted}\n${t(language, "visitorsSynced")}: ${synced}\n${t(language, "visitorsSkipped")}: ${skipped}`;
  };

  const manualSyncVisitors = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);

      const visitorResult = await syncVisitorEntries(SHEETS_SYNC_CONFIG);

      const message = summarizeSync(
        t(language, "visitorsSyncVisitorRecordsLabel"),
        visitorResult,
      );

      Alert.alert(
        visitorResult.ok
          ? t(language, "visitorsSyncComplete")
          : t(language, "visitorsSyncFailed"),
        message,
      );
    } catch (e: any) {
      Alert.alert(t(language, "visitorsSyncFailed"), String(e?.message ?? e));
    } finally {
      setIsSyncing(false);
    }
  };

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
      | "visitorsOther"
    > = {
      "Courier/Delivery": "visitorsCourier",
      Maid: "visitorsMaid",
      Sweeper: "visitorsSweeper",
      Milkman: "visitorsMilkman",
      Guest: "visitorsGuest",
      Paperboy: "visitorsPaperboy",
      "Electrician/Plumber/Gardener": "visitorsGardener",
      Other: "visitorsOther",
    };
    const key = map[type];
    return key ? t(language, key) : type;
  };

  const openTemplate = (item: DailyHelpCard) => {
    navigation.navigate("AddVisitor", {
      prefill: {
        name: item.name,
        phone: item.phone,
        type: item.type,
        vehicle: item.vehicle,
        flats: item.flats,
        wing: item.wing,
        flatNumber: item.flatNumber,
        photoUri: item.resolvedPhotoUri,
      },
    });
  };

  const getInitial = (name: string): string => {
    const s = String(name ?? "").trim();
    return s ? s.charAt(0).toUpperCase() : "?";
  };

  const visitsLabel = (count: number): string => {
    if (language === "en") {
      return count === 1 ? "visit" : "visits";
    }
    return t(language, "visitorsVisits");
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

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { flex: 1, marginTop: 0 }]}>
          {t(language, "visitorsDailyHelp")}
        </Text>
        <View style={{ width: 150 }}>
          <AppButton
            title={t(language, "visitorsManageDailyHelp")}
            onPress={openManageDailyHelp}
            variant="secondary"
          />
        </View>
      </View>
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
          renderItem={({ item }) => {
            const dailyPhotoUri = normalizeImageUri(item.resolvedPhotoUri);
            return (
              <TouchableOpacity
                style={styles.dailyCard}
                activeOpacity={0.85}
                onPress={() => openTemplate(item)}
              >
                <View style={styles.dailyAvatarWrap}>
                  <View style={styles.dailyAvatarStack}>
                    <View style={styles.dailyAvatarPlaceholder}>
                      <Text style={styles.dailyAvatarInitial}>
                        {getInitial(item.name)}
                      </Text>
                    </View>

                    {dailyPhotoUri && !brokenDailyHelpImages[item.id] ? (
                      <Image
                        source={{ uri: dailyPhotoUri }}
                        style={styles.dailyAvatar}
                        onError={() =>
                          setBrokenDailyHelpImages((prev) => ({
                            ...prev,
                            [item.id]: true,
                          }))
                        }
                      />
                    ) : null}
                  </View>
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
            );
          }}
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
              onPress={() => loadTop(true)}
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
        topVisitors.map((item) => {
          const frequentPhotoUri = normalizeImageUri(item.photoUri);
          return (
            <View key={item.id} style={styles.row}>
              <View style={styles.avatarWrap}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{getInitial(item.name)}</Text>
                </View>
                {frequentPhotoUri && !brokenFrequentImages[item.id] ? (
                  <Image
                    source={{ uri: frequentPhotoUri }}
                    style={styles.avatar}
                    onError={() =>
                      setBrokenFrequentImages((prev) => ({
                        ...prev,
                        [item.id]: true,
                      }))
                    }
                  />
                ) : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {visitTypeLabel(item.type)} • {item.visitCount} {visitsLabel(item.visitCount)} • {t(language, "visitorsLast")}: {formatDateTime(item.lastSeenAt)}
                </Text>
              </View>
            </View>
          );
        })
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
  avatarWrap: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  avatar: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  dailyAvatarStack: {
    width: 52,
    height: 52,
  },
  dailyAvatar: {
    position: "absolute",
    left: 0,
    top: 0,
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
