import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Image,
  Modal,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { RootStackParamList } from "../navigation/RootNavigator";
import { AppButton } from "../components/AppButton";
import { Guard, loadGuards, saveGuards } from "../storage/guards";
import { useSession } from "../context/SessionContext";
import { useSettings } from "../context/SettingsContext";
import { t } from "../i18n/strings";

type Props = NativeStackScreenProps<RootStackParamList, "ManageGuards">;

type EditDraft = {
  id: string;
  name: string;
  phone: string;
  photoUri?: string;
};

export const ManageGuardsScreen: React.FC<Props> = () => {
  const { session } = useSession();
  const { language } = useSettings();

  const [guards, setGuards] = useState<Guard[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  const activeGuardId = session?.guardId ?? null;

  const activeGuardName = useMemo(() => {
    if (!activeGuardId) return null;
    const g = guards.find((x) => x.id === activeGuardId);
    return g?.name ?? null;
  }, [activeGuardId, guards]);

  const refresh = async () => {
    const g = await loadGuards();
    setGuards(g);
  };

  useEffect(() => {
    refresh();
  }, []);

  const isActiveGuard = (id: string) => {
    if (!activeGuardId) return false;
    return id === activeGuardId;
  };

  const confirmDelete = (item: Guard) => {
    if (isActiveGuard(item.id)) {
      Alert.alert(
        t(language, "manageGuardsCannotDeleteTitle"),
        t(language, "manageGuardsCannotDeleteMsg").replace("{name}", item.name),
      );
      return;
    }

    Alert.alert(
      t(language, "manageGuardsDeleteConfirmTitle"),
      t(language, "manageGuardsDeleteConfirmMsg"),
      [
      { text: t(language, "cancel"), style: "cancel" },
      {
        text: t(language, "manageGuardsDelete"),
        style: "destructive",
        onPress: async () => {
          const updated = guards.filter((g) => g.id !== item.id);
          setGuards(updated);
          await saveGuards(updated);
        },
      },
    ]);
  };

  const openEdit = (item: Guard) => {
    if (isActiveGuard(item.id)) {
      Alert.alert(
        t(language, "manageGuardsCannotEditTitle"),
        t(language, "manageGuardsCannotEditMsg").replace("{name}", item.name),
      );
      return;
    }

    setDraft({
      id: item.id,
      name: item.name ?? "",
      phone: (item as any).phone ?? "",
      photoUri: (item as any).photoUri,
    });
    setModalVisible(true);
  };

  const closeEdit = () => {
    setModalVisible(false);
    setDraft(null);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setDraft((d) => (d ? { ...d, photoUri: uri } : d));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setDraft((d) => (d ? { ...d, photoUri: uri } : d));
    }
  };

  const saveEdit = async () => {
    if (!draft) return;

    const name = draft.name.trim();
    const phone = draft.phone.trim();

    if (!name || !phone) {
      Alert.alert(
        t(language, "manageGuardsMissingInfoTitle"),
        t(language, "manageGuardsMissingInfoMsg"),
      );
      return;
    }

    if (isActiveGuard(draft.id)) {
      Alert.alert(
        t(language, "manageGuardsCannotEditTitle"),
        t(language, "manageGuardsCannotEditMsg").replace(
          "{name}",
          activeGuardName ?? t(language, "manageGuardsLoadingName"),
        ),
      );
      return;
    }

    const updated = guards.map((g) => {
      if (g.id !== draft.id) return g;
      return {
        ...g,
        name,
        phone,
        photoUri: draft.photoUri,
      } as Guard;
    });

    setGuards(updated);
    await saveGuards(updated);
    closeEdit();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(language, "manageGuardsTitle")}</Text>
      <Text style={styles.subtitle}>{t(language, "manageGuardsSubtitle")}</Text>

      {activeGuardId ? (
        <Text style={styles.activeNote}>
          {t(language, "manageGuardsActiveShiftLabel")}:{" "}
          {activeGuardName ?? t(language, "manageGuardsLoadingName")}
        </Text>
      ) : null}

      <FlatList
        style={{ marginTop: 12 }}
        data={guards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const blocked = isActiveGuard(item.id);

          return (
            <View style={styles.row}>
              <View style={styles.left}>
                {(item as any).photoUri ? (
                  <Image
                    source={{ uri: (item as any).photoUri }}
                    style={styles.guardAvatar}
                  />
                ) : (
                  <View style={styles.guardAvatarPlaceholder}>
                    <Text style={styles.guardAvatarInitial}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.phone}>{(item as any).phone ?? "—"}</Text>
                  {blocked ? (
                    <Text style={styles.badge}>
                      {t(language, "manageGuardsActiveBadge")}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    blocked && styles.iconButtonDisabled,
                  ]}
                  onPress={() => openEdit(item)}
                  disabled={blocked}
                >
                  <Ionicons
                    name="pencil"
                    size={18}
                    color={blocked ? "#90a4ae" : "#1565c0"}
                  />
                </TouchableOpacity>

                <View style={{ width: 110 }}>
                  <AppButton
                    title={t(language, "manageGuardsDelete")}
                    onPress={() => confirmDelete(item)}
                    variant="danger"
                    disabled={blocked}
                  />
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ marginTop: 16, color: "#607d8b" }}>
            {t(language, "manageGuardsNoneFound")}
          </Text>
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(language, "manageGuardsEditTitle")}</Text>

            <Text style={styles.fieldLabel}>{t(language, "guardNameLabel")}</Text>
            <TextInput
              style={styles.textInput}
              value={draft?.name ?? ""}
              onChangeText={(text) =>
                setDraft((d) => (d ? { ...d, name: text } : d))
              }
              placeholder={t(language, "guardNamePlaceholder")}
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
              {t(language, "guardPhoneLabel")}
            </Text>
            <TextInput
              style={styles.textInput}
              value={draft?.phone ?? ""}
              onChangeText={(text) =>
                setDraft((d) => (d ? { ...d, phone: text } : d))
              }
              placeholder={t(language, "guardPhonePlaceholder")}
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
              {t(language, "photoOptional")}
            </Text>

            {draft?.photoUri ? (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Image
                  source={{ uri: draft.photoUri }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              </View>
            ) : null}

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

            <View style={styles.modalButtonsRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppButton
                  title={t(language, "cancel")}
                  onPress={closeEdit}
                  variant="secondary"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <AppButton title={t(language, "save")} onPress={saveEdit} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  subtitle: { marginTop: 6, color: "#546e7a" },
  activeNote: {
    marginTop: 10,
    color: "#1565c0",
    fontWeight: "600",
  },
  row: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  iconButtonDisabled: {
    backgroundColor: "#eceff1",
  },
  name: { fontSize: 16, fontWeight: "700" },
  phone: { marginTop: 2, color: "#546e7a" },
  badge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fff3e0",
    color: "#e65100",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
  },
  guardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  guardAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  guardAvatarInitial: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#37474f",
  },
  textInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  photoButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
});
