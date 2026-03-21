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
import { NavShell } from "@/components/NavShell";
import type { UserSettings } from "@aleppo/shared";

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
  const [translateAI, setTranslateAI] = useState(true);
  const [notifyOnNewFollower, setNotifyOnNewFollower] = useState(true);

  // Export state
  const [exportIncludeCookLogs, setExportIncludeCookLogs] = useState(true);
  const [exportIncludeImages, setExportIncludeImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState<{ recipeCount: number; fileSize: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportDone(null);
    try {
      const params = new URLSearchParams({
        includeCookLogs: String(exportIncludeCookLogs),
        includeImages: String(exportIncludeImages),
      });
      const res = await fetch(`${API_URL}/api/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const text = await blob.text();
      const data = JSON.parse(text);
      const recipeCount = data.recipes?.length ?? 0;
      const sizeBytes = new Blob([text]).size;
      const fileSize = sizeBytes > 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(sizeBytes / 1024)} KB`;

      const today = new Date().toISOString().slice(0, 10);
      const filename = `aleppo-export-${today}.aleppo.json`;

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Native: dynamically import expo modules
        const [FileSystemModule, SharingModule] = await Promise.all([
          import("expo-file-system/legacy"),
          import("expo-sharing"),
        ]);
        const FS = FileSystemModule.default ?? FileSystemModule;
        const Share = SharingModule.default ?? SharingModule;
        const path = `${FS.cacheDirectory}${filename}`;
        await FS.writeAsStringAsync(path, text, { encoding: FS.EncodingType.UTF8 });
        await Share.shareAsync(path, { mimeType: "application/json", UTI: "public.json" });
      }

      setExportDone({ recipeCount, fileSize });
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const fetchSettings = useCallback(async () => {
    if (!token) return;
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
      setTranslateAI(data.translateAI ?? true);
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
          translateAI,
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
      <NavShell>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </NavShell>
    );
  }

  return (
    <NavShell>
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
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="language-outline" size={20} color="#57534e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Translate AI imports</Text>
                <Text style={styles.toggleSub}>
                  Always translate recipe details to your language
                </Text>
              </View>
            </View>
            <Switch
              value={translateAI}
              onValueChange={setTranslateAI}
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

        {/* Data section — export */}
        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="document-text-outline" size={20} color="#57534e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Include cook logs</Text>
                <Text style={styles.toggleSub}>Export your cooking history</Text>
              </View>
            </View>
            <Switch
              value={exportIncludeCookLogs}
              onValueChange={setExportIncludeCookLogs}
              trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="images-outline" size={20} color="#57534e" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Include images</Text>
                <Text style={styles.toggleSub}>
                  Embeds photos for full portability (larger file)
                </Text>
              </View>
            </View>
            <Switch
              value={exportIncludeImages}
              onValueChange={setExportIncludeImages}
              trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={{ padding: 14, gap: 8 }}>
            {exportError ? (
              <Text style={{ fontSize: 13, color: "#b91c1c" }}>{exportError}</Text>
            ) : null}
            {exportDone ? (
              <Text style={{ fontSize: 13, color: "#16a34a" }}>
                Exported {exportDone.recipeCount} recipes ({exportDone.fileSize})
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.exportButton, exporting && { opacity: 0.6 }]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#1c1917" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color="#1c1917" />
                  <Text style={styles.exportButtonText}>Download backup</Text>
                </>
              )}
            </TouchableOpacity>
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
    </NavShell>
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
  exportButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#f5f5f4", borderRadius: 8,
    paddingVertical: 10, borderWidth: 1, borderColor: "#e7e5e4",
  },
  exportButtonText: { fontSize: 14, fontWeight: "600", color: "#1c1917" },
});
