// src/screens/PatrolScreen.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Vibration,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppButton } from "../components/AppButton";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { syncPatrolHourRecords } from "../sync/sheets";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import { CameraView, Camera } from "expo-camera";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";
import {
  PatrolPoint,
  applyScan,
  cleanupInvalidPatrolHourRecords,
  cleanupSyncedOlderThan,
  finalizeHourRecord,
  loadPatrolHourRecords,
  localDateKey,
  upsertHourRecord,
} from "../storage/patrol";

type Checkpoint = {
  id: string;
  name: string;
  qrValue: string; // expected QR string for this point
};

// same date formatting style as Home
function formatDateTime(iso?: string): string {
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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function localPatrolDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isWithinPatrolWindow(d: Date): boolean {
  // Allowed only between 12:00 AM and 4:59 AM (end exclusive at 5:00)
  const h = d.getHours();
  return h >= 0 && h <= 4;
  // return true;
}

function makeWindowKey(d: Date, guardId: string): string {
  // window is based on phone local time
  const date = localPatrolDate(d);
  const hour = d.getHours();
  return `${date}|${hour}|${guardId}`;
}

function makeRecordId(
  patrolDate: string,
  patrolHour: number,
  guardId: string,
): string {
  return `${patrolDate}|${patrolHour}|${guardId}`;
}

function isOlderThanDays(iso: string, days: number): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - d.getTime() > ms;
}

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// 👇 Change this to your society code
const QR_PREFIX = "GUARDPATROL_ROSEDALE";

const INITIAL_CHECKPOINTS: Checkpoint[] = [
  { id: "p1", name: "Point 1", qrValue: `${QR_PREFIX}_P1` },
  { id: "p2", name: "Point 2", qrValue: `${QR_PREFIX}_P2` },
  { id: "p3", name: "Point 3", qrValue: `${QR_PREFIX}_P3` },
  { id: "p4", name: "Point 4", qrValue: `${QR_PREFIX}_P4` },
  { id: "p5", name: "Point 5", qrValue: `${QR_PREFIX}_P5` },
  { id: "p6", name: "Point 6", qrValue: `${QR_PREFIX}_P6` },
];

const STORAGE_WINDOW_SCANS = "patrol_window_scans_v1";
const STORAGE_EVENTS = "patrol_events_v1";
const STORAGE_MISSED_FINALIZED_DATES = "patrol_missed_finalized_dates_v1";
const MIN_PATROL_HOUR_START = 0;
const MAX_PATROL_HOUR_START = 4;
const MISSED_FINALIZE_GRACE_END_HOUR = 8;

// Brick 2: hourly rollups (report-ready)
// const STORAGE_HOUR_RECORDS = "patrol_hour_records_v1";

// windowScans[windowKey][pointId] = ISO time
type WindowScans = Record<string, Record<string, string>>;
type MissedFinalizeMap = Record<string, string>;

function isValidPatrolHourStart(hour: number): boolean {
  return (
    Number.isInteger(hour) &&
    hour >= MIN_PATROL_HOUR_START &&
    hour <= MAX_PATROL_HOUR_START
  );
}

function parseIsoDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function patrolDateForNightShift(startedAtIso: string): string {
  const startedAt = parseIsoDate(startedAtIso);
  if (!startedAt) return localDateKey();

  // NIGHT shifts that start in evening map to next day's 00:00-05:00 patrol window.
  if (startedAt.getHours() >= 18) {
    startedAt.setDate(startedAt.getDate() + 1);
  }

  return localDateKey(startedAt);
}

function missedFinalizeMapKey(guardId: string, patrolDate: string): string {
  return `${guardId}|${patrolDate}`;
}

async function loadMissedFinalizeMap(): Promise<MissedFinalizeMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_MISSED_FINALIZED_DATES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as MissedFinalizeMap)
      : {};
  } catch {
    return {};
  }
}

async function saveMissedFinalizeMap(map: MissedFinalizeMap): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_MISSED_FINALIZED_DATES,
    JSON.stringify(map),
  );
}

function shouldRunMissedFinalizationNow(
  now: Date,
  patrolDate: string,
): boolean {
  if (localDateKey(now) !== patrolDate) return false;
  const h = now.getHours();

  // Finalize missed only during the patrol window and immediate morning grace.
  return h >= 0 && h <= MISSED_FINALIZE_GRACE_END_HOUR;
}

