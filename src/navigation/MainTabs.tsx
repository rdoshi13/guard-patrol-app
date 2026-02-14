// src/navigation/MainTabs.tsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { GuardSelectScreen } from "../screens/GuardSelectScreen";
import { PatrolScreen } from "../screens/PatrolScreen";
import { VisitorsScreen } from "../screens/VisitorsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { useSession } from "../context/SessionContext";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";

export type MainTabParamList = {
  Shift: undefined;
  Patrol: undefined;
  Visitors: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabsRoute = RouteProp<
  { MainTabs: { initialTab?: keyof MainTabParamList } | undefined },
  "MainTabs"
>;

export const MainTabs: React.FC = () => {
  const route = useRoute<MainTabsRoute>();
  const initialTab = route.params?.initialTab ?? "Shift";

  const { session } = useSession();
  const isShiftLocked = !!session;

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        tabBarLabelPosition: "below-icon",
        tabBarActiveTintColor: "#1976d2",
        tabBarInactiveTintColor: "#8a8a8a",

        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate("Home")}
            style={{
              marginLeft: 10,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: "#888",
              borderRadius: 8,
              backgroundColor: "#f7f7f7",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600" }}>Home</Text>
          </TouchableOpacity>
        ),

        tabBarIcon: ({ focused, size, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "Shift") {
            iconName = focused ? "shield" : "shield-outline";
          } else if (route.name === "Patrol") {
            iconName = focused ? "qr-code" : "qr-code-outline";
          } else if (route.name === "Visitors") {
            iconName = focused ? "people" : "people-outline";
          } else {
            iconName = focused ? "settings" : "settings-outline";
          }

          const iconColor =
            route.name === "Shift" && isShiftLocked ? "#d32f2f" : color;

          return (
            <View style={styles.tabIconWrap}>
              <View
                style={[
                  styles.tabActiveLine,
                  {
                    opacity: focused ? 1 : 0,
                    backgroundColor: color,
                  },
                ]}
              />
              <Ionicons name={iconName} size={size} color={iconColor} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Shift"
        component={GuardSelectScreen}
        options={{
          title: "Guard Shift",
          tabBarLabelStyle: isShiftLocked
            ? { color: "#d32f2f", fontWeight: "600" }
            : undefined,
          tabBarItemStyle: isShiftLocked ? { opacity: 0.85 } : undefined,
        }}
        listeners={{
          tabPress: (e) => {
            if (session) {
              // block going to Shift tab if a shift is active
              e.preventDefault();
            }
          },
        }}
      />
      <Tab.Screen
        name="Patrol"
        component={PatrolScreen}
        options={{ title: "Patrol" }}
      />
      <Tab.Screen
        name="Visitors"
        component={VisitorsScreen}
        options={{ title: "Visitors" }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIconWrap: {
    width: 48,
    alignItems: "center",
  },
  tabActiveLine: {
    width: 30,
    height: 2,
    borderRadius: 1,
    marginBottom: 4,
  },
});
