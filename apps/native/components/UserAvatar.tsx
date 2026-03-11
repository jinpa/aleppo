import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { getInitials } from "@/utils/format";

type Props = {
  name?: string | null;
  image?: string | null;
  size?: number;
};

export function UserAvatar({ name, image, size = 36 }: Props) {
  const initials = getInitials(name);

  if (image) {
    return (
      <Image
        source={{ uri: image }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#e7e5e4",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {initials ? (
        <Text style={{ fontSize: size * 0.35, fontWeight: "600", color: "#57534e" }}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color="#a8a29e" />
      )}
    </View>
  );
}
