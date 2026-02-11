// src/navigation/RootNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { MainTabs, MainTabParamList } from "./MainTabs";
import { AddVisitorScreen } from "../screens/AddVisitorScreen";
import { AdminPinScreen } from "../screens/AdminPinScreen";
import { ManageGuardsScreen } from "../screens/ManageGuardsScreen";

export type RootStackParamList = {
  Home: undefined;
  MainTabs: { initialTab?: "Shift" | "Patrol" | "Visitors" | "Settings" };
  AddVisitor: undefined;
  AdminPin: undefined;
  ManageGuards: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Home Screen", headerBackVisible: false }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddVisitor"
        component={AddVisitorScreen}
        options={{ title: "Add Visitor" }}
      />
      <Stack.Screen
        name="AdminPin"
        component={AdminPinScreen}
        options={{ title: "Admin PIN" }}
      />

      <Stack.Screen
        name="ManageGuards"
        component={ManageGuardsScreen}
        options={{ title: "Manage Guards" }}
      />
    </Stack.Navigator>
  );
};
