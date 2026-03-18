import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import { scaleIngredient } from "@/lib/scale-ingredient";
import ImageViewerModal from "@/components/ImageViewerModal";
import { NavShell } from "@/components/NavShell";
import { AI_MODIFY_PRESETS } from "@/constants/ai-presets";
import { setPendingModification } from "@/stores/ai-modify";
import type { RecipeDetailResponse, CookLog } from "@aleppo/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Scale Controls ───────────────────────────────────────────────────────────

const SCALE_PRESETS = [
  { label: "½×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "3×", value: 3 },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { token, user, signOut } = useAuth();

  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/recipes");
    }
  };

  const [detail, setDetail] = useState<RecipeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scaleFactor, setScaleFactor] = useState(1);
  const [customScale, setCustomScale] = useState("1");

  const [inQueue, setInQueue] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);

  const [cookLogs, setCookLogs] = useState<CookLog[]>([]);
  const [cookCount, setCookCount] = useState(0);

  const [isPublic, setIsPublic] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState(todayString());
  const [logNotes, setLogNotes] = useState("");
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [modifyLoading, setModifyLoading] = useState(false);
  const [modifyError, setModifyError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return; // wait for auth to load
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/recipes/${id}/detail`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 && token) {
          await signOut();
          return;
        }
        if (!res.ok) throw new Error("Failed to load recipe");
        const data: RecipeDetailResponse = await res.json();
        console.log("[recipe detail]", JSON.stringify(data, null, 2));
        setDetail(data);
        setInQueue(data.inQueue);
        setIsPublic(data.recipe.isPublic);
        setCookLogs(data.cookLogs);
        setCookCount(data.cookCount);
      } catch {
        setError("Could not load recipe");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, token, signOut]
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetail({ silent: true });
  };

  const toggleQueue = async () => {
    if (!detail || queueLoading) return;
    setQueueLoading(true);
    const wasInQueue = inQueue;
    setInQueue(!wasInQueue);
    try {
      const res = await fetch(`${API_URL}/api/queue`, {
        method: wasInQueue ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipeId: detail.recipe.id }),
      });
      if (!res.ok) setInQueue(wasInQueue);
    } catch {
      setInQueue(wasInQueue);
    } finally {
      setQueueLoading(false);
    }
  };

  const submitLog = async () => {
    if (!detail) return;
    setLogError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      setLogError("Date must be in YYYY-MM-DD format");
      return;
    }
    setLogSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/cook-logs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipeId: detail.recipe.id,
          cookedOn: logDate,
          notes: logNotes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to log cook");
      const newLog: CookLog = await res.json();
      setCookLogs((prev) => [newLog, ...prev]);
      setCookCount((c) => c + 1);
      setShowLogModal(false);
      setLogDate(todayString());
      setLogNotes("");
    } catch {
      setLogError("Failed to log cook. Please try again.");
    } finally {
      setLogSubmitting(false);
    }
  };

  const submitModify = async () => {
    if (!detail || !modifyPrompt.trim()) return;
    setModifyError(null);
    setModifyLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/recipes/${id}/modify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: modifyPrompt.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to modify recipe");
      }
      const data = await res.json();
      setPendingModification({
        original: detail.recipe,
        modified: data.recipe,
        isOwner,
      });
      setShowModifyModal(false);
      setModifyPrompt("");
      router.push(`/recipes/${id}/modify`);
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : "Failed to modify recipe. Please try again.");
    } finally {
      setModifyLoading(false);
    }
  };

  const deleteLog = async (logId: string) => {
    const prev = cookLogs;
    setCookLogs((logs) => logs.filter((l) => l.id !== logId));
    setCookCount((c) => Math.max(0, c - 1));
    try {
      const res = await fetch(`${API_URL}/api/cook-logs/${logId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
    } catch {
      setCookLogs(prev);
      setCookCount((c) => c + 1);
    }
  };

  const toggleVisibility = async () => {
    if (!detail || visibilityLoading) return;
    setVisibilityLoading(true);
    const prev = isPublic;
    setIsPublic(!prev);
    try {
      const res = await fetch(`${API_URL}/api/recipes/${detail.recipe.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublic: !prev }),
      });
      if (!res.ok) setIsPublic(prev);
    } catch {
      setIsPublic(prev);
    } finally {
      setVisibilityLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!detail) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/recipes/${detail.recipe.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowDeleteConfirm(false);
        router.replace("/(tabs)/recipes");
      }
    } catch {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const applyScale = (value: number) => {
    setScaleFactor(value);
    setCustomScale(value === 0.5 ? "0.5" : value.toString());
  };

  const onCustomScaleChange = (text: string) => {
    setCustomScale(text);
    const n = parseFloat(text);
    if (!isNaN(n) && n > 0) setScaleFactor(n);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <NavShell>
        <View style={[styles.centered, { flex: 1, backgroundColor: "#fafaf9" }]}>
          <ActivityIndicator size="large" color="#1c1917" />
        </View>
      </NavShell>
    );
  }

  if (error || !detail) {
    return (
      <NavShell>
        <View style={[styles.centered, { flex: 1, backgroundColor: "#fafaf9" }]}>
          <Text style={styles.errorText}>{error ?? "Recipe not found"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchDetail()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryButton, { marginTop: 8 }]} onPress={goBack}>
            <Text style={styles.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </NavShell>
    );
  }

  const { recipe, isOwner } = detail;
  const totalMins = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const scaledServings = recipe.servings
    ? Math.round(recipe.servings * scaleFactor * 10) / 10
    : null;

  const listHeader = (
    <View>
      {/* Back button + profile avatar */}
      <View style={styles.backRow}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#1c1917" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.navigate("/profile")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          {user?.image ? (
            <Image source={{ uri: user.image }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Ionicons name="person-outline" size={20} color="#1c1917" />
          )}
        </TouchableOpacity>
      </View>

      {/* Hero image */}
      {(() => {
        const images = recipe.images ?? [];
        const heroUrl = images.find((i) => i.role === "banner" || i.role === "both")?.url ?? images[0]?.url ?? recipe.imageUrl;
        return heroUrl ? (
          <>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerImageUrl(heroUrl)}>
              <Image source={{ uri: heroUrl }} style={styles.heroImage} contentFit="cover" transition={300} />
            </TouchableOpacity>
            {images.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryStrip} contentContainerStyle={styles.galleryStripContent}>
                {images.map((img) => (
                  <TouchableOpacity key={img.url} onPress={() => setViewerImageUrl(img.url)} activeOpacity={0.8}>
                    <Image source={{ uri: img.url }} style={styles.galleryThumb} contentFit="cover" transition={200} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : null;
      })()}

      <View style={styles.content}>
        {/* Title + owner actions */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.title}</Text>
          {isOwner ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push(`/recipes/${id}/edit`)}
                testID="recipe-edit-btn"
              >
                <Ionicons name="pencil-outline" size={18} color="#78716c" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowDeleteConfirm(true)}
                testID="recipe-delete-btn"
              >
                <Ionicons name="trash-outline" size={18} color="#b91c1c" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Meta chips */}
        <View style={styles.metaRow}>
          {totalMins > 0 ? (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={13} color="#78716c" />
              <Text style={styles.metaChipText}>{formatTime(totalMins)}</Text>
            </View>
          ) : null}

          {scaledServings ? (
            <View style={[styles.metaChip, scaleFactor !== 1 && styles.metaChipAmber]}>
              <Ionicons name="people-outline" size={13} color={scaleFactor !== 1 ? "#92400e" : "#78716c"} />
              <Text style={[styles.metaChipText, scaleFactor !== 1 && styles.metaChipTextAmber]}>
                {scaledServings} servings
              </Text>
            </View>
          ) : null}

          {cookCount > 0 ? (
            <View style={[styles.metaChip, styles.metaChipAmber]}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#92400e" />
              <Text style={[styles.metaChipText, styles.metaChipTextAmber]}>Made {cookCount}×</Text>
            </View>
          ) : null}

          {isOwner ? (
            <TouchableOpacity style={styles.metaChip} onPress={toggleVisibility} disabled={visibilityLoading}>
              <Ionicons name={isPublic ? "globe-outline" : "lock-closed-outline"} size={13} color="#78716c" />
              <Text style={styles.metaChipText}>{isPublic ? "Public" : "Private"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Source attribution */}
        {recipe.sourceUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(recipe.sourceUrl!)} style={styles.sourceLink}>
            <Ionicons name="link-outline" size={13} color="#78716c" />
            <Text style={styles.sourceLinkText} numberOfLines={1}>
              {recipe.isAdapted ? "adapted from " : "from "}{recipe.sourceName ?? "Source"}
            </Text>
            <Ionicons name="open-outline" size={12} color="#a8a29e" />
          </TouchableOpacity>
        ) : recipe.sourceName ? (
          <View style={styles.sourceLink}>
            <Ionicons name="person-outline" size={13} color="#78716c" />
            <Text style={styles.sourceLinkText} numberOfLines={1}>
              {recipe.isAdapted ? "adapted from " : "from "}{recipe.sourceName}
            </Text>
          </View>
        ) : null}

        {/* Tags */}
        {recipe.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, inQueue && styles.actionButtonActive]}
            onPress={toggleQueue}
            disabled={queueLoading}
          >
            <Ionicons name={inQueue ? "bookmark" : "bookmark-outline"} size={16} color={inQueue ? "#fff" : "#1c1917"} />
            <Text style={[styles.actionButtonText, inQueue && styles.actionButtonTextActive]}>
              {inQueue ? "In queue" : "Want to cook"}
            </Text>
          </TouchableOpacity>

          {isOwner ? (
            <TouchableOpacity
              style={styles.actionButtonFilled}
              onPress={() => {
                setLogDate(todayString());
                setLogNotes("");
                setLogError(null);
                setShowLogModal(true);
              }}
            >
              <Ionicons name="restaurant-outline" size={16} color="#fff" />
              <Text style={styles.actionButtonFilledText}>Log a cook</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/recipes/${id}/save`)}
            >
              <Ionicons name="copy-outline" size={16} color="#1c1917" />
              <Text style={styles.actionButtonText}>Save to mine</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setModifyPrompt("");
              setModifyError(null);
              setShowModifyModal(true);
            }}
          >
            <Ionicons name="sparkles-outline" size={16} color="#1c1917" />
            <Text style={styles.actionButtonText}>Modify with AI</Text>
          </TouchableOpacity>
        </View>

        {/* Description */}
        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        {/* Ingredient scaling */}
        {recipe.ingredients.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.scaleControls}>
                {SCALE_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.scalePreset, scaleFactor === p.value && styles.scalePresetActive]}
                    onPress={() => applyScale(p.value)}
                  >
                    <Text style={[styles.scalePresetText, scaleFactor === p.value && styles.scalePresetTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={styles.scaleInput}
                  value={customScale}
                  onChangeText={onCustomScaleChange}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  placeholder="×"
                  placeholderTextColor="#a8a29e"
                />
              </View>
            </View>

            {recipe.ingredients.map((ing, i) => {
              const scaled = scaleFactor !== 1 ? scaleIngredient(ing, scaleFactor) ?? ing.raw : ing.raw;
              return (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientBullet} />
                  <Text style={styles.ingredientText}>{scaled}</Text>
                </View>
              );
            })}
          </>
        ) : null}

        {/* Instructions */}
        {recipe.instructions.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>Instructions</Text>
            {recipe.instructions.map((step) => (
              <View key={step.step} style={styles.instructionRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>{step.step}</Text>
                </View>
                <Text style={styles.instructionText}>{step.text}</Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Notes */}
        {recipe.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{recipe.notes}</Text>
          </View>
        ) : null}

        {/* Cook history */}
        {isOwner || cookLogs.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Cook history</Text>
            </View>

            {cookLogs.length === 0 && isOwner ? (
              <View style={styles.emptyLogs}>
                <Ionicons name="restaurant-outline" size={24} color="#a8a29e" />
                <Text style={styles.emptyLogsText}>No cooks logged yet</Text>
              </View>
            ) : (
              cookLogs.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logCardBody}>
                    <Text style={styles.logDate}>{formatDate(log.cookedOn)}</Text>
                    {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                  </View>
                  {isOwner ? (
                    <TouchableOpacity onPress={() => deleteLog(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color="#a8a29e" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <NavShell>
        <FlatList
          style={styles.container}
          data={[]}
          renderItem={null}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1c1917" />
          }
        />
      </NavShell>

      {/* Image Viewer */}
      {viewerImageUrl ? (
        <ImageViewerModal
          uri={viewerImageUrl}
          visible={!!viewerImageUrl}
          onClose={() => setViewerImageUrl(null)}
        />
      ) : null}

      {/* Cook Log Modal */}
      <Modal visible={showLogModal} transparent animationType="slide" onRequestClose={() => setShowLogModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLogModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrapper}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log a cook</Text>

            <Text style={styles.modalLabel}>Date</Text>
            <TextInput
              style={styles.modalInput}
              value={logDate}
              onChangeText={setLogDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#a8a29e"
              autoCorrect={false}
            />

            <Text style={styles.modalLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={logNotes}
              onChangeText={setLogNotes}
              placeholder="How did it go?"
              placeholderTextColor="#a8a29e"
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{logNotes.length}/500</Text>

            {logError ? <Text style={styles.logErrorText}>{logError}</Text> : null}

            <TouchableOpacity
              style={[styles.modalSubmit, logSubmitting && styles.modalSubmitDisabled]}
              onPress={submitLog}
              disabled={logSubmitting}
            >
              {logSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSubmitText}>Log cook</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowLogModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <Pressable style={styles.centeredModalBackdrop} onPress={() => !deleteLoading && setShowDeleteConfirm(false)} />
        <View style={styles.centeredModalWrapper} pointerEvents="box-none">
          <View style={styles.centeredModalCard}>
            <Text style={styles.centeredModalTitle}>Delete recipe</Text>
            <Text style={styles.centeredModalBody}>
              Are you sure you want to delete this recipe? This cannot be undone.
            </Text>
            <View style={styles.centeredModalActions}>
              <TouchableOpacity
                style={styles.centeredModalCancel}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
              >
                <Text style={styles.centeredModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.centeredModalDestructive, deleteLoading && styles.modalSubmitDisabled]}
                onPress={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.centeredModalDestructiveText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Modify Modal */}
      <Modal visible={showModifyModal} transparent animationType="slide" onRequestClose={() => !modifyLoading && setShowModifyModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !modifyLoading && setShowModifyModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalWrapper}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Modify with AI</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetStrip} contentContainerStyle={styles.presetStripContent}>
              {AI_MODIFY_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.presetChip, modifyPrompt === preset.prompt && styles.presetChipActive]}
                  onPress={() => setModifyPrompt(preset.prompt)}
                  disabled={modifyLoading}
                >
                  <Text style={[styles.presetChipText, modifyPrompt === preset.prompt && styles.presetChipTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={modifyPrompt}
              onChangeText={setModifyPrompt}
              placeholder="Or describe how to modify this recipe..."
              placeholderTextColor="#a8a29e"
              multiline
              maxLength={500}
              textAlignVertical="top"
              editable={!modifyLoading}
            />

            {modifyError ? <Text style={styles.logErrorText}>{modifyError}</Text> : null}

            <TouchableOpacity
              style={[styles.modalSubmit, (!modifyPrompt.trim() || modifyLoading) && styles.modalSubmitDisabled]}
              onPress={submitModify}
              disabled={!modifyPrompt.trim() || modifyLoading}
            >
              {modifyLoading ? (
                <View style={styles.modifyLoadingRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.modalSubmitText}>Modifying recipe...</Text>
                </View>
              ) : (
                <Text style={styles.modalSubmitText}>Modify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => !modifyLoading && setShowModifyModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  listContent: { paddingBottom: Platform.OS === "ios" ? 32 : 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  errorText: { fontSize: 15, color: "#b91c1c", textAlign: "center" },
  retryButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#d6d3d1" },
  retryText: { fontSize: 14, color: "#57534e" },
  backRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 24, paddingHorizontal: 16, paddingBottom: 8,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e5e4",
    justifyContent: "center", alignItems: "center",
  },
  heroImage: { width: "100%", height: 240 },
  galleryStrip: { marginTop: 8 },
  galleryStripContent: { paddingHorizontal: 16, gap: 8 },
  galleryThumb: { width: 60, height: 60, borderRadius: 8 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  titleRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", gap: 12, marginBottom: 12,
  },
  title: { flex: 1, fontSize: 26, fontWeight: "700", color: "#1c1917", lineHeight: 32 },
  ownerActions: { flexDirection: "row", gap: 4, paddingTop: 4 },
  iconButton: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f5f5f4", borderWidth: 1, borderColor: "#e7e5e4",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  metaChipAmber: { backgroundColor: "#fef3c7", borderColor: "#fde68a" },
  metaChipText: { fontSize: 13, color: "#78716c", fontWeight: "500" },
  metaChipTextAmber: { color: "#92400e" },
  sourceLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  sourceLinkText: { fontSize: 13, color: "#78716c", textDecorationLine: "underline", flex: 1 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  tag: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: "#f5f5f4", borderWidth: 1, borderColor: "#e7e5e4",
  },
  tagText: { fontSize: 13, color: "#57534e", fontWeight: "500" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  actionButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff",
  },
  actionButtonActive: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  actionButtonText: { fontSize: 14, fontWeight: "500", color: "#1c1917" },
  actionButtonTextActive: { color: "#fff" },
  actionButtonFilled: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: "#1c1917",
  },
  actionButtonFilledText: { fontSize: 14, fontWeight: "500", color: "#fff" },
  description: { fontSize: 15, color: "#44403c", lineHeight: 22, marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1c1917" },
  scaleControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  scalePreset: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff",
  },
  scalePresetActive: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  scalePresetText: { fontSize: 12, fontWeight: "500", color: "#57534e" },
  scalePresetTextActive: { color: "#fff" },
  scaleInput: {
    width: 40, paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: "#e7e5e4",
    backgroundColor: "#fff", fontSize: 12, color: "#1c1917", textAlign: "center",
  },
  ingredientRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#f5f5f4",
  },
  ingredientBullet: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: "#d97706",
    marginTop: 8, flexShrink: 0,
  },
  ingredientText: { flex: 1, fontSize: 15, color: "#1c1917", lineHeight: 22 },
  instructionRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#1c1917",
    justifyContent: "center", alignItems: "center", flexShrink: 0, marginTop: 1,
  },
  stepNumber: { fontSize: 13, fontWeight: "700", color: "#fff" },
  instructionText: { flex: 1, fontSize: 15, color: "#1c1917", lineHeight: 22 },
  notesBox: { backgroundColor: "#fef3c7", borderRadius: 10, padding: 14, marginTop: 20, marginBottom: 4 },
  notesLabel: {
    fontSize: 12, fontWeight: "700", color: "#92400e",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  },
  notesText: { fontSize: 14, color: "#78350f", lineHeight: 20 },
  emptyLogs: {
    borderWidth: 1, borderColor: "#e7e5e4", borderStyle: "dashed",
    borderRadius: 10, paddingVertical: 24, alignItems: "center", gap: 8, marginTop: 8,
  },
  emptyLogsText: { fontSize: 14, color: "#a8a29e" },
  logCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 10, padding: 12, marginBottom: 8,
  },
  logCardBody: { flex: 1, gap: 3 },
  logDate: { fontSize: 14, fontWeight: "600", color: "#1c1917" },
  logNotes: { fontSize: 13, color: "#78716c", lineHeight: 18 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalWrapper: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#d6d3d1",
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1c1917", marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: "600", color: "#57534e", marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: "#1c1917",
    backgroundColor: "#fafaf9", marginBottom: 14,
  },
  modalTextarea: { height: 90, marginBottom: 4 },
  charCount: { fontSize: 11, color: "#a8a29e", textAlign: "right", marginBottom: 12 },
  logErrorText: { fontSize: 13, color: "#b91c1c", marginBottom: 10 },
  modalSubmit: {
    backgroundColor: "#1c1917", borderRadius: 10,
    paddingVertical: 13, alignItems: "center", marginBottom: 10,
  },
  modalSubmitDisabled: { opacity: 0.6 },
  modalSubmitText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  modalCancel: { paddingVertical: 10, alignItems: "center" },
  modalCancelText: { fontSize: 15, color: "#78716c" },
  centeredModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  centeredModalWrapper: {
    ...StyleSheet.absoluteFillObject, justifyContent: "center",
    alignItems: "center", paddingHorizontal: 32,
  },
  centeredModalCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "100%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  centeredModalTitle: { fontSize: 17, fontWeight: "700", color: "#1c1917", marginBottom: 8 },
  centeredModalBody: { fontSize: 14, color: "#57534e", lineHeight: 20, marginBottom: 20 },
  centeredModalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  centeredModalCancel: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: "#e7e5e4",
  },
  centeredModalCancelText: { fontSize: 14, fontWeight: "500", color: "#57534e" },
  centeredModalDestructive: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#b91c1c", minWidth: 70, alignItems: "center",
  },
  centeredModalDestructiveText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  presetStrip: { marginBottom: 12 },
  presetStripContent: { gap: 8 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff",
  },
  presetChipActive: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  presetChipText: { fontSize: 14, fontWeight: "500", color: "#57534e" },
  presetChipTextActive: { color: "#fff" },
  modifyLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
});
