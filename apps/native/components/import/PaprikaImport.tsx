import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";

export type PaprikaStep = "upload" | "preview" | "importing" | "done";
export type PaprikaItem = {
  uid: string;
  name: string;
  sourceName?: string;
  ingredientCount: number;
  hasPhoto: boolean;
  isDuplicate?: boolean;
  duplicateType?: "url" | "title";
  duplicateRecipeId?: string;
  duplicateRecipeTitle?: string;
};

interface PaprikaImportProps {
  token: string | null;
  onImportSuccess: (recipe: ScrapedRecipe, fetchedUrl?: string, error?: string | null) => void;
}

export function PaprikaImport({ token }: PaprikaImportProps) {
  const router = useRouter();

  const [paprikaStep, setPaprikaStep] = useState<PaprikaStep>("upload");
  const [paprikaFile, setPaprikaFile] = useState<{ uri: string; name: string; file?: File } | null>(null);
  const [paprikaItems, setPaprikaItems] = useState<PaprikaItem[]>([]);
  const [paprikaSelected, setPaprikaSelected] = useState<Set<string>>(new Set());
  const [paprikaPublic, setPaprikaPublic] = useState(false);
  const [paprikaParsing, setPaprikaParsing] = useState(false);
  const [paprikaError, setPaprikaError] = useState<string | null>(null);
  const [paprikaSaved, setPaprikaSaved] = useState(0);
  const [paprikaFailed, setPaprikaFailed] = useState(0);

  const pickPaprikaFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === "ios" ? "public.data" : "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.name.endsWith(".paprikarecipes")) {
      setPaprikaError("Please select a .paprikarecipes file exported from Paprika.");
      return;
    }
    setPaprikaError(null);
    setPaprikaParsing(true);
    setPaprikaFile({ uri: asset.uri, name: asset.name, file: asset.file });
    const fileForForm: any = asset.file ?? { uri: asset.uri, name: asset.name, type: "application/octet-stream" };
    try {
      const form = new FormData();
      form.append("file", fileForForm);
      const res = await fetch(`${API_URL}/api/import/paprika`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setPaprikaError(data.error ?? "Failed to parse file."); return; }
      const items: PaprikaItem[] = data.recipes;
      const initial = new Set(
        items.filter((r) => !r.isDuplicate || r.duplicateType === "title").map((r) => r.uid)
      );
      setPaprikaItems(items);
      setPaprikaSelected(initial);
      setPaprikaStep("preview");
    } catch {
      setPaprikaError("Could not connect to server.");
    } finally {
      setPaprikaParsing(false);
    }
  };

  const startPaprikaImport = async () => {
    if (!paprikaFile || paprikaSelected.size === 0) return;
    setPaprikaStep("importing");
    try {
      const form = new FormData();
      const fileForForm: any = paprikaFile.file ?? { uri: paprikaFile.uri, name: paprikaFile.name, type: "application/octet-stream" };
      form.append("file", fileForForm);
      form.append("selectedUids", JSON.stringify([...paprikaSelected]));
      form.append("isPublic", String(paprikaPublic));
      const res = await fetch(`${API_URL}/api/import/paprika/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setPaprikaError(data.error ?? "Import failed."); setPaprikaStep("preview"); return; }
      setPaprikaSaved(data.saved);
      setPaprikaFailed(data.failed ?? 0);
      setPaprikaStep("done");
    } catch {
      setPaprikaError("Something went wrong during import.");
      setPaprikaStep("preview");
    }
  };

  const resetPaprika = () => {
    setPaprikaStep("upload");
    setPaprikaFile(null);
    setPaprikaItems([]);
    setPaprikaSelected(new Set());
    setPaprikaError(null);
    setPaprikaSaved(0);
    setPaprikaFailed(0);
  };

  return (
    <View style={styles.paprikaMode}>
      {paprikaStep === "upload" && (
        <>
          <Text style={styles.heading}>Import from Paprika</Text>
          <Text style={styles.subheading}>
            Export your library from Paprika (File → Export → All Recipes on Mac, or Settings → Export on iPhone), then select the .paprikarecipes file below.
          </Text>
          {paprikaError ? (
            <View style={styles.paprikaError}>
              <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
              <Text style={styles.paprikaErrorText}>{paprikaError}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.fetchButton, paprikaParsing && styles.fetchButtonDisabled]}
            onPress={pickPaprikaFile}
            disabled={paprikaParsing}
          >
            {paprikaParsing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.fetchButtonText}>Choose .paprikarecipes file</Text>
            }
          </TouchableOpacity>
        </>
      )}

      {paprikaStep === "preview" && (
        <>
          <View style={styles.paprikaPreviewHeader}>
            <View>
              <Text style={styles.heading}>{paprikaItems.length} recipes found</Text>
              {paprikaItems.filter((r) => r.isDuplicate).length > 0 && (
                <Text style={styles.subheading}>
                  {paprikaItems.filter((r) => r.isDuplicate).length} possible duplicate{paprikaItems.filter((r) => r.isDuplicate).length !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={resetPaprika}>
              <Text style={styles.paprikaChangeFile}>Change file</Text>
            </TouchableOpacity>
          </View>

          {paprikaError ? (
            <View style={styles.paprikaError}>
              <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
              <Text style={styles.paprikaErrorText}>{paprikaError}</Text>
            </View>
          ) : null}

          <View style={styles.paprikaSelectRow}>
            <TouchableOpacity onPress={() => setPaprikaSelected(new Set(paprikaItems.map((r) => r.uid)))}>
              <Text style={styles.paprikaSelectLink}>Select all</Text>
            </TouchableOpacity>
            <Text style={styles.paprikaDot}>·</Text>
            <TouchableOpacity onPress={() => setPaprikaSelected(new Set())}>
              <Text style={styles.paprikaSelectLink}>Deselect all</Text>
            </TouchableOpacity>
            {paprikaItems.some((r) => r.isDuplicate) && (
              <>
                <Text style={styles.paprikaDot}>·</Text>
                <TouchableOpacity onPress={() => setPaprikaSelected((prev) => { const next = new Set(prev); paprikaItems.filter((r) => r.isDuplicate).forEach((r) => next.delete(r.uid)); return next; })}>
                  <Text style={styles.paprikaSelectLink}>Deselect duplicates</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <ScrollView style={styles.paprikaList} scrollEnabled={false}>
            {paprikaItems.map((item) => (
              <TouchableOpacity
                key={item.uid}
                style={[styles.paprikaItem, paprikaSelected.has(item.uid) && styles.paprikaItemSelected]}
                onPress={() => setPaprikaSelected((prev) => { const next = new Set(prev); next.has(item.uid) ? next.delete(item.uid) : next.add(item.uid); return next; })}
                activeOpacity={0.7}
              >
                <View style={[styles.paprikaCheckbox, paprikaSelected.has(item.uid) && styles.paprikaCheckboxChecked]}>
                  {paprikaSelected.has(item.uid) && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <View style={styles.paprikaItemBody}>
                  <Text style={styles.paprikaItemName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.paprikaItemMeta}>
                    {item.sourceName ? <Text style={styles.paprikaItemMetaText}>{item.sourceName} · </Text> : null}
                    <Text style={styles.paprikaItemMetaText}>{item.ingredientCount} ingredient{item.ingredientCount !== 1 ? "s" : ""}</Text>
                    {item.isDuplicate && (
                      <Text style={[styles.paprikaBadge, item.duplicateType === "url" ? styles.paprikaBadgeDupe : styles.paprikaBadgeMaybe]}>
                        {item.duplicateType === "url" ? " · Already saved" : " · Possible duplicate"}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.paprikaFooter}>
            <View style={styles.paprikaPublicRow}>
              <Switch value={paprikaPublic} onValueChange={setPaprikaPublic} trackColor={{ true: "#1c1917" }} />
              <Text style={styles.paprikaPublicLabel}>Make recipes public</Text>
            </View>
            <TouchableOpacity
              style={[styles.fetchButton, paprikaSelected.size === 0 && styles.fetchButtonDisabled]}
              onPress={startPaprikaImport}
              disabled={paprikaSelected.size === 0}
            >
              <Text style={styles.fetchButtonText}>
                Import {paprikaSelected.size} recipe{paprikaSelected.size !== 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {paprikaStep === "importing" && (
        <View style={styles.paprikaCentered}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={styles.paprikaImportingText}>Importing recipes…</Text>
          <Text style={styles.paprikaImportingSubtext}>This may take a minute for large libraries. Please don't close this page.</Text>
        </View>
      )}

      {paprikaStep === "done" && (
        <View style={styles.paprikaCentered}>
          <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
          <Text style={styles.paprikaDoneTitle}>Import complete</Text>
          <Text style={styles.paprikaDoneSubtext}>
            {paprikaSaved} recipe{paprikaSaved !== 1 ? "s" : ""} imported
            {paprikaFailed > 0 ? ` · ${paprikaFailed} failed` : ""}
          </Text>
          <TouchableOpacity style={styles.fetchButton} onPress={() => router.replace("/(tabs)/recipes")}>
            <Text style={styles.fetchButtonText}>Go to my recipes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.paprikaAnotherBtn} onPress={resetPaprika}>
            <Text style={styles.paprikaAnotherText}>Import another file</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: "700", color: "#1c1917" },
  subheading: { fontSize: 14, color: "#78716c", lineHeight: 20 },
  fetchButton: {
    backgroundColor: "#1c1917",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  fetchButtonDisabled: { opacity: 0.5 },
  fetchButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Paprika
  paprikaMode: { gap: 16 },
  paprikaPreviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  paprikaChangeFile: { fontSize: 13, color: "#78716c", textDecorationLine: "underline", marginTop: 4 },
  paprikaError: { flexDirection: "row", gap: 6, alignItems: "flex-start", backgroundColor: "#fef2f2", borderRadius: 8, padding: 10 },
  paprikaErrorText: { flex: 1, fontSize: 13, color: "#b91c1c" },
  paprikaSelectRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paprikaSelectLink: { fontSize: 13, color: "#78716c", textDecorationLine: "underline" },
  paprikaDot: { fontSize: 13, color: "#d6d3d1" },
  paprikaList: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 10, overflow: "hidden" },
  paprikaItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e7e5e4",
    backgroundColor: "#fafaf9",
    opacity: 0.5,
  },
  paprikaItemSelected: { backgroundColor: "#fff", opacity: 1 },
  paprikaCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#d6d3d1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  paprikaCheckboxChecked: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  paprikaItemBody: { flex: 1 },
  paprikaItemName: { fontSize: 14, fontWeight: "500", color: "#1c1917" },
  paprikaItemMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  paprikaItemMetaText: { fontSize: 12, color: "#a8a29e" },
  paprikaBadge: { fontSize: 12, fontWeight: "500" },
  paprikaBadgeDupe: { color: "#b45309" },
  paprikaBadgeMaybe: { color: "#78716c" },
  paprikaFooter: { gap: 12, marginTop: 4 },
  paprikaPublicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  paprikaPublicLabel: { fontSize: 14, color: "#57534e" },
  paprikaCentered: { alignItems: "center", paddingVertical: 40, gap: 12 },
  paprikaImportingText: { fontSize: 17, fontWeight: "600", color: "#1c1917" },
  paprikaImportingSubtext: { fontSize: 13, color: "#78716c", textAlign: "center", paddingHorizontal: 16 },
  paprikaDoneTitle: { fontSize: 22, fontWeight: "700", color: "#1c1917" },
  paprikaDoneSubtext: { fontSize: 14, color: "#78716c" },
  paprikaAnotherBtn: { marginTop: 4 },
  paprikaAnotherText: { fontSize: 14, color: "#78716c", textDecorationLine: "underline" },
});
