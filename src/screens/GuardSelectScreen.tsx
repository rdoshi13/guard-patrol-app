// src/screens/GuardSelectScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { AppButton } from "../components/AppButton";
import { useNavigation } from "@react-navigation/native";
import { useSession, ShiftType } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";
import { Guard, loadGuards, saveGuards, createGuard } from "../storage/guards";
import * as ImagePicker from "expo-image-picker";

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

function getInitial(name: string): string {
  const s = String(name ?? "").trim();
  return s ? s.charAt(0).toUpperCase() : "?";
}

export const GuardSelectScreen: React.FC = () => {
  const { session, startSession } = useSession();
  const { language } = useSettings();
  const navigation = useNavigation<any>();

  const [guards, setGuards] = useState<Guard[]>([]);
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGuardName, setNewGuardName] = useState("");
  const [newGuardPhone, setNewGuardPhone] = useState("");
  const [newGuardPhotoUri, setNewGuardPhotoUri] = useState<string | undefined>(
    undefined
  );
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [brokenGuardImages, setBrokenGuardImages] = useState<
    Record<string, boolean>
  >({});
  const [isNewGuardPreviewBroken, setIsNewGuardPreviewBroken] = useState(false);

  // load guards once
  useEffect(() => {
    const init = async () => {
      const data = await loadGuards();
      setBrokenGuardImages({});
      setGuards(data);
    };
    init();
  }, []);

  const goHome = () => {
    const parent = navigation.getParent();
    parent?.navigate("Home");
  };

  const handleAddNewGuard = async () => {
    const name = newGuardName.trim();
    const phone = newGuardPhone.trim();

    if (!name || !phone) {
      return;
    }

    const newGuard = createGuard(name, phone, normalizeImageUri(newGuardPhotoUri));
    const updated = [...guards, newGuard];

    setGuards(updated);
    await saveGuards(updated);
    setSelectedGuard(newGuard);

    setNewGuardName("");
    setNewGuardPhone("");
    setNewGuardPhotoUri(undefined);
    setIsNewGuardPreviewBroken(false);
    setModalVisible(false);
  };

  const handleStartShift = () => {
    if (!selectedGuard || !selectedShift) return;
    if (session) return; // extra safety: don't overwrite active session

    startSession({
      guardId: selectedGuard.id,
      guardName: selectedGuard.name,
      shift: selectedShift,
      startedAt: new Date().toISOString(),
    });

    goHome();
  };

  const renderGuardItem = ({ item }: { item: Guard }) => {
    const guardPhotoUri = normalizeImageUri(item.photoUri);
    return (
      <TouchableOpacity
        style={[
          styles.guardItem,
          selectedGuard?.id === item.id && styles.guardItemSelected,
        ]}
        onPress={() => setSelectedGuard(item)}
      >
        <View style={styles.guardAvatarWrap}>
          <View style={styles.guardAvatarPlaceholder}>
            <Text style={styles.guardAvatarInitial}>
              {getInitial(item.name)}
            </Text>
          </View>
          {guardPhotoUri && !brokenGuardImages[item.id] ? (
            <Image
              source={{ uri: guardPhotoUri }}
              style={styles.guardAvatar}
              onError={() =>
                setBrokenGuardImages((prev) => ({
                  ...prev,
                  [item.id]: true,
                }))
              }
            />
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.guardName}>{item.name}</Text>
          <Text style={styles.guardPhone}>{item.phone}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // image pickers
  const pickFromGallery = async () => {
    if (isPickingPhoto) return;

    setIsPickingPhoto(true);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          t(language, "permissionNeededTitle"),
          t(language, "galleryPermissionMsg"),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // Deprecated warning, but most compatible across Expo Go/Android.
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });

      if (!result.canceled && result.assets.length > 0) {
        setNewGuardPhotoUri(normalizeImageUri(result.assets[0].uri));
        setIsNewGuardPreviewBroken(false);
      }
    } catch (e: any) {
      Alert.alert(
        t(language, "galleryErrorTitle"),
        e?.message ?? t(language, "galleryOpenFailMsg"),
      );
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const takePhoto = async () => {
    if (isPickingPhoto) return;

    setIsPickingPhoto(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          t(language, "permissionNeededTitle"),
          t(language, "cameraPermissionMsg"),
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
      });

      if (!result.canceled && result.assets.length > 0) {
        setNewGuardPhotoUri(normalizeImageUri(result.assets[0].uri));
        setIsNewGuardPreviewBroken(false);
      }
    } catch (e: any) {
      Alert.alert(
        t(language, "cameraErrorTitle"),
        e?.message ?? t(language, "cameraOpenFailMsg"),
      );
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const newGuardPreviewUri = normalizeImageUri(newGuardPhotoUri);
  const newGuardInitial = getInitial(newGuardName);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t(language, "guardSelectTitle")}</Text>

      <Text style={styles.label}>{t(language, "selectGuardLabel")}</Text>
      <FlatList
        data={guards}
        keyExtractor={(item) => item.id}
        renderItem={renderGuardItem}
        style={styles.guardList}
      />

      <View style={{ marginVertical: 8 }}>
        <AppButton
          title={t(language, "addNewGuard")}
          onPress={() => {
            setIsNewGuardPreviewBroken(false);
            setModalVisible(true);
          }}
          variant="secondary"
        />
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>
        {t(language, "shiftLabel")}
      </Text>

      <View style={styles.shiftRow}>
        <TouchableOpacity
          style={[
            styles.shiftButton,
            selectedShift === "DAY" && styles.shiftButtonSelected,
          ]}
          onPress={() => setSelectedShift("DAY")}
        >
          <Text>{t(language, "day")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.shiftButton,
            selectedShift === "NIGHT" && styles.shiftButtonSelected,
          ]}
          onPress={() => setSelectedShift("NIGHT")}
        >
          <Text>{t(language, "night")}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 24, width: "100%" }}>
        <AppButton
          title={t(language, "startShift")}
          onPress={handleStartShift}
          disabled={!selectedGuard || !selectedShift || !!session}
        />
      </View>

      {/* <View style={{ marginTop: 12, width: "100%" }}>
        <Button title="Home" onPress={goHome} />
      </View> */}

      {/* modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsNewGuardPreviewBroken(false);
          setModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.label}>{t(language, "addNewGuard")}</Text>

            <Text style={[styles.label, { marginTop: 8 }]}>
              {t(language, "guardNameLabel")}
            </Text>
            <TextInput
              style={styles.input}
              value={newGuardName}
              onChangeText={setNewGuardName}
              placeholder={t(language, "guardNamePlaceholder")}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>
              {t(language, "guardPhoneLabel")}
            </Text>
            <TextInput
              style={styles.input}
              value={newGuardPhone}
              onChangeText={setNewGuardPhone}
              placeholder={t(language, "guardPhonePlaceholder")}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, { marginTop: 8 }]}>
              {t(language, "guardPhotoOptional")}
            </Text>
            {newGuardPreviewUri && (
              <View style={{ alignItems: "center", marginBottom: 8 }}>
                <View style={styles.newGuardPreviewWrap}>
                  <View style={styles.newGuardPreviewPlaceholder}>
                    <Text style={styles.newGuardPreviewInitial}>{newGuardInitial}</Text>
                  </View>
                  {!isNewGuardPreviewBroken ? (
                    <Image
                      source={{ uri: newGuardPreviewUri }}
                      style={styles.newGuardPreview}
                      onError={() => setIsNewGuardPreviewBroken(true)}
                    />
                  ) : null}
                </View>
              </View>
            )}
            <View style={styles.photoButtonsRow}>
              <View style={{ width: 140 }}>
                <AppButton
                  title={t(language, "takePhoto")}
                  onPress={takePhoto}
                  variant="secondary"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ width: 140 }}>
                <AppButton
                  title={t(language, "gallery")}
                  onPress={pickFromGallery}
                  variant="secondary"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppButton
                  title={t(language, "cancel")}
                  onPress={() => {
                    setIsNewGuardPreviewBroken(false);
                    setModalVisible(false);
                  }}
                  variant="secondary"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <AppButton title={t(language, "save")} onPress={handleAddNewGuard} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 8,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  guardList: {
    maxHeight: 220,
  },
  guardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 8,
  },
  guardItemSelected: {
    backgroundColor: "#e0f7fa",
  },
  guardAvatarWrap: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  guardAvatar: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  guardAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  guardAvatarInitial: {
    fontSize: 18,
    fontWeight: "600",
  },
  newGuardPreviewWrap: {
    width: 80,
    height: 80,
  },
  newGuardPreviewPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  newGuardPreviewInitial: {
    fontSize: 28,
    fontWeight: "700",
  },
  newGuardPreview: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  guardName: {
    fontSize: 16,
    fontWeight: "500",
  },
  guardPhone: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  shiftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  shiftButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  shiftButtonSelected: {
    backgroundColor: "#e0f7fa",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  photoButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
});
