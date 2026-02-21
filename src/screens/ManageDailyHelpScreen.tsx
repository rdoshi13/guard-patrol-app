import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { AppButton } from "../components/AppButton";
import { useSettings } from "../context/SettingsContext";
import { useSession } from "../context/SessionContext";
import { t } from "../i18n/strings";
import {
  DailyHelpTemplate,
  DailyHelpTemplateInput,
  DAILY_HELP_DUPLICATE_PHONE_ERROR,
  createDailyHelpTemplate,
  dailyHelpInputFromProfile,
  deleteDailyHelpTemplate,
  loadDailyHelpTemplates,
  reorderDailyHelpTemplates,
  updateDailyHelpTemplate,
} from "../storage/dailyHelp";
import {
  KnownVisitType,
  VisitType,
  VehicleType,
  VisitorProfile,
  VisitorWing,
  loadVisitorProfiles,
} from "../storage/visitors";

const VISIT_TYPES: KnownVisitType[] = [
  "Courier/Delivery",
  "Maid",
  "Sweeper",
  "Guest",
  "Electrician/Plumber/Gardener",
  "Milkman",
  "Paperboy",
];
const VISIT_TYPE_OPTIONS = [...VISIT_TYPES, "Other"] as const;
type VisitTypeOption = (typeof VISIT_TYPE_OPTIONS)[number];

const VEHICLE_TYPES: VehicleType[] = ["None", "Car", "Bike", "Cycle"];
const WINGS: VisitorWing[] = ["A", "B", "C", "D", "ROSEDALE"];

const FLATS_IN_WING = [
  "101",
  "102",
  "103",
  "201",
  "202",
  "203",
  "301",
  "302",
  "303",
  "402",
  "403",
] as const;

