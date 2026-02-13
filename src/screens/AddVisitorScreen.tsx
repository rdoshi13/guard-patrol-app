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
import { useNavigation } from "@react-navigation/native";
import {
  VisitType,
  VehicleType,
  VisitorProfile,
  loadVisitorProfiles,
  upsertVisitorProfile,
  addVisitorEntry,
  parseLegacyFlat,
} from "../storage/visitors";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";

const VISIT_TYPES: VisitType[] = [
  "Courier/Delivery",
  "Maid",
  "Guest",
  "Electrician/Plumber/Gardener",
  "Milkman",
  "Paperboy",
];

const WINGS = ["A", "B", "C", "D"] as const;

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
type FlatNumber = (typeof FLATS_IN_WING)[number];
const VEHICLE_TYPES: VehicleType[] = ["None", "Car", "Bike", "Cycle"];

export const AddVisitorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session } = useSession();
  const { language } = useSettings();
  const canSave = !!session;

  const [allProfiles, setAllProfiles] = useState<VisitorProfile[]>([]);

  const [type, setType] = useState<VisitType>("Guest");
  const [wing, setWing] = useState<Wing>("A");
  const [flatNumber, setFlatNumber] = useState<FlatNumber>("101");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [vehicle, setVehicle] = useState<VehicleType>("None");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const init = async () => {
      const profiles = await loadVisitorProfiles();
      setAllProfiles(profiles);
    };
    init();
  }, []);

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
      setPhotoUri(result.assets[0].uri);
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
      setPhotoUri(result.assets[0].uri);
    }
  };

  const selectSuggestion = (p: VisitorProfile) => {
    setName(p.name);
    setPhone(p.phone);
    setVehicle(p.vehicle);
    setPhotoUri(p.photoUri);
    setType(p.type);
    const parsedLegacy = parseLegacyFlat(p.flat);
    const w = p.wing ?? parsedLegacy.wing;
    const f = p.flatNumber ?? parsedLegacy.flatNumber;

    if (w && WINGS.includes(w as Wing)) setWing(w as Wing);
    if (f && FLATS_IN_WING.includes(f as FlatNumber)) {
      setFlatNumber(f as FlatNumber);
    }

    setShowSuggestions(false);
  };

  const validate = () => {
    const n = name.trim();
    const ph = phone.replace(/\D/g, "");

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
        type,
        vehicle,
        wing,
        flatNumber,
        photoUri,
      });

      await addVisitorEntry({
        society: "Rosedale",
        guardId: session.guardId,
        guardName: session.guardName,
        visitorId: profile?.id,
        name: name.trim(),
        phone: ph,
        type,
        vehicle,
        wing,
        flatNumber,
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

  const visitTypeLabel = (type: VisitType) => {
    const keyMap: Record<
      VisitType,
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
    return t(language, keyMap[type]);
  };

  const vehicleLabel = (vehicleType: VehicleType) => {
    const map: Partial<Record<VehicleType, string>> = {
      None: language === "gu" ? "કંઈ નહિ" : "None",
      Car: language === "gu" ? "કાર" : "Car",
      Bike: language === "gu" ? "બાઈક" : "Bike",
      Cycle: language === "gu" ? "સાયકલ" : "Cycle",
    };
    return map[vehicleType] ?? vehicleType;
  };

  const renderSuggestion = (item: VisitorProfile, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.suggestionRow, isLast && styles.suggestionRowLast]}
      onPress={() => selectSuggestion(item)}
    >
      {item.photoUri ? (
        <Image
          source={{ uri: item.photoUri }}
          style={styles.suggestionAvatar}
        />
      ) : (
        <View style={styles.suggestionAvatarPlaceholder}>
          <Text style={styles.suggestionInitial}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        <Text style={styles.suggestionMeta}>{visitTypeLabel(item.type)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Type */}
      <Text style={styles.label}>{t(language, "addVisitorTypeLabel")}</Text>
      <View style={styles.pillsRow}>
        {VISIT_TYPES.map((vt) => {
          const selected = vt === type;

          return (
            <TouchableOpacity
              key={vt}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => setType(vt)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillText}>{visitTypeLabel(vt)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
            onPress={() => setWing(w)}
            activeOpacity={0.8}
          >
            <Text style={styles.pillText}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.subLabel}>
        {t(language, "addVisitorFlatNumberLabel")}
      </Text>
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

      <Text style={styles.helperText}>
        {t(language, "addVisitorSavedAs")} {wing}-{flatNumber}
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
      {photoUri ? (
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
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
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  suggestionAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
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
    width: 90,
    height: 90,
    borderRadius: 45,
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
