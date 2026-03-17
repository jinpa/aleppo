import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Material Community Icons equivalents of the Flutter Material Symbols food set
const ICONS: React.ComponentProps<typeof MaterialCommunityIcons>["name"][] = [
  "silverware-fork-knife",
  "pizza",
  "egg-outline",
  "cake-variant",
  "cookie",
  "food-apple",
  "food-drumstick",
  "coffee",
  "carrot",
  "cheese",
  "fish",
  "bread-slice",
];

const ICON_COLOR = "#a8a29e";

// Ellipse radii — RY << RX gives the low-angle 3-D perspective look
const RX = 92;
const RY = 26;
const ICON_SIZE = 24;
const ORBIT_W = RX * 2 + ICON_SIZE * 2;
const ORBIT_H = RY * 2 + ICON_SIZE * 2 + 8;
const DURATION = 7000; // ms per revolution

type OrbitIconProps = {
  name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  index: number;
  total: number;
  rotation: SharedValue<number>;
};

function OrbitIcon({ name, index, total, rotation }: OrbitIconProps) {
  const phase = (index / total) * Math.PI * 2 + Math.PI / 2;

  const animatedStyle = useAnimatedStyle(() => {
    const angle = phase + rotation.value;
    const sinVal = Math.sin(angle); // -1 = back, +1 = front
    const t = (sinVal + 1) / 2;    //  0 = back,  1 = front

    return {
      transform: [
        { translateX: Math.cos(angle) * RX },
        { translateY: sinVal * RY },
        { scale: 0.45 + 0.55 * t },
      ],
      opacity: 0.2 + 0.8 * t,
    };
  });

  return (
    <Animated.View style={[styles.iconWrapper, animatedStyle]}>
      <MaterialCommunityIcons name={name} size={ICON_SIZE} color={ICON_COLOR} />
    </Animated.View>
  );
}

type CookingSpinnerProps = {
  label?: string;
  sublabel?: string;
};

export function CookingSpinner({ label, sublabel }: CookingSpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(Math.PI * 2, { duration: DURATION, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.orbit}>
        {ICONS.map((name, i) => (
          <OrbitIcon
            key={i}
            name={name}
            index={i}
            total={ICONS.length}
            rotation={rotation}
          />
        ))}
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  orbit: {
    width: ORBIT_W,
    height: ORBIT_H,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconWrapper: {
    position: "absolute",
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1c1917",
    textAlign: "center",
  },
  sublabel: {
    fontSize: 13,
    color: "#78716c",
    textAlign: "center",
    paddingHorizontal: 16,
  },
});