type FormState = {
  name: string;
  phone: string;
  type: VisitTypeOption;
  customType: string;
  vehicle: VehicleType;
  wing: VisitorWing;
  flatNumber: string;
  photoUrl: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  type: "Guest",
  customType: "",
  vehicle: "None",
  wing: "A",
  flatNumber: "101",
  photoUrl: "",
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

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

export const ManageDailyHelpScreen: React.FC = () => {
  const { language } = useSettings();
  const { session } = useSession();
  const canManage = !!session;

  const [templates, setTemplates] = useState<DailyHelpTemplate[]>([]);
  const [profiles, setProfiles] = useState<VisitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isPhotoPreviewBroken, setIsPhotoPreviewBroken] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const formSectionYRef = useRef(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTemplates, nextProfiles] = await Promise.all([
        loadDailyHelpTemplates(),
        loadVisitorProfiles(),
      ]);

      setTemplates(nextTemplates);
      setProfiles(
        nextProfiles
          .slice()
          .sort((a, b) => {
            if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
            const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
            const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
            return tb - ta;
          }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles.slice(0, 12);

    return profiles
      .filter((p) => {
        const name = p.name.toLowerCase();
        const phone = p.phone.toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [profiles, query]);

  const visitTypeLabel = (type: string): string => {
    const keyMap: Record<
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
      Guest: "visitorsGuest",
      "Electrician/Plumber/Gardener": "visitorsGardener",
      Milkman: "visitorsMilkman",
      Paperboy: "visitorsPaperboy",
      Other: "visitorsOther",
    };

    const key = keyMap[type];
    return key ? t(language, key) : type;
  };

  const wingLabel = (wing: VisitorWing): string => {
    if (wing === "ROSEDALE") return t(language, "addVisitorWingRosedale");
    return wing;
  };

  const vehicleLabel = (vehicle: VehicleType): string => {
    if (language === "hi") {
      const hiMap: Record<VehicleType, string> = {
        None: "कोई नहीं",
        Car: "कार",
        Bike: "बाइक",
        Cycle: "साइकिल",
      };
      return hiMap[vehicle];
    }

    if (language === "gu") {
      const guMap: Record<VehicleType, string> = {
        None: "કંઈ નહિ",
        Car: "કાર",
        Bike: "બાઈક",
        Cycle: "સાયકલ",
      };
      return guMap[vehicle];
    }

    return vehicle;
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsPhotoPreviewBroken(false);
  };

  const startEdit = (item: DailyHelpTemplate) => {
    const isKnownType = VISIT_TYPES.includes(item.type as KnownVisitType);
    setEditingId(item.id);
    setForm({
      name: item.name,
      phone: item.phone,
      type: isKnownType ? (item.type as KnownVisitType) : "Other",
      customType: isKnownType ? "" : item.type,
      vehicle: item.vehicle,
      wing: item.wing,
      flatNumber: item.flatNumber,
      photoUrl: item.photoUrl ?? "",
    });
    setIsPhotoPreviewBroken(false);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formSectionYRef.current - 10),
        animated: true,
      });
    });
  };

  const useProfile = (profile: VisitorProfile) => {
    const input = dailyHelpInputFromProfile(profile);
    if (!input) {
      Alert.alert(
        t(language, "manageDailyHelpProfileInvalidTitle"),
        t(language, "manageDailyHelpProfileInvalidMsg"),
      );
      return;
    }

    const isKnownType = VISIT_TYPES.includes(input.type as KnownVisitType);
    setEditingId(null);
    setForm({
      name: input.name,
      phone: input.phone,
      type: isKnownType ? (input.type as KnownVisitType) : "Other",
      customType: isKnownType ? "" : input.type,
      vehicle: input.vehicle,
      wing: input.wing,
      flatNumber: input.flatNumber,
      photoUrl: input.photoUrl ?? "",
    });
    setIsPhotoPreviewBroken(false);
  };

  const pickFromGallery = async () => {
    if (!canManage) {
      Alert.alert(
        t(language, "dailyHelpManageRequiresShiftTitle"),
        t(language, "dailyHelpManageRequiresShiftMsg"),
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t(language, "addVisitorPermissionNeeded"),
        t(language, "addVisitorGalleryPermission"),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      setIsPhotoPreviewBroken(false);
      setForm((prev) => ({
        ...prev,
        photoUrl: normalizeImageUri(result.assets[0].uri) ?? "",
      }));
    }
  };

  const takePhoto = async () => {
    if (!canManage) {
      Alert.alert(
        t(language, "dailyHelpManageRequiresShiftTitle"),
        t(language, "dailyHelpManageRequiresShiftMsg"),
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t(language, "addVisitorPermissionNeeded"),
        t(language, "addVisitorCameraPermission"),
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      setIsPhotoPreviewBroken(false);
      setForm((prev) => ({
        ...prev,
        photoUrl: normalizeImageUri(result.assets[0].uri) ?? "",
      }));
    }
  };

  const saveForm = async () => {
    if (!canManage) {
      Alert.alert(
        t(language, "dailyHelpManageRequiresShiftTitle"),
        t(language, "dailyHelpManageRequiresShiftMsg"),
      );
      return;
    }

    if (saving) return;

    if (!form.name.trim()) {
      Alert.alert(
        t(language, "addVisitorMissingInfoTitle"),
        t(language, "addVisitorValidationName"),
      );
      return;
    }

    if (digitsOnly(form.phone).length < 8) {
      Alert.alert(
        t(language, "addVisitorMissingInfoTitle"),
        t(language, "addVisitorValidationPhone"),
      );
      return;
    }

    if (form.type === "Other" && !form.customType.trim()) {
      Alert.alert(
        t(language, "addVisitorMissingInfoTitle"),
        t(language, "addVisitorValidationCustomType"),
      );
      return;
    }

    const payload: DailyHelpTemplateInput = {
      name: form.name.trim(),
      phone: digitsOnly(form.phone),
      type: resolvedType,
      vehicle: form.vehicle,
      wing: form.wing,
      flatNumber: form.wing === "ROSEDALE" ? "000" : form.flatNumber,
      photoUrl: form.photoUrl,
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateDailyHelpTemplate(editingId, payload);
      } else {
        await createDailyHelpTemplate(payload);
      }

      await loadData();
      startCreate();
    } catch (e: any) {
      if (e?.message === DAILY_HELP_DUPLICATE_PHONE_ERROR) {
        Alert.alert(
          t(language, "manageDailyHelpDuplicateTitle"),
          t(language, "manageDailyHelpDuplicateMsg"),
        );
      } else {
        Alert.alert(
          t(language, "manageDailyHelpSaveFailedTitle"),
          String(e?.message ?? e),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: DailyHelpTemplate) => {
    if (!canManage) {
      Alert.alert(
        t(language, "dailyHelpManageRequiresShiftTitle"),
        t(language, "dailyHelpManageRequiresShiftMsg"),
      );
      return;
    }

    Alert.alert(
      t(language, "manageDailyHelpDeleteTitle"),
      t(language, "manageDailyHelpDeleteMsg"),
      [
        { text: t(language, "cancel"), style: "cancel" },
        {
          text: t(language, "manageGuardsDelete"),
          style: "destructive",
          onPress: async () => {
            await deleteDailyHelpTemplate(item.id);
            await loadData();
            if (editingId === item.id) {
              startCreate();
            }
          },
        },
      ],
    );
  };

  const moveTemplate = async (id: string, direction: -1 | 1) => {
    if (!canManage) {
      Alert.alert(
        t(language, "dailyHelpManageRequiresShiftTitle"),
        t(language, "dailyHelpManageRequiresShiftMsg"),
      );
      return;
    }

    const index = templates.findIndex((item) => item.id === id);
    if (index < 0) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= templates.length) return;

    const reordered = templates.slice();
    const tmp = reordered[index];
    reordered[index] = reordered[nextIndex];
    reordered[nextIndex] = tmp;

    const ids = reordered.map((item) => item.id);
    const next = await reorderDailyHelpTemplates(ids);
    setTemplates(next);
  };

  const selectedPhotoUri = normalizeImageUri(form.photoUrl);
  const selectedPhotoInitial =
    String(form.name ?? "").trim().charAt(0).toUpperCase() || "?";
  const resolvedType: VisitType =
    form.type === "Other" ? form.customType.trim() : form.type;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{t(language, "manageDailyHelpTitle")}</Text>
      <Text style={styles.subtitle}>{t(language, "manageDailyHelpSubtitle")}</Text>

      {!canManage ? (
        <Text style={styles.warning}>{t(language, "dailyHelpManageRequiresShiftMsg")}</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "manageDailyHelpFromVisitors")}</Text>
        <TextInput
          placeholder={t(language, "manageDailyHelpSearchPlaceholder")}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
        />

        {filteredProfiles.length === 0 ? (
          <Text style={styles.helper}>{t(language, "manageDailyHelpNoProfiles")}</Text>
        ) : (
          filteredProfiles.map((profile) => (
            <View key={profile.id} style={styles.profileRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileMeta}>
                  {visitTypeLabel(profile.type)} • {profile.phone}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallButton, !canManage && styles.smallButtonDisabled]}
                disabled={!canManage}
                onPress={() => useProfile(profile)}
              >
                <Text style={styles.smallButtonText}>{t(language, "manageDailyHelpUse")}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View
        style={styles.card}
        onLayout={(e) => {
          formSectionYRef.current = e.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.sectionTitle}>
          {editingId
            ? t(language, "manageDailyHelpEditSectionTitle")
            : t(language, "manageDailyHelpAddSectionTitle")}
        </Text>

        <Text style={styles.fieldLabel}>{t(language, "addVisitorNameLabel")}</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
          placeholder={t(language, "addVisitorNamePlaceholder")}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>{t(language, "addVisitorPhoneLabel")}</Text>
        <TextInput
          value={form.phone}
          onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
          placeholder={t(language, "addVisitorPhonePlaceholder")}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>{t(language, "addVisitorTypeLabel")}</Text>
        <View style={styles.pillsRow}>
          {VISIT_TYPE_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.pill, form.type === item && styles.pillSelected]}
              onPress={() =>
                setForm((prev) => ({
                  ...prev,
                  type: item,
                  customType: item === "Other" ? prev.customType : "",
                }))
              }
            >
              <Text style={styles.pillText}>{visitTypeLabel(item)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.type === "Other" ? (
          <>
            <Text style={styles.fieldLabel}>{t(language, "addVisitorCustomTypeLabel")}</Text>
            <TextInput
              value={form.customType}
              onChangeText={(value) =>
                setForm((prev) => ({
                  ...prev,
                  customType: value,
                }))
              }
              placeholder={t(language, "addVisitorCustomTypePlaceholder")}
              style={styles.input}
            />
          </>
        ) : null}

        <Text style={styles.fieldLabel}>{t(language, "addVisitorWingLabel")}</Text>
        <View style={styles.pillsRow}>
          {WINGS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.pill, form.wing === item && styles.pillSelected]}
              onPress={() =>
                setForm((prev) => ({
                  ...prev,
                  wing: item,
                  flatNumber:
                    item === "ROSEDALE"
                      ? "000"
                      : FLATS_IN_WING.includes(
                          prev.flatNumber as (typeof FLATS_IN_WING)[number],
                        )
                        ? prev.flatNumber
                        : "101",
                }))
              }
            >
              <Text style={styles.pillText}>{wingLabel(item)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {form.wing === "ROSEDALE" ? (
          <Text style={styles.helper}>{t(language, "addVisitorRosedaleFlatFixed")}</Text>
        ) : (
          <>
            <Text style={styles.fieldLabel}>{t(language, "addVisitorFlatNumberLabel")}</Text>
            <View style={styles.pillsRow}>
              {FLATS_IN_WING.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.pill, form.flatNumber === item && styles.pillSelected]}
                  onPress={() =>
                    setForm((prev) => ({
                      ...prev,
                      flatNumber: item,
                    }))
                  }
                >
                  <Text style={styles.pillText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.fieldLabel}>{t(language, "addVisitorVehicleLabel")}</Text>
        <View style={styles.pillsRow}>
          {VEHICLE_TYPES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.pill, form.vehicle === item && styles.pillSelected]}
              onPress={() => setForm((prev) => ({ ...prev, vehicle: item }))}
            >
              <Text style={styles.pillText}>{vehicleLabel(item)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t(language, "addVisitorPhotoLabel")}</Text>
        {selectedPhotoUri ? (
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View style={styles.photoPreviewWrap}>
              <View style={styles.photoPreviewPlaceholder}>
                <Text style={styles.photoPreviewInitial}>{selectedPhotoInitial}</Text>
              </View>
              {!isPhotoPreviewBroken ? (
                <Image
                  source={{ uri: selectedPhotoUri }}
                  style={styles.photoPreview}
                  onError={() => setIsPhotoPreviewBroken(true)}
                />
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={styles.helper}>{t(language, "addVisitorOptional")}</Text>
        )}
        <View style={styles.photoButtonsRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <AppButton
              title={t(language, "takePhoto")}
              onPress={takePhoto}
              variant="secondary"
              disabled={!canManage}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <AppButton
              title={t(language, "gallery")}
              onPress={pickFromGallery}
              variant="secondary"
              disabled={!canManage}
            />
          </View>
        </View>

        <View style={styles.formActions}>
          <View style={{ flex: 1 }}>
            <AppButton
              title={
                editingId
                  ? t(language, "manageDailyHelpUpdateButton")
                  : t(language, "manageDailyHelpAddButton")
              }
              onPress={saveForm}
              disabled={!canManage || saving}
            />
          </View>

          {editingId ? (
            <>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <AppButton
                  title={t(language, "cancel")}
                  onPress={startCreate}
                  variant="secondary"
                />
              </View>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "manageDailyHelpExistingList")}</Text>

        {loading ? (
          <Text style={styles.helper}>{t(language, "loading")}</Text>
        ) : templates.length === 0 ? (
          <Text style={styles.helper}>{t(language, "manageDailyHelpEmpty")}</Text>
        ) : (
          templates.map((item, index) => (
            <View key={item.id} style={styles.templateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.templateName}>{item.name}</Text>
                <Text style={styles.templateMeta}>
                  {visitTypeLabel(item.type)} • {item.phone} • {wingLabel(item.wing)}-{item.flatNumber}
                </Text>
              </View>

              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.iconButton, (index === 0 || !canManage) && styles.iconButtonDisabled]}
                  disabled={index === 0 || !canManage}
                  onPress={() => moveTemplate(item.id, -1)}
                >
                  <Text style={styles.iconButtonText}>↑</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    (index === templates.length - 1 || !canManage) && styles.iconButtonDisabled,
                  ]}
                  disabled={index === templates.length - 1 || !canManage}
                  onPress={() => moveTemplate(item.id, 1)}
                >
                  <Text style={styles.iconButtonText}>↓</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.iconButton, !canManage && styles.iconButtonDisabled]}
                  disabled={!canManage}
                  onPress={() => startEdit(item)}
                >
                  <Text style={styles.iconButtonText}>{t(language, "manageDailyHelpEditShort")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.iconButton, !canManage && styles.iconButtonDisabled]}
                  disabled={!canManage}
                  onPress={() => confirmDelete(item)}
                >
                  <Text style={styles.iconButtonText}>{t(language, "manageGuardsDelete")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: "#546e7a",
    marginBottom: 8,
  },
  warning: {
    fontSize: 12,
    color: "#d32f2f",
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: "#546e7a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#37474f",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pill: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  pillSelected: {
    borderColor: "#0aa",
    backgroundColor: "#e0f7fa",
  },
  pillText: {
    fontSize: 13,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ecf0f1",
  },
  profileName: {
    fontSize: 14,
    fontWeight: "600",
  },
  profileMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#607d8b",
  },
  smallButton: {
    borderWidth: 1,
    borderColor: "#1976d2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  smallButtonDisabled: {
    opacity: 0.4,
  },
  smallButtonText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "600",
  },
  formActions: {
    flexDirection: "row",
    marginTop: 10,
  },
  templateRow: {
    borderWidth: 1,
    borderColor: "#ecf0f1",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  templateName: {
    fontSize: 14,
    fontWeight: "700",
  },
  templateMeta: {
    marginTop: 3,
    fontSize: 12,
    color: "#607d8b",
  },
  rowActions: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  iconButton: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 6,
    marginTop: 4,
    backgroundColor: "#fff",
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  iconButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2933",
  },
  photoPreview: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  photoPreviewWrap: {
    width: 90,
    height: 90,
  },
  photoPreviewPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreviewInitial: {
    fontSize: 30,
    fontWeight: "700",
  },
  photoButtonsRow: {
    flexDirection: "row",
    marginTop: 6,
  },
});
