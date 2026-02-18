import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { AppButton } from "../components/AppButton";
import * as ImagePicker from "expo-image-picker";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KnownVisitType,
  VisitType,
  VehicleType,
  VisitorProfile,
  VisitorWing,
  loadVisitorProfiles,
  upsertVisitorProfile,
  addVisitorEntry,
  parseLegacyFlat,
} from "../storage/visitors";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";

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

const WINGS = ["A", "B", "C", "D", "ROSEDALE"] as const;

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

type Wing = (typeof WINGS)[number];
const VEHICLE_TYPES: VehicleType[] = ["None", "Car", "Bike", "Cycle"];

const DEFAULT_WING: Wing = "A";
const DEFAULT_FLAT = "101";

type AddVisitorRoute = RouteProp<RootStackParamList, "AddVisitor">;

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

export const AddVisitorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<AddVisitorRoute>();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { language } = useSettings();
  const canSave = !!session;

  const [allProfiles, setAllProfiles] = useState<VisitorProfile[]>([]);

  const [selectedTypeOption, setSelectedTypeOption] =
    useState<VisitTypeOption>("Guest");
  const [customType, setCustomType] = useState("");
  const [wing, setWing] = useState<Wing>(DEFAULT_WING);
  const [flatNumber, setFlatNumber] = useState<string>(DEFAULT_FLAT);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [vehicle, setVehicle] = useState<VehicleType>("None");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [brokenSuggestionImages, setBrokenSuggestionImages] = useState<
    Record<string, boolean>
  >({});
  const [isSelectedPhotoBroken, setIsSelectedPhotoBroken] = useState(false);

  useEffect(() => {
    const init = async () => {
      const profiles = await loadVisitorProfiles();
      setAllProfiles(profiles);
    };
    init();
  }, []);

  const isSocietyWide = wing === "ROSEDALE";
  const savedFlatNumber = isSocietyWide ? "000" : flatNumber;
  const resolvedType: VisitType =
    selectedTypeOption === "Other" ? customType.trim() : selectedTypeOption;

  const resolveWing = (input: unknown): Wing | null => {
    if (typeof input !== "string") return null;
    const normalized = input.trim().toUpperCase();
    return WINGS.includes(normalized as Wing) ? (normalized as Wing) : null;
  };

  const applyTypeValue = (value: unknown) => {
    if (typeof value !== "string") {
      setSelectedTypeOption("Guest");
      setCustomType("");
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setSelectedTypeOption("Guest");
      setCustomType("");
      return;
    }

    if (VISIT_TYPES.includes(trimmed as KnownVisitType)) {
      setSelectedTypeOption(trimmed as KnownVisitType);
      setCustomType("");
      return;
    }

    setSelectedTypeOption("Other");
    setCustomType(trimmed);
  };

  useEffect(() => {
    const prefill = route.params?.prefill;
    if (!prefill) return;

    if (typeof prefill.name === "string") setName(prefill.name);
    if (typeof prefill.phone === "string") setPhone(prefill.phone);

    applyTypeValue(prefill.type);

    if (prefill.vehicle && VEHICLE_TYPES.includes(prefill.vehicle)) {
      setVehicle(prefill.vehicle);
    }

    const prefillWing = resolveWing(prefill.wing);
    if (prefillWing) {
      setWing(prefillWing);
      if (prefillWing === "ROSEDALE") {
        setFlatNumber("000");
      } else if (
        typeof prefill.flatNumber === "string" &&
        FLATS_IN_WING.includes(prefill.flatNumber as (typeof FLATS_IN_WING)[number])
      ) {
        setFlatNumber(prefill.flatNumber);
      } else {
        setFlatNumber(DEFAULT_FLAT);
      }
    }

    if (typeof prefill.photoUri === "string") {
      setPhotoUri(normalizeImageUri(prefill.photoUri));
    }

    setShowSuggestions(false);
  }, [route.params?.prefill]);

  // starts-with only suggestions (case-insensitive)
  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];

    return allProfiles
      .filter((p) => p.name.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [name, allProfiles]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t(language, "addVisitorPermissionNeeded"),
        t(language, "addVisitorGalleryPermission"),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // Deprecated warning, but most compatible across Expo Go/Android.
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(normalizeImageUri(result.assets[0].uri));
    }
  };

  const takePhoto = async () => {
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
      setPhotoUri(normalizeImageUri(result.assets[0].uri));
    }
  };

  const selectSuggestion = (p: VisitorProfile) => {
    setName(p.name);
    setPhone(p.phone);
    setVehicle(p.vehicle);
    setPhotoUri(normalizeImageUri(p.photoUri));
    applyTypeValue(p.type);
    const parsedLegacy = parseLegacyFlat(p.flat);
    const w = p.wing ?? parsedLegacy.wing;
    const f = p.flatNumber ?? parsedLegacy.flatNumber;

    if (w && WINGS.includes(w as Wing)) {
      setWing(w as Wing);
      if (w === "ROSEDALE") {
        setFlatNumber("000");
      } else if (f && FLATS_IN_WING.includes(f as (typeof FLATS_IN_WING)[number])) {
        setFlatNumber(f);
      } else {
        setFlatNumber(DEFAULT_FLAT);
      }
    }

    setShowSuggestions(false);
  };

  const validate = () => {
    const n = name.trim();
    const ph = phone.replace(/\D/g, "");
    const custom = customType.trim();

    if (selectedTypeOption === "Other" && !custom) {
      return t(language, "addVisitorValidationCustomType");
    }
    if (!n) return t(language, "addVisitorValidationName");
    if (ph.length < 8) return t(language, "addVisitorValidationPhone");

    return null;
  };

  const save = async () => {
    if (!session) {
      Alert.alert(
        t(language, "addVisitorStartShiftTitle"),
        t(language, "addVisitorStartShiftMsg"),
      );
      return;
    }

    const err = validate();
    if (err) {
      Alert.alert(t(language, "addVisitorMissingInfoTitle"), err);
      return;
    }

    const ph = phone.replace(/\D/g, "");

    try {
      const profile = await upsertVisitorProfile({
        name: name.trim(),
        phone: ph,
        type: resolvedType,
        vehicle,
        wing,
        flatNumber: savedFlatNumber,
        photoUri,
      });

      await addVisitorEntry({
        society: "Rosedale",
        guardId: session.guardId,
        guardName: session.guardName,
        visitorId: profile?.id,
        name: name.trim(),
        phone: ph,
        type: resolvedType,
        vehicle,
        wing,
        flatNumber: savedFlatNumber,
        event: "CHECKIN",
      });

      // VisitorsScreen refreshes via useFocusEffect
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        t(language, "addVisitorSaveFailedTitle"),
        t(language, "addVisitorSaveFailedMsg"),
      );
    }
  };

  const visitTypeLabel = (type: string) => {
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
      Milkman: "visitorsMilkman",
      Guest: "visitorsGuest",
      Paperboy: "visitorsPaperboy",
      "Electrician/Plumber/Gardener": "visitorsGardener",
      Other: "visitorsOther",
    };
    const key = keyMap[type];
    return key ? t(language, key) : type;
  };

  const vehicleLabel = (vehicleType: VehicleType) => {
    if (language === "hi") {
      const hiMap: Record<VehicleType, string> = {
        None: "कोई नहीं",
        Car: "कार",
        Bike: "बाइक",
        Cycle: "साइकिल",
      };
      return hiMap[vehicleType];
    }

    const map: Partial<Record<VehicleType, string>> = {
      None: language === "gu" ? "કંઈ નહિ" : "None",
      Car: language === "gu" ? "કાર" : "Car",
      Bike: language === "gu" ? "બાઈક" : "Bike",
      Cycle: language === "gu" ? "સાયકલ" : "Cycle",
    };
    return map[vehicleType] ?? vehicleType;
  };

  const wingLabel = (wingValue: VisitorWing) => {
    if (wingValue === "ROSEDALE") {
      return t(language, "addVisitorWingRosedale");
    }
    return wingValue;
  };

  const renderSuggestion = (item: VisitorProfile, isLast: boolean) => {
    const suggestionPhotoUri = normalizeImageUri(item.photoUri);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.suggestionRow, isLast && styles.suggestionRowLast]}
        onPress={() => selectSuggestion(item)}
      >
        <View style={styles.suggestionAvatarWrap}>
          <View style={styles.suggestionAvatarPlaceholder}>
            <Text style={styles.suggestionInitial}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          {suggestionPhotoUri && !brokenSuggestionImages[item.id] ? (
            <Image
              source={{ uri: suggestionPhotoUri }}
              style={styles.suggestionAvatar}
              onError={() =>
                setBrokenSuggestionImages((prev) => ({
                  ...prev,
                  [item.id]: true,
                }))
              }
            />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.suggestionName}>{item.name}</Text>
          <Text style={styles.suggestionMeta}>{visitTypeLabel(item.type)}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  const selectedPhotoUri = normalizeImageUri(photoUri);
  const selectedPhotoInitial = String(name ?? "").trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    setIsSelectedPhotoBroken(false);
  }, [selectedPhotoUri]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: Math.max(96, insets.bottom + 36) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Type */}
      <Text style={styles.label}>{t(language, "addVisitorTypeLabel")}</Text>
      <View style={styles.pillsRow}>
        {VISIT_TYPE_OPTIONS.map((vt) => {
          const selected = vt === selectedTypeOption;

          return (
            <TouchableOpacity
              key={vt}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => setSelectedTypeOption(vt)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillText}>{visitTypeLabel(vt)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedTypeOption === "Other" && (
        <>
          <Text style={styles.label}>{t(language, "addVisitorCustomTypeLabel")}</Text>
          <TextInput
            value={customType}
            onChangeText={setCustomType}
            placeholder={t(language, "addVisitorCustomTypePlaceholder")}
            style={styles.input}
          />
        </>
      )}

      {/* Name + suggestions */}
      <Text style={styles.label}>{t(language, "addVisitorNameLabel")}</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);

          const trimmed = v.trim();
          setShowSuggestions(trimmed.length > 0);
          if (
            trimmed.length > 0 &&
            allProfiles.some(
              (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
            )
          ) {
            setShowSuggestions(false);
          }
        }}
        placeholder={t(language, "addVisitorNamePlaceholder")}
        style={styles.input}
      />

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((item, index) =>
            renderSuggestion(item, index === suggestions.length - 1),
          )}
        </View>
      )}

      {/* Phone */}
      <Text style={styles.label}>{t(language, "addVisitorPhoneLabel")}</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder={t(language, "addVisitorPhonePlaceholder")}
        keyboardType="phone-pad"
        style={styles.input}
      />
      <Text style={styles.label}>{t(language, "addVisitorFlatLabel")}</Text>

      <Text style={styles.subLabel}>{t(language, "addVisitorWingLabel")}</Text>
      <View style={styles.pillsRow}>
        {WINGS.map((w) => (
          <TouchableOpacity
            key={w}
            style={[styles.pill, w === wing && styles.pillSelected]}
            onPress={() => {
              setWing(w);
              if (w === "ROSEDALE") {
                setFlatNumber("000");
                return;
              }

              if (!FLATS_IN_WING.includes(flatNumber as (typeof FLATS_IN_WING)[number])) {
                setFlatNumber(DEFAULT_FLAT);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.pillText}>{wingLabel(w)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.subLabel}>
        {t(language, "addVisitorFlatNumberLabel")}
      </Text>
      {isSocietyWide ? (
        <Text style={styles.helperText}>{t(language, "addVisitorRosedaleFlatFixed")}</Text>
      ) : (
        <View style={styles.pillsRow}>
          {FLATS_IN_WING.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, f === flatNumber && styles.pillSelected]}
              onPress={() => setFlatNumber(f)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillText}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.helperText}>
        {t(language, "addVisitorSavedAs")} {wingLabel(wing)}-{savedFlatNumber}
      </Text>
      {/* Vehicle */}
      <Text style={styles.label}>{t(language, "addVisitorVehicleLabel")}</Text>
      <View style={styles.pillsRow}>
        {VEHICLE_TYPES.map((v) => {
          const selected = v === vehicle;

          return (
            <TouchableOpacity
              key={v}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => setVehicle(v)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillText}>{vehicleLabel(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Photo */}
      <Text style={styles.label}>{t(language, "addVisitorPhotoLabel")}</Text>
      {selectedPhotoUri ? (
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <View style={styles.photoPreviewWrap}>
            <View style={styles.photoPreviewPlaceholder}>
              <Text style={styles.photoPreviewInitial}>{selectedPhotoInitial}</Text>
            </View>
            {!isSelectedPhotoBroken ? (
              <Image
                source={{ uri: selectedPhotoUri }}
                style={styles.photoPreview}
                onError={() => setIsSelectedPhotoBroken(true)}
              />
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={styles.helperText}>{t(language, "addVisitorOptional")}</Text>
      )}

      <View style={styles.photoButtonsRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <AppButton
            title={t(language, "takePhoto")}
            onPress={takePhoto}
            variant="secondary"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <AppButton
            title={t(language, "gallery")}
            onPress={pickFromGallery}
            variant="secondary"
          />
        </View>
      </View>

      {!canSave && (
        <Text style={styles.helperText}>
          {t(language, "addVisitorStartShiftHint")}
        </Text>
      )}

      <View style={{ marginTop: 18 }}>
        <AppButton
          title={t(language, "addVisitorSaveButton")}
          onPress={save}
          disabled={!canSave}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pill: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  pillSelected: {
    backgroundColor: "#e0f7fa",
    borderColor: "#0aa",
  },
  pillText: {
    fontSize: 13,
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    marginTop: 6,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionAvatarWrap: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  suggestionAvatar: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  suggestionAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionInitial: {
    fontSize: 16,
    fontWeight: "700",
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: "600",
  },
  suggestionMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
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
  subLabel: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 13,
    color: "#546e7a",
    fontWeight: "600",
  },
});
