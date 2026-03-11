import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1c1917",
        tabBarInactiveTintColor: "#a8a29e",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e7e5e4",
          ...(Platform.OS === "web" && { height: 56 }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="recipes"
        options={{
          title: "Recipes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: "Queue",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: "New",
          tabBarActiveTintColor: "#d97706",
          tabBarInactiveTintColor: "#d97706",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: "Import",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="arrow-down-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
