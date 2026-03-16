import { Tabs, useRouter, useSegments } from "expo-router";
import { Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TABS = [
  { name: "recipes", title: "Recipes", icon: "book-outline",              amber: false },
  { name: "queue",   title: "Queue",   icon: "time-outline",              amber: false },
  { name: "feed",    title: "Feed",    icon: "people-outline",            amber: false },
  { name: "new",     title: "New",     icon: "add-circle-outline",        amber: true  },
  { name: "import",  title: "Import",  icon: "arrow-down-circle-outline", amber: false },
] as const;

const PHONE_MAX = 600;
const ACTIVE_COLOR   = "#1c1917";
const INACTIVE_COLOR = "#a8a29e";
const AMBER_COLOR    = "#d97706";

// Tabs.Screen must be direct children of Tabs (not wrapped in a component)
// so we build the array here and spread it inline.
const TAB_SCREENS = TABS.map((t) => (
  <Tabs.Screen
    key={t.name}
    name={t.name}
    options={{
      title: t.title,
      ...(t.amber && {
        tabBarActiveTintColor: AMBER_COLOR,
        tabBarInactiveTintColor: AMBER_COLOR,
      }),
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={t.icon} size={size} color={color} />
      ),
    }}
  />
));

function TopNav() {
  const segments = useSegments();
  const router = useRouter();
  const activeTab = segments[1] as string | undefined;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#ffffff",
        borderBottomWidth: 1,
        borderBottomColor: "#e7e5e4",
        paddingTop: Platform.OS === "ios" ? 50 : 0,
      }}
    >
      {TABS.map((t) => {
        const isActive = activeTab === t.name;
        const color = t.amber ? AMBER_COLOR : isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
        return (
          <Pressable
            key={t.name}
            onPress={() => router.navigate(`/(tabs)/${t.name}`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Ionicons name={t.icon} size={20} color={color} />
            <Text style={{ fontSize: 13, fontWeight: "500", color }}>{t.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SidebarNav() {
  const segments = useSegments();
  const router = useRouter();
  const activeTab = segments[1] as string | undefined;

  return (
    <View
      style={{
        width: 200,
        backgroundColor: "#ffffff",
        borderRightWidth: 1,
        borderRightColor: "#e7e5e4",
        paddingTop: 24,
      }}
    >
      {TABS.map((t) => {
        const isActive = activeTab === t.name;
        const color = t.amber ? AMBER_COLOR : isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
        return (
          <Pressable
            key={t.name}
            onPress={() => router.navigate(`/(tabs)/${t.name}`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: isActive ? "#f5f5f4" : "transparent",
            }}
          >
            <Ionicons name={t.icon} size={22} color={color} />
            <Text style={{ fontSize: 14, fontWeight: "500", color }}>{t.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { width, height } = useWindowDimensions();
  const layoutMode =
    width > height && width >= PHONE_MAX ? "left"
    : width >= PHONE_MAX                 ? "top"
    :                                      "bottom";

  if (layoutMode === "left") {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <SidebarNav />
        <View style={{ flex: 1 }}>
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
            {TAB_SCREENS}
          </Tabs>
        </View>
      </View>
    );
  }

  if (layoutMode === "top") {
    return (
      <View style={{ flex: 1 }}>
        <TopNav />
        <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
          {TAB_SCREENS}
        </Tabs>
      </View>
    );
  }

  // bottom (phone)
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
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
      {TAB_SCREENS}
    </Tabs>
  );
}
