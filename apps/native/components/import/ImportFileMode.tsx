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
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import { sharedStyles } from "./importStyles";
import { CookingSpinner } from "@/components/CookingSpinner";
import { TranslationToggle, getClientLanguage } from "./TranslationToggle";
import type { ImportOutcome } from "./types";
import type { ScrapedRecipe } from "@aleppo/shared";

type FileImportStep = "upload" | "preview" | "importing" | "done";
type FileImportItem = {
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

type ImportFileModeProps = {
  token: string | null;
  router: { replace: (path: any) => void };
  onComplete?: (outcome: ImportOutcome) => void;
  onBatchComplete?: (recipes: ScrapedRecipe[]) => void;
  onAttempt?: () => void;
  initialLanguage?: string;
};

const SUPPORTED_EXTENSIONS = [".paprikarecipes", ".melarecipes", ".aleppo.json", ".pdf"];

export function ImportFileMode({ token, router, onComplete, onBatchComplete, onAttempt, initialLanguage }: ImportFileModeProps) {
  const [fileStep, setFileStep] = useState<FileImportStep>("upload");
  const [fileImportFile, setFileImportFile] = useState<{ uri: string; name: string; file?: File } | null>(null);
  const [fileItems, setFileItems] = useState<FileImportItem[]>([]);
  const [fileSelected, setFileSelected] = useState<Set<string>>(new Set());
  const [filePublic, setFilePublic] = useState(false);
  const [fileParsing, setFileParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSaved, setFileSaved] = useState(0);
  const [fileFailed, setFileFailed] = useState(0);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | undefined>(initialLanguage);

  const handlePdfImport = async (asset: { uri: string; name: string; file?: File }) => {
    onAttempt?.();
    setFileParsing(true);
    setFileError(null);
    const currentToken = Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
    const fileForForm: any = asset.file ?? { uri: asset.uri, name: asset.name, type: "application/pdf" };
    try {
      const form = new FormData();
      form.append("file", fileForForm);
      if (language) form.append("language", language);
      const res = await fetch(`${API_URL}/api/import/pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setFileError(data.error ?? "PDF import failed.");
        return;
      }
      if (Array.isArray(data.recipes) && data.recipes.length > 1 && onBatchComplete) {
        onBatchComplete(data.recipes);
      } else if (Array.isArray(data.recipes) && data.recipes.length > 0 && onComplete) {
        onComplete({
          ok: true,
          recipe: data.recipes[0],
          aiGenerated: data.generated,
        });
      } else {
        setFileError("No recipes found in the PDF.");
      }
    } catch {
      setFileError("Could not connect to server.");
    } finally {
      setFileParsing(false);
    }
  };

  const pickImportFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === "ios" ? "public.data" : "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!SUPPORTED_EXTENSIONS.some((ext) => asset.name.toLowerCase().endsWith(ext))) {
      setFileError("Unsupported file. Please select a .paprikarecipes, .melarecipes, .aleppo.json, or .pdf file.");
      return;
    }
    // Route PDF files to the dedicated PDF import handler
    if (asset.name.toLowerCase().endsWith(".pdf")) {
      handlePdfImport({ uri: asset.uri, name: asset.name, file: asset.file });
      return;
    }
    setFileError(null);
    setFileParsing(true);
    setFileImportFile({ uri: asset.uri, name: asset.name, file: asset.file });
    const fileForForm: any = asset.file ?? { uri: asset.uri, name: asset.name, type: "application/octet-stream" };
    try {
      const form = new FormData();
      form.append("file", fileForForm);
      const res = await fetch(`${API_URL}/api/import/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setFileError(data.error ?? "Failed to parse file."); return; }
      setDetectedFormat(data.format ?? null);
      const items: FileImportItem[] = data.recipes;
      const initial = new Set(
        items.filter((r) => !r.isDuplicate || r.duplicateType === "title").map((r) => r.uid)
      );
      setFileItems(items);
      setFileSelected(initial);
      setFileStep("preview");
    } catch {
      setFileError("Could not connect to server.");
    } finally {
      setFileParsing(false);
    }
  };

  const startFileImport = async () => {
    if (!fileImportFile || fileSelected.size === 0) return;
    setFileStep("importing");
    try {
      const form = new FormData();
      const fileForForm: any = fileImportFile.file ?? { uri: fileImportFile.uri, name: fileImportFile.name, type: "application/octet-stream" };
      form.append("file", fileForForm);
      form.append("selectedUids", JSON.stringify([...fileSelected]));
      form.append("isPublic", String(filePublic));
      const res = await fetch(`${API_URL}/api/import/file/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setFileError(data.error ?? "Import failed."); setFileStep("preview"); return; }
      setFileSaved(data.saved);
      setFileFailed(data.failed ?? 0);
      setFileStep("done");
    } catch {
      setFileError("Something went wrong during import.");
      setFileStep("preview");
    }
  };

  const resetFileImport = () => {
    setFileStep("upload");
    setFileImportFile(null);
    setFileItems([]);
    setFileSelected(new Set());
    setFileError(null);
    setFileSaved(0);
    setFileFailed(0);
    setDetectedFormat(null);
  };

  return (
    <View style={styles.fileMode}>
      {fileStep === "upload" && (
        <>
          <Text style={sharedStyles.heading}>Import from file</Text>
          <Text style={sharedStyles.subheading}>
            Select a PDF recipe, or an export file from Paprika (.paprikarecipes), Mela (.melarecipes), or a previous Aleppo backup (.aleppo.json).
          </Text>
          {fileError ? (
            <View style={styles.fileError}>
              <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
              <Text style={styles.fileErrorText}>{fileError}</Text>
            </View>
          ) : null}
          <TranslationToggle language={language} onLanguageChange={setLanguage} token={token} />
          <TouchableOpacity
            style={[sharedStyles.importButton, fileParsing && sharedStyles.fetchButtonDisabled]}
            onPress={pickImportFile}
            disabled={fileParsing}
          >
            {fileParsing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={sharedStyles.fetchButtonText}>Choose file</Text>
            }
          </TouchableOpacity>
        </>
      )}

      {fileStep === "preview" && (
        <>
          <View style={styles.filePreviewHeader}>
            <View>
              <Text style={sharedStyles.heading}>{fileItems.length} recipes found</Text>
              {detectedFormat && (
                <Text style={sharedStyles.subheading}>
                  Format: {detectedFormat.charAt(0).toUpperCase() + detectedFormat.slice(1)}
                  {fileItems.filter((r) => r.isDuplicate).length > 0
                    ? ` · ${fileItems.filter((r) => r.isDuplicate).length} possible duplicate${fileItems.filter((r) => r.isDuplicate).length !== 1 ? "s" : ""}`
                    : ""}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={resetFileImport}>
              <Text style={styles.fileChangeFile}>Change file</Text>
            </TouchableOpacity>
          </View>

          {fileError ? (
            <View style={styles.fileError}>
              <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
              <Text style={styles.fileErrorText}>{fileError}</Text>
            </View>
          ) : null}

          <View style={styles.fileSelectRow}>
            <TouchableOpacity onPress={() => setFileSelected(new Set(fileItems.map((r) => r.uid)))}>
              <Text style={styles.fileSelectLink}>Select all</Text>
            </TouchableOpacity>
            <Text style={styles.fileDot}>·</Text>
            <TouchableOpacity onPress={() => setFileSelected(new Set())}>
              <Text style={styles.fileSelectLink}>Deselect all</Text>
            </TouchableOpacity>
            {fileItems.some((r) => r.isDuplicate) && (
              <>
                <Text style={styles.fileDot}>·</Text>
                <TouchableOpacity onPress={() => setFileSelected((prev) => { const next = new Set(prev); fileItems.filter((r) => r.isDuplicate).forEach((r) => next.delete(r.uid)); return next; })}>
                  <Text style={styles.fileSelectLink}>Deselect duplicates</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <ScrollView style={styles.fileList} scrollEnabled={false}>
            {fileItems.map((item) => (
              <TouchableOpacity
                key={item.uid}
                style={[styles.fileItem, fileSelected.has(item.uid) && styles.fileItemSelected]}
                onPress={() => setFileSelected((prev) => { const next = new Set(prev); next.has(item.uid) ? next.delete(item.uid) : next.add(item.uid); return next; })}
                activeOpacity={0.7}
              >
                <View style={[styles.fileCheckbox, fileSelected.has(item.uid) && styles.fileCheckboxChecked]}>
                  {fileSelected.has(item.uid) && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <View style={styles.fileItemBody}>
                  <Text style={styles.fileItemName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.fileItemMeta}>
                    {item.sourceName ? <Text style={styles.fileItemMetaText}>{item.sourceName} · </Text> : null}
                    <Text style={styles.fileItemMetaText}>{item.ingredientCount} ingredient{item.ingredientCount !== 1 ? "s" : ""}</Text>
                    {item.isDuplicate && (
                      <Text style={[styles.fileBadge, item.duplicateType === "url" ? styles.fileBadgeDupe : styles.fileBadgeMaybe]}>
                        {item.duplicateType === "url" ? " · Already saved" : " · Possible duplicate"}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.fileFooter}>
            <View style={styles.filePublicRow}>
              <Switch value={filePublic} onValueChange={setFilePublic} trackColor={{ true: "#1c1917" }} />
              <Text style={styles.filePublicLabel}>Make recipes public</Text>
            </View>
            <TouchableOpacity
              style={[sharedStyles.importButton, fileSelected.size === 0 && sharedStyles.fetchButtonDisabled]}
              onPress={startFileImport}
              disabled={fileSelected.size === 0}
            >
              <Text style={sharedStyles.fetchButtonText}>
                Import {fileSelected.size} recipe{fileSelected.size !== 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {fileStep === "importing" && (
        <CookingSpinner
          label="Importing recipes…"
          sublabel="This may take a minute for large libraries. Please don't close this page."
        />
      )}

      {fileStep === "done" && (
        <View style={styles.fileCentered}>
          <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
          <Text style={styles.fileDoneTitle}>Import complete</Text>
          <Text style={styles.fileDoneSubtext}>
            {fileSaved} recipe{fileSaved !== 1 ? "s" : ""} imported
            {fileFailed > 0 ? ` · ${fileFailed} failed` : ""}
          </Text>
          <TouchableOpacity style={[sharedStyles.importButton, styles.fileFullWidth]} onPress={() => router.replace("/(tabs)/recipes")}>
            <Text style={sharedStyles.fetchButtonText}>Go to my recipes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fileAnotherBtn} onPress={resetFileImport}>
            <Text style={styles.fileAnotherText}>Import another file</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fileMode: { gap: 16 },
  filePreviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  fileChangeFile: { fontSize: 13, color: "#78716c", textDecorationLine: "underline", marginTop: 4 },
  fileError: { flexDirection: "row", gap: 6, alignItems: "flex-start", backgroundColor: "#fef2f2", borderRadius: 8, padding: 10 },
  fileErrorText: { flex: 1, fontSize: 13, color: "#b91c1c" },
  fileSelectRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  fileSelectLink: { fontSize: 13, color: "#78716c", textDecorationLine: "underline" },
  fileDot: { fontSize: 13, color: "#d6d3d1" },
  fileList: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 10, overflow: "hidden" },
  fileItem: {
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
  fileItemSelected: { backgroundColor: "#fff", opacity: 1 },
  fileCheckbox: {
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
  fileCheckboxChecked: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  fileItemBody: { flex: 1 },
  fileItemName: { fontSize: 14, fontWeight: "500", color: "#1c1917" },
  fileItemMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  fileItemMetaText: { fontSize: 12, color: "#a8a29e" },
  fileBadge: { fontSize: 12, fontWeight: "500" },
  fileBadgeDupe: { color: "#b45309" },
  fileBadgeMaybe: { color: "#78716c" },
  fileFooter: { gap: 12, marginTop: 4 },
  filePublicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  filePublicLabel: { fontSize: 14, color: "#57534e" },
  fileCentered: { alignItems: "center", paddingVertical: 40, gap: 12 },
  fileImportingText: { fontSize: 17, fontWeight: "600", color: "#1c1917" },
  fileImportingSubtext: { fontSize: 13, color: "#78716c", textAlign: "center", paddingHorizontal: 16 },
  fileDoneTitle: { fontSize: 22, fontWeight: "700", color: "#1c1917" },
  fileDoneSubtext: { fontSize: 14, color: "#78716c" },
  fileFullWidth: { alignSelf: "stretch" },
  fileAnotherBtn: { marginTop: 4 },
  fileAnotherText: { fontSize: 14, color: "#78716c", textDecorationLine: "underline" },
});
