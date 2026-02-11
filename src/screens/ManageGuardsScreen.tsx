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

type Props = NativeStackScreenProps<RootStackParamList, "ManageGuards">;

type EditDraft = {
  id: string;
  name: string;
  phone: string;
  photoUri?: string;
};

export const ManageGuardsScreen: React.FC<Props> = () => {
  const { session } = useSession();

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
        "Cannot delete",
        `You can't delete ${item.name} while their shift is active.`
      );
      return;
    }

    Alert.alert("Delete guard?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
        "Cannot edit",
        `You can't edit ${item.name} while their shift is active.`
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
      Alert.alert("Missing info", "Name and phone number are required.");
      return;
    }

    if (isActiveGuard(draft.id)) {
      Alert.alert(
        "Cannot edit",
        `You can't edit ${
          activeGuardName ?? "this guard"
        } while their shift is active.`
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
      <Text style={styles.title}>Manage Guards</Text>
      <Text style={styles.subtitle}>Edit/delete guards (admin only).</Text>

      {activeGuardId ? (
        <Text style={styles.activeNote}>
          Active shift: {activeGuardName ?? "(loading...)"}
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
                    <Text style={styles.badge}>Active shift</Text>
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
                    title="Delete"
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
            No guards found.
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
            <Text style={styles.modalTitle}>Edit Guard</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={draft?.name ?? ""}
              onChangeText={(text) =>
                setDraft((d) => (d ? { ...d, name: text } : d))
              }
              placeholder="Ramesh"
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Phone</Text>
            <TextInput
              style={styles.textInput}
              value={draft?.phone ?? ""}
              onChangeText={(text) =>
                setDraft((d) => (d ? { ...d, phone: text } : d))
              }
              placeholder="9876543210"
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
              Photo (optional)
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
                  title="Take photo"
                  onPress={takePhoto}
                  variant="secondary"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ width: 140 }}>
                <AppButton
                  title="Gallery"
                  onPress={pickFromGallery}
                  variant="secondary"
                />
              </View>
            </View>

            <View style={styles.modalButtonsRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppButton
                  title="Cancel"
                  onPress={closeEdit}
                  variant="secondary"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <AppButton title="Save" onPress={saveEdit} />
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
