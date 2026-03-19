import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { Recipe } from "@aleppo/shared";

type RecipeWithCookStats = Recipe & {
  cookCount?: number;
  lastCookedOn?: string | null;
};

function totalTime(recipe: Recipe): string | null {
  const mins = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatLastCooked(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

type RecipeCardProps = {
  recipe: RecipeWithCookStats;
  onPress: () => void;
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export function RecipeCard({
  recipe,
  onPress,
  editMode,
  selected,
  onToggleSelect,
}: RecipeCardProps) {
  const time = totalTime(recipe);

  return (
    <TouchableOpacity
      style={[styles.card, editMode && selected && styles.cardSelected]}
      onPress={editMode ? onToggleSelect : onPress}
      activeOpacity={0.7}
    >
      {editMode ? (
        <View style={styles.checkboxColumn}>
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={22}
            color={selected ? "#1c1917" : "#a8a29e"}
          />
        </View>
      ) : null}
      {(() => {
        const thumbUrl = recipe.images?.find((i) => i.role === "thumbnail" || i.role === "both")?.url
          ?? recipe.images?.[0]?.url ?? recipe.imageUrl;
        return thumbUrl ? (
        <Image
          source={{ uri: thumbUrl }}
          style={styles.cardImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Text style={styles.cardImagePlaceholderText}>🍳</Text>
        </View>
      );
      })()}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
        {recipe.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          {time ? <Text style={styles.cardMetaText}>{time}</Text> : null}
          {recipe.sourceName ? (
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {recipe.sourceName}
            </Text>
          ) : null}
          {recipe.cookCount ? (
            <Text style={styles.cardMetaText}>
              Made {recipe.cookCount}×
            </Text>
          ) : null}
          {recipe.lastCookedOn ? (
            <Text style={styles.cardMetaText}>
              {formatLastCooked(recipe.lastCookedOn)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    overflow: "hidden",
    flexDirection: "row",
  },
  cardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  checkboxColumn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  cardImage: {
    width: 90,
    height: 90,
  },
  cardImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
  },
  cardImagePlaceholderText: {
    fontSize: 28,
  },
  cardBody: {
    flex: 1,
    padding: 10,
    gap: 3,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1c1917",
    lineHeight: 20,
  },
  cardDescription: {
    fontSize: 12,
    color: "#78716c",
    lineHeight: 16,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: 11,
    color: "#a8a29e",
  },
});
