import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image } from "react-native";
import { AppButton } from "../components/AppButton";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSettings } from "../context/SettingsContext";
import { VisitorProfile, getTopVisitorsByFrequency } from "../storage/visitors";

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
  const [loading, setLoading] = useState(true);

  const loadTop = async () => {
    setLoading(true);

    const top = await getTopVisitorsByFrequency(10);
    setTopVisitors(top);

    setLoading(false);
  };

  // ✅ Runs every time this screen becomes active again
  // (So after saving a visitor and going back, this refreshes automatically)
  useFocusEffect(
    useCallback(() => {
      loadTop();
    }, [])
  );

  const renderItem = ({ item }: { item: VisitorProfile }) => {
    return (
      <View style={styles.row}>
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
            {item.type} • {item.visitCount} visits • Last:{" "}
            {formatDateTime(item.lastSeenAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topArea}>
        <AppButton
          title="Add Visitor"
          onPress={() => navigation.navigate("AddVisitor")}
        />
      </View>
      <Text style={styles.sectionTitle}>Daily Help</Text>
      <Text style={styles.sectionSub}>Quick add common daily staff</Text>

      <View style={styles.dailyRow}>
        <AppButton
          title="Milkman"
          onPress={() =>
            navigation.navigate("AddVisitor", { presetType: "Milkman" })
          }
          variant="secondary"
        />
        <View style={{ width: 10 }} />
        <AppButton
          title="Gardener"
          onPress={() =>
            navigation.navigate("AddVisitor", {
              presetType: "Electrician/Plumber/Gardener",
            })
          }
          variant="secondary"
        />
        <View style={{ width: 10 }} />
        <AppButton
          title="Sweeper"
          onPress={() =>
            navigation.navigate("AddVisitor", { presetType: "Maid" })
          }
          variant="secondary"
        />
      </View>

      <View style={{ height: 18 }} />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Frequent Visitors (Top 10)</Text>
        <View style={{ marginLeft: 12, width: 110 }}>
          <AppButton title="Refresh" onPress={loadTop} variant="secondary" />
        </View>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading…</Text>
      ) : topVisitors.length === 0 ? (
        <Text style={styles.emptyText}>
          No visitors yet. Add a visitor entry to populate this list.
        </Text>
      ) : (
        <FlatList
          data={topVisitors}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  topArea: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  // sectionTitle: {
  //   fontSize: 16,
  //   fontWeight: "600",
  // },
  emptyText: {
    marginTop: 16,
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
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