export const PatrolScreen: React.FC = () => {
  const { session } = useSession();
  const { language } = useSettings();
  const navigation = useNavigation<any>();

  const checkpoints = useMemo(() => INITIAL_CHECKPOINTS, []);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const scanLockRef = useRef(false);
  const [torchOn, setTorchOn] = useState(false);

  const [windowScans, setWindowScans] = useState<WindowScans>({});
  const [events, setEvents] = useState<any[]>([]);
  const [hourRecords, setHourRecords] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // ask for camera permission once
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (scanning) {
          setScanning(false);
          setTorchOn(false);
          setIsProcessingScan(false);
          scanLockRef.current = false;
          return true;
        }
        navigation.navigate("Home");
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [navigation, scanning]),
  );

  // load saved patrol state
  useEffect(() => {
    (async () => {
      try {
        const ws = await AsyncStorage.getItem(STORAGE_WINDOW_SCANS);
        const ev = await AsyncStorage.getItem(STORAGE_EVENTS);
        // const hr = await AsyncStorage.getItem(STORAGE_HOUR_RECORDS);

        if (ws) setWindowScans(JSON.parse(ws));
        if (ev) setEvents(JSON.parse(ev));

        await cleanupInvalidPatrolHourRecords();
        await cleanupSyncedOlderThan(7);
        const all = await loadPatrolHourRecords();
        setHourRecords(all);
      } catch {
        // ignore
      }
    })();
  }, []);

  // persist patrol state (keep everything until Sheets sync)
  useEffect(() => {
    AsyncStorage.setItem(
      STORAGE_WINDOW_SCANS,
      JSON.stringify(windowScans),
    ).catch(() => {});
  }, [windowScans]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_EVENTS, JSON.stringify(events)).catch(
      () => {},
    );
  }, [events]);

  const upsertHourRecordOnScan = async (
    patrolHour: number,
    pointId: string,
    scannedAt: string,
    qrData: string,
  ) => {
    if (!session) return;
    if (!isValidPatrolHourStart(patrolHour)) return;

    const rec = await upsertHourRecord({
      society: "Rosedale",
      guardId: session.guardId,
      guardName: session.guardName,
      dateKey: localDateKey(),
      hourStart: patrolHour, // 0..4
    });

    const pointNum = Number(pointId.replace("p", ""));
    const point = pointNum as PatrolPoint;

    const updated = await applyScan({
      recordId: rec.id,
      point,
      qrData,
    });

    if (updated && updated.completedCount === 6 && !updated.finalizedAt) {
      await finalizeHourRecord({ recordId: updated.id, status: "COMPLETED" });
    }

    const all = await loadPatrolHourRecords();
    setHourRecords(all);
  };

  useEffect(() => {
    if (!session) return;
    if (session.shift !== "NIGHT") return;

    const markMissed = async () => {
      const d = new Date();
      const patrolDate = patrolDateForNightShift(session.startedAt);
      if (!shouldRunMissedFinalizationNow(d, patrolDate)) return;

      const map = await loadMissedFinalizeMap();
      const mapKey = missedFinalizeMapKey(session.guardId, patrolDate);
      if (map[mapKey]) return;

      const h = d.getHours();

      const hoursToFinalize: number[] = [];
      if (h >= 0 && h <= 4) {
        for (let i = 0; i < h; i++) hoursToFinalize.push(i);
      } else if (h >= 5 && h <= MISSED_FINALIZE_GRACE_END_HOUR) {
        for (let i = 0; i <= 4; i++) hoursToFinalize.push(i);
      } else {
        return;
      }

      if (hoursToFinalize.length === 0) return;

      for (const hourStart of hoursToFinalize) {
        const rec = await upsertHourRecord({
          society: "Rosedale",
          guardId: session.guardId,
          guardName: session.guardName,
          dateKey: patrolDate,
          hourStart,
        });

        // If completed and finalized, leave it
        if (rec.finalizedAt && rec.status === "COMPLETED") continue;

        // If not finalized, mark missed
        if (!rec.finalizedAt) {
          await finalizeHourRecord({ recordId: rec.id, status: "MISSED" });
        }
      }

      if (h >= 5) {
        map[mapKey] = new Date().toISOString();
        await saveMissedFinalizeMap(map);
      }

      const all = await loadPatrolHourRecords();
      setHourRecords(all);
    };

    // Run once on mount and then every minute while PatrolScreen is mounted.
    markMissed();
    const timer = setInterval(() => {
      markMissed();
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [session, checkpoints.length]);

  const now = new Date();

  const currentWindowKey = useMemo(() => {
    if (!session) return null;
    if (session.shift !== "NIGHT") return null;
    return makeWindowKey(new Date(), session.guardId);
  }, [session]);

  const currentWindowScans = useMemo(() => {
    if (!currentWindowKey) return {};
    return windowScans[currentWindowKey] ?? {};
  }, [currentWindowKey, windowScans]);

  const completedCount = useMemo(() => {
    return Object.keys(currentWindowScans).length;
  }, [currentWindowScans]);

  const canPatrolNow = useMemo(() => {
    if (!session) return false;
    if (session.shift !== "NIGHT") return false;
    return isWithinPatrolWindow(new Date());
  }, [session]);

  // --- Hourly summary UI helpers ---
  const tonightRecords = useMemo(() => {
    if (!session) return [];

    const dk = localDateKey();

    return hourRecords
      .filter((r) => r.dateKey === dk && r.guardId === session.guardId)
      .sort((a, b) => a.hourStart - b.hourStart);
  }, [hourRecords, session]);

  const manualSync = async () => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);

      const result = await syncPatrolHourRecords(SHEETS_SYNC_CONFIG);

      if (!result.ok) {
        Alert.alert(
          t(language, "patrolSyncFailed"),
          result.message ?? t(language, "patrolSyncDidNotComplete"),
        );
        return;
      }

      const attempted = Number(result.attempted ?? 0);
      const synced = Number(result.synced ?? 0);
      const skipped = Number(result.skipped ?? 0);

      if (attempted === 0) {
        Alert.alert(
          t(language, "patrolSyncComplete"),
          t(language, "patrolSyncNoPending"),
        );
      } else {
        Alert.alert(
          t(language, "patrolSyncComplete"),
          `${t(language, "patrolAttempted")}: ${attempted}\n${t(language, "patrolSynced")}: ${synced}\n${t(language, "patrolSkipped")}: ${skipped}`,
        );
      }

      // Refresh local state after sync
      const all = await loadPatrolHourRecords();
      setHourRecords(all);

      // Cleanup local synced records (7 days)
      await cleanupSyncedOlderThan(7);
    } catch (e: any) {
      Alert.alert(t(language, "patrolSyncFailed"), String(e?.message ?? e));
    } finally {
      setIsSyncing(false);
    }
  };

  const ensurePatrolAllowed = (): boolean => {
    if (!session) {
      Alert.alert(
        t(language, "patrolNoActiveShiftTitle"),
        t(language, "patrolNoActiveShiftMsg"),
      );
      return false;
    }

    if (session.shift !== "NIGHT") {
      Alert.alert(
        t(language, "patrolNightShiftOnlyTitle"),
        t(language, "patrolNightShiftOnlyMsg"),
      );
      return false;
    }

    if (!isWithinPatrolWindow(new Date())) {
      Alert.alert(
        t(language, "patrolWindowClosedTitle"),
        t(language, "patrolWindowClosedMsg"),
      );
      return false;
    }

    return true;
  };

  const startScan = () => {
    if (!ensurePatrolAllowed()) return;

    if (hasPermission === false) {
      Alert.alert(
        t(language, "patrolCameraBlockedTitle"),
        t(language, "patrolCameraBlockedMsg"),
      );
      return;
    }

    setScanning(true);
    setIsProcessingScan(false);
    scanLockRef.current = false;
  };

  const handleBarCodeScanned = async ({
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanLockRef.current || !scanning) return;

    // hard gate again while scanning
    if (!ensurePatrolAllowed()) {
      scanLockRef.current = true;
      setIsProcessingScan(true);
      setScanning(false);
      setTorchOn(false);
      scanLockRef.current = false;
      setIsProcessingScan(false);
      return;
    }

    if (!session) return;

    scanLockRef.current = true;
    setIsProcessingScan(true);

    const matched = checkpoints.find((c) => c.qrValue === data);

    // invalid / not ours
    if (!matched) {
      Alert.alert(
        t(language, "patrolInvalidCodeTitle"),
        t(language, "patrolInvalidCodeMsg"),
        [
          {
            text: t(language, "ok"),
            onPress: () => {
              setScanning(false);
              setTorchOn(false);
              setIsProcessingScan(false);
              scanLockRef.current = false;
            },
          },
        ],
      );
      return;
    }

    const d = new Date();
    const patrolDate = localPatrolDate(d);
    const patrolHour = d.getHours();
    const windowKey = makeWindowKey(d, session.guardId);

    const already = windowScans[windowKey]?.[matched.id];

    if (already) {
      Alert.alert(
        t(language, "patrolAlreadyScannedTitle"),
        t(language, "patrolAlreadyScannedMsg"),
        [
          {
            text: t(language, "ok"),
            onPress: () => {
              setScanning(false);
              setTorchOn(false);
              setIsProcessingScan(false);
              scanLockRef.current = false;
            },
          },
        ],
      );
      return;
    }

    const scannedAt = new Date().toISOString();

    setWindowScans((prev) => {
      const next: WindowScans = { ...prev };
      const cur = next[windowKey] ? { ...next[windowKey] } : {};
      cur[matched.id] = scannedAt;
      next[windowKey] = cur;
      return next;
    });

    setEvents((prev) => [
      ...prev,
      {
        id: makeId(),
        scannedAt,
        windowKey,
        patrolDate,
        patrolHour,
        pointId: matched.id,
        pointName: matched.name,
        qrValue: matched.qrValue,
        guardId: session.guardId,
        guardName: session.guardName,
        shift: "NIGHT",
        society: "Rosedale",
      },
    ]);

    await upsertHourRecordOnScan(
      patrolHour,
      matched.id,
      scannedAt,
      matched.qrValue,
    );

    Vibration.vibrate(150);

    const nextCount = Object.keys({
      ...(windowScans[windowKey] ?? {}),
      [matched.id]: scannedAt,
    }).length;

    if (nextCount === checkpoints.length) {
      Alert.alert(
        t(language, "patrolCompleteTitle"),
        t(language, "patrolCompleteMsg"),
        [
          {
            text: t(language, "ok"),
            onPress: () => {
              setScanning(false);
              setTorchOn(false);
              setIsProcessingScan(false);
              scanLockRef.current = false;
            },
          },
        ],
      );
      return;
    }

    setScanning(false);
    setTorchOn(false);
    setIsProcessingScan(false);
    scanLockRef.current = false;
  };

  // 1) No active shift at all
  if (!session) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>{t(language, "patrolTitle")}</Text>
        <Text style={styles.infoText}>{t(language, "patrolNeedShift")}</Text>
      </View>
    );
  }

  // 2) Shift is active but it's not NIGHT
  if (session.shift !== "NIGHT") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>{t(language, "patrolTitle")}</Text>
        <Text style={styles.infoText}>{t(language, "patrolNightOnly")}</Text>
      </View>
    );
  }

  // 2.5) Night shift but outside patrol window
  if (!canPatrolNow) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>{t(language, "patrolTitle")}</Text>
        <Text style={styles.infoText}>{t(language, "patrolWindowInfo")}</Text>
      </View>
    );
  }

  // 3) If we are currently scanning -> show scanner full screen
  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <Text style={styles.scannerTitle}>
          {t(language, "patrolScanPrompt")}
        </Text>

        {hasPermission === false ? (
          <Text style={styles.infoText}>
            {t(language, "patrolCameraPermissionMissing")}
          </Text>
        ) : (
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={
                isProcessingScan ? undefined : handleBarCodeScanned
              }
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              enableTorch={torchOn}
            />
          </View>
        )}

        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <View style={{ flex: 1, marginRight: 8 }}>
            <AppButton
              title={
                torchOn
                  ? t(language, "patrolTorchOff")
                  : t(language, "patrolTorchOn")
              }
              onPress={() => setTorchOn((prev) => !prev)}
              variant="secondary"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <AppButton
              title={t(language, "cancel")}
              onPress={() => {
                setScanning(false);
                setIsProcessingScan(false);
                scanLockRef.current = false;
                setTorchOn(false);
              }}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    );
  }

  // 4) NIGHT shift active + within patrol window + not scanning -> show normal patrol UI
  const recordForHour = (h: number) => {
    return tonightRecords.find((r) => r.hourStart === h);
  };

  const hourLabel = (h: number) => {
    // 0..4 => 12–1, 1–2, ... 4–5
    const start = h === 0 ? 12 : h;
    const end = h === 4 ? 5 : h + 1;

    return `${start}–${end} AM`;
  };

  const statusLabel = (status?: string) => {
    if (!status) return t(language, "patrolNotStarted");
    if (status === "COMPLETED") return t(language, "patrolStatusCompleted");
    if (status === "MISSED") return t(language, "patrolStatusMissed");
    return t(language, "patrolStatusInProgress");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t(language, "patrolTitle")}</Text>
        <View style={styles.headerRight}>
          {isSyncing ? (
            <ActivityIndicator />
          ) : (
            <AppButton
              title={t(language, "sync")}
              onPress={manualSync}
              variant="secondary"
            />
          )}
        </View>
      </View>

      <View style={styles.shiftCard}>
        <Text style={styles.shiftTitle}>
          {t(language, "patrolCurrentShift")}: {session.guardName} (
          {session.shift})
        </Text>
        <Text style={styles.shiftText}>
          {t(language, "guardIdLabel")}: {session.guardId}
        </Text>
        <Text style={styles.shiftText}>
          {t(language, "startedAt")}: {formatDateTime(session.startedAt)}
        </Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        <AppButton title={t(language, "patrolScanNow")} onPress={startScan} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>
          {t(language, "patrolTonightWindow")}
        </Text>
      </View>

      <View style={styles.hourGrid}>
        {[0, 1, 2, 3, 4].map((h) => {
          const r = recordForHour(h);

          const isDone = r?.status === "COMPLETED";
          const isMissed = r?.status === "MISSED";

          return (
            <View
              key={h}
              style={[
                styles.hourCard,
                isDone && styles.hourCardDone,
                isMissed && styles.hourCardMissed,
              ]}
            >
              <Text style={styles.hourTitle}>{hourLabel(h)}</Text>
              <Text style={styles.hourMeta}>{statusLabel(r?.status)}</Text>
              <Text style={styles.hourMeta}>
                {t(language, "pointsLabel")}: {r?.completedCount ?? 0} / 6
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>
          {t(language, "patrolTodaySummary")}
        </Text>
      </View>

      {checkpoints.map((item) => {
        const last = currentWindowScans[item.id];

        return (
          <View key={item.id} style={styles.checkpointCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkpointName}>{item.name}</Text>
              <Text style={styles.checkpointInfo}>
                {t(language, "patrolLastScan")}:{" "}
                {last ? formatDateTime(last) : t(language, "patrolNotScanned")}
              </Text>
            </View>
            <View style={styles.scanPill}>
              <Text style={styles.scanPillText}>{last ? "✓" : "—"}</Text>
            </View>
          </View>
        );
      })}

      <View
        style={[
          styles.summaryCard,
          completedCount === checkpoints.length && styles.summaryCardCompleted,
        ]}
      >
        <Text style={styles.summaryText}>
          {t(language, "patrolCompleted")}: {completedCount} /{" "}
          {checkpoints.length}
        </Text>
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={styles.smallNote}>
          {t(language, "patrolCurrentWindowLabel")}: {localPatrolDate(now)}{" "}
          {now.getHours()}:00–
          {now.getHours() + 1}:00
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerRight: {
    minWidth: 90,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 20,
    textAlign: "left",
  },
  infoText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
  },
  shiftCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fafafa",
    marginBottom: 16,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  shiftText: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: "600",
  },
  checkpointCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  checkpointName: {
    fontSize: 16,
    fontWeight: "500",
  },
  checkpointInfo: {
    fontSize: 14,
    marginTop: 4,
  },
  scanPill: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginLeft: 12,
  },
  scanPillText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1565c0",
  },
  summaryCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f5f5f5",
    marginTop: 8,
  },
  summaryCardCompleted: {
    backgroundColor: "#d8f5d1",
    borderColor: "#2e7d32",
  },
  summaryText: {
    fontSize: 15,
    textAlign: "center",
  },
  smallNote: {
    fontSize: 12,
    color: "#607d8b",
    textAlign: "center",
  },
  scannerContainer: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  scannerTitle: {
    fontSize: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  scannerBox: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#333",
  },

  hourGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  hourCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  hourCardDone: {
    backgroundColor: "#d8f5d1",
    borderColor: "#2e7d32",
  },
  hourCardMissed: {
    backgroundColor: "#ffe0e0",
    borderColor: "#c62828",
  },
  hourTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  hourMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#546e7a",
  },
});
