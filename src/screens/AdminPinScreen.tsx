import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { AppButton } from "../components/AppButton";
import { ADMIN_PIN } from "../constants/admin";

type Props = NativeStackScreenProps<RootStackParamList, "AdminPin">;

export const AdminPinScreen: React.FC<Props> = ({ navigation }) => {
  const [pin, setPin] = useState("");

  const canSubmit = useMemo(() => pin.length === 6, [pin.length]);

  const submit = () => {
    if (pin === ADMIN_PIN) {
      setPin("");
      navigation.replace("ManageGuards");
      return;
    }

    Alert.alert("Wrong PIN", "Please try again.");
    setPin("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin PIN</Text>
      <Text style={styles.subtitle}>Enter 6-digit PIN to manage guards.</Text>

      <TextInput
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry
        placeholder="••••••"
        style={styles.input}
      />

      <View style={{ marginTop: 16 }}>
        <AppButton title="Continue" onPress={submit} disabled={!canSubmit} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  subtitle: { marginTop: 6, color: "#546e7a" },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 6,
  },
});
