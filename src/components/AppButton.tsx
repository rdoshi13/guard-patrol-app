import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

type Variant = "primary" | "secondary" | "danger";

type Props = {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export const AppButton: React.FC<Props> = ({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  children,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {children ? (
        children
      ) : (
        <Text
          style={[
            styles.text,
            variant === "secondary" && styles.textSecondary,
            variant === "danger" && styles.textDanger,
            disabled && styles.textDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: "#1976d2",
  },
  secondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#1976d2",
  },
  danger: {
    backgroundColor: "#d32f2f",
  },
  disabled: {
    backgroundColor: "#cfd8dc",
    borderColor: "#cfd8dc",
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  textSecondary: {
    color: "#1976d2",
  },
  textDanger: {
    color: "#ffffff",
  },
  textDisabled: {
    color: "#78909c",
  },
});
