import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import type { UserSettings } from "@aleppo/shared";

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { name: "Recipes", icon: "book-outline" as const, route: "/(tabs)/recipes", amber: false },
  { name: "Queue", icon: "time-outline" as const, route: "/(tabs)/queue", amber: false },
  { name: "Feed", icon: "people-outline" as const, route: "/(tabs)/feed", amber: false },
  { name: "New", icon: "add-circle-outline" as const, route: "/(tabs)/new", amber: true },
  { name: "Import", icon: "arrow-down-circle-outline" as const, route: "/(tabs)/import", amber: false },
] as const;

function TabBar() {
  const router = useRouter();
  return (
    <View style={tabStyles.bar}>
      {TAB_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.name}
          style={tabStyles.tab}
          onPress={() => router.navigate(item.route)}
          activeOpacity={0.7}
        >
          <Ionicons name={item.icon} size={24} color={item.amber ? "#d97706" : "#a8a29e"} />
          <Text style={[tabStyles.label, item.amber && tabStyles.labelAmber]}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: 11, fontWeight: "500", color: "#a8a29e" },
  labelAmber: { color: "#d97706" },
});

export default function SettingsScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [defaultTagsEnabled, setDefaultTagsEnabled] = useState(true);
  const [defaultRecipeIsPublic, setDefaultRecipeIsPublic] = useState(false);
  const [notifyOnNewFollower, setNotifyOnNewFollower] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data: UserSettings = await res.json();
      setSettings(data);
      setName(data.name ?? "");
      setBio(data.bio ?? "");
      setIsPublic(data.isPublic);
      setDefaultTagsEnabled(data.defaultTagsEnabled);
      setDefaultRecipeIsPublic(data.defaultRecipeIsPublic);
      setNotifyOnNewFollower(data.notifyOnNewFollower ?? true);
    } catch {
      setError("Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim() || null,
          isPublic,
          defaultTagsEnabled,
          defaultRecipeIsPublic,
          notifyOnNewFollower,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fafaf9" }}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
        <TabBar />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fafaf9" }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color="#1c1917" />
          </TouchableOpacity>
          <Text style={styles.heading}>Settings</Text>
          <TouchableOpacity
            style={[styles.saveButton, (saving || saved) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : saved ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveButtonText}>Saved</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Profile section */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.section}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#a8a29e"
              maxLength={100}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholder="A little about you (optional)"
              placeholderTextColor="#a8a29e"
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons
                name={isPublic ? "globe-outline" : "lock-closed-outline"}
                size={20}
                color="#57534e"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Public profile</Text>
                <Text style={styles.toggleSub}>
                  {isPublic
                    ? "Anyone can view your profile"
                    : "Only you can see your profile"}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Recipe defaults section */}
        <Text style={styles.sectionLabel}>Recipe Defaults</Text>
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="pricetag-outline" size={20} color="#57534e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Include imported tags</Text>
                <Text style={styles.toggleSub}>
                  Auto-apply tags when importing recipes
                </Text>
              </View>
            </View>
            <Switch
              value={defaultTagsEnabled}
              onValueChange={setDefaultTagsEnabled}
              trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="eye-outline" size={20} color="#57534e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>New recipes start as public</Text>
                <Text style={styles.toggleSub}>
                  Default visibility for new recipes
                </Text>
              </View>
            </View>
            <Switch
              value={defaultRecipeIsPublic}
              onValueChange={setDefaultRecipeIsPublic}
              trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Notifications section */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="notifications-outline" size={20} color="#57534e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>New follower alerts</Text>
                <Text style={styles.toggleSub}>
                  Get notified when someone follows you
                </Text>
              </View>
            </View>
            <Switch
              value={notifyOnNewFollower}
              onValueChange={setNotifyOnNewFollower}
              trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {settings?.email ? (
          <>
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.section}>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.staticValue}>{settings.email}</Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
    <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  content: { paddingBottom: 48 },
  centered: {
    flex: 1, backgroundColor: "#fafaf9",
    justifyContent: "center", alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e7e5e4",
    marginBottom: 16,
  },
  heading: { fontSize: 17, fontWeight: "600", color: "#1c1917" },
  saveButton: {
    backgroundColor: "#1c1917", borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 56, alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  errorBox: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: "#fef2f2", borderRadius: 8, padding: 12,
  },
  errorText: { fontSize: 13, color: "#b91c1c" },

  sectionLabel: {
    fontSize: 12, fontWeight: "600", color: "#78716c",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginHorizontal: 16, marginBottom: 8, marginTop: 16,
  },
  section: {
    marginHorizontal: 16, backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#e7e5e4",
    overflow: "hidden",
  },
  field: { padding: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#57534e", marginBottom: 6 },
  input: {
    backgroundColor: "#fafaf9", borderWidth: 1, borderColor: "#e7e5e4",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 15, color: "#1c1917",
  },
  textarea: { height: 80, textAlignVertical: "top", paddingTop: 10 },
  charCount: { fontSize: 11, color: "#a8a29e", textAlign: "right", marginTop: 4 },
  staticValue: { fontSize: 15, color: "#78716c" },
  divider: { height: 1, backgroundColor: "#f5f5f4", marginLeft: 14 },
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", padding: 14,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: "500", color: "#1c1917" },
  toggleSub: { fontSize: 12, color: "#78716c", marginTop: 2 },
});
