import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
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
} from "../storage/visitors";
import { useSession } from "../context/SessionContext";

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
      Alert.alert("Permission needed", "Gallery permission is required.");
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
      Alert.alert("Permission needed", "Camera permission is required.");
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
    if (p.flat) {
      // Accept formats like: "B-402", "b - 402", "B–402", "B—402" with extra spaces
      const s = String(p.flat).trim();
      const m = s.match(/^\s*([A-D])\s*[-–—]?\s*(\d{3})\s*$/i);

      if (m) {
        const w = m[1].toUpperCase() as Wing;
        const f = m[2] as FlatNumber;

        if (WINGS.includes(w)) setWing(w);
        if (FLATS_IN_WING.includes(f)) setFlatNumber(f);
      }

      console.log(
        "[AddVisitor] suggestion flat raw=",
        p.flat,
        "parsed=",
        m ? `${m[1].toUpperCase()}-${m[2]}` : "NO_MATCH",
      );
    }
    setShowSuggestions(false);
  };

  const validate = () => {
    const n = name.trim();
    const ph = phone.replace(/\D/g, "");

    if (!n) return "Name is required";
    if (ph.length < 8) return "Valid phone number is required";

    return null;
  };

  const save = async () => {
    if (!session) {
      Alert.alert("Start shift", "Start a shift before adding visitors.");
      return;
    }

    const err = validate();
    if (err) {
      Alert.alert("Missing info", err);
      return;
    }

    const ph = phone.replace(/\D/g, "");

    try {
      const profile = await upsertVisitorProfile({
        name: name.trim(),
        phone: ph,
        type,
        vehicle,
        flat: `${wing}-${flatNumber}`,
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
        flat: `${wing}-${flatNumber}`,
        event: "CHECKIN",
      });

      // VisitorsScreen refreshes via useFocusEffect
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        "Save failed",
        "Could not save the visitor entry. Please try again.",
      );
    }
  };

  const renderSuggestion = ({ item }: { item: VisitorProfile }) => (
    <TouchableOpacity
      style={styles.suggestionRow}
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
        <Text style={styles.suggestionMeta}>{item.type}</Text>
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
      <Text style={styles.label}>Type of visit</Text>
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
              <Text style={styles.pillText}>{vt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Name + suggestions */}
      <Text style={styles.label}>Name</Text>
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
        placeholder="Enter name"
        style={styles.input}
      />

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          <FlatList
            data={suggestions}
            keyExtractor={(i) => i.id}
            renderItem={renderSuggestion}
          />
        </View>
      )}

      {/* Phone */}
      <Text style={styles.label}>Phone number</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Enter phone"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <Text style={styles.label}>Flat</Text>

      <Text style={styles.subLabel}>Wing</Text>
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

      <Text style={styles.subLabel}>Flat</Text>
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
        Saved as {wing}-{flatNumber}
      </Text>
      {/* Vehicle */}
      <Text style={styles.label}>Vehicle</Text>
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
              <Text style={styles.pillText}>{v}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Photo */}
      <Text style={styles.label}>Photo</Text>
      {photoUri ? (
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        </View>
      ) : (
        <Text style={styles.helperText}>Optional</Text>
      )}

      <View style={styles.photoButtonsRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <AppButton
            title="Take photo"
            onPress={takePhoto}
            variant="secondary"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <AppButton
            title="Gallery"
            onPress={pickFromGallery}
            variant="secondary"
          />
        </View>
      </View>

      {!canSave && (
        <Text style={styles.helperText}>Start a shift to add visitors.</Text>
      )}

      <View style={{ marginTop: 18 }}>
        <AppButton title="Save visitor" onPress={save} disabled={!canSave} />
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
