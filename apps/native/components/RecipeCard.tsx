import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { Recipe } from "@aleppo/shared";

function totalTime(recipe: Recipe): string | null {
  const mins = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

type RecipeCardProps = {
  recipe: Recipe;
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
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={styles.cardImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Text style={styles.cardImagePlaceholderText}>🍳</Text>
        </View>
      )}
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
        </View>
        {recipe.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {recipe.tags.length > 3 ? (
              <Text style={styles.tagOverflow}>
                +{recipe.tags.length - 3}
              </Text>
            ) : null}
          </View>
        ) : null}
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
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  tag: {
    backgroundColor: "#f5f5f4",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    color: "#57534e",
    fontWeight: "500",
  },
  tagOverflow: {
    fontSize: 10,
    color: "#a8a29e",
    alignSelf: "center",
  },
});
