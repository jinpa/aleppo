import { View, Text, StyleSheet } from "react-native";

type Props = {
  tags: string[];
  max?: number;
};

export function TagRow({ tags, max = 3 }: Props) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.slice(0, max).map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
      {tags.length > max && (
        <Text style={styles.overflow}>+{tags.length - max}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tag: {
    backgroundColor: "#f5f5f4",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, color: "#57534e", fontWeight: "500" },
  overflow: { fontSize: 10, color: "#a8a29e", alignSelf: "center" },
});
