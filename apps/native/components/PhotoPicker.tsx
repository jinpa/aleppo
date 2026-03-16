import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";

const MAX_DIMENSION = 1500;

async function resizeIfNeeded(uri: string): Promise<string> {
  try {
    const imageRef = await ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = imageRef;
    if (Math.max(width, height) <= MAX_DIMENSION) return uri;
    const scale = MAX_DIMENSION / Math.max(width, height);
    const resizedRef = await ImageManipulator.manipulate(uri)
      .resize({ width: Math.round(width * scale) })
      .renderAsync();
    const result = await resizedRef.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    return result.uri;
  } catch {
    return uri;
  }
}

type PhotoPickerProps = {
  mode: "single" | "multiple";
  /**
   * Single mode: called once with [uri] as soon as the photo is picked.
   * Multiple mode: called after every add/remove with the current list.
   */
  onPhotos: (uris: string[]) => void;
  /**
   * Render prop.
   * - Single mode: children(open)
   * - Multiple mode: children(open, photos, removePhoto)
   *   — photos and removePhoto let the parent render thumbnails wherever it wants.
   */
  children: (
    open: () => void,
    photos: string[],
    removePhoto: (index: number) => void,
  ) => React.ReactNode;
};

export function PhotoPicker({ mode, onPhotos, children }: PhotoPickerProps) {
  const [visible, setVisible] = useState(false);
  const [accumulated, setAccumulated] = useState<string[]>([]);
  const [showSpinner, setShowSpinner] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAccumulated = (next: string[]) => {
    setAccumulated(next);
    onPhotos(next);
  };

  const process = async (uris: string[]) => {
    spinnerTimer.current = setTimeout(() => setShowSpinner(true), 1000);
    try {
      const resized = await Promise.all(uris.map(resizeIfNeeded));
      if (mode === "single") {
        onPhotos(resized);
      } else {
        updateAccumulated([...accumulated, ...resized]);
      }
    } finally {
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
      setShowSpinner(false);
    }
  };

  const removePhoto = (index: number) => {
    updateAccumulated(accumulated.filter((_, i) => i !== index));
  };

  // On iOS the modal slide animation must fully complete before a native picker
  // can be presented. Store the action and fire it in onDismiss.
  // On Android onDismiss doesn't exist, but there's no timing issue there.
  const dismissThen = (action: () => void) => {
    pendingAction.current = action;
    setVisible(false);
    if (Platform.OS !== "ios") {
      action();
      pendingAction.current = null;
    }
  };

  const fromCamera = () => dismissThen(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!result.canceled) {
      await process([result.assets[0].uri]);
    }
  });

  const fromLibrary = () => dismissThen(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: mode === "multiple",
      quality: 1,
    });
    if (!result.canceled) {
      await process(result.assets.map((a: ImagePicker.ImagePickerAsset) => a.uri));
    }
  });

  const fromFiles = async () => {
    setVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      multiple: mode === "multiple",
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      await process(result.assets.map((a: DocumentPicker.DocumentPickerAsset) => a.uri));
    }
  };

  // On web: camera and library are both just file pickers, so go directly to Browse Files.
  // On mobile: camera + photo library only (no file browser).
  const showCamera = Platform.OS !== "web";
  const showLibrary = Platform.OS !== "web";
  const showFiles = Platform.OS === "web";

  const open = () => {
    if (showFiles && !showCamera && !showLibrary) {
      fromFiles();
    } else {
      setVisible(true);
    }
  };

  return (
    <>
      {children(open, accumulated, removePhoto)}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        onDismiss={() => {
          pendingAction.current?.();
          pendingAction.current = null;
        }}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {mode === "multiple" && accumulated.length > 0 ? "Add more" : mode === "multiple" ? "Add photos" : "Add photo"}
          </Text>

          {showCamera && (
            <TouchableOpacity style={styles.option} onPress={fromCamera}>
              <View style={styles.optionIcon}>
                <Ionicons name="camera-outline" size={22} color="#1c1917" />
              </View>
              <Text style={styles.optionText}>Take a photo</Text>
            </TouchableOpacity>
          )}

          {showLibrary && (
            <TouchableOpacity style={styles.option} onPress={fromLibrary}>
              <View style={styles.optionIcon}>
                <Ionicons name="images-outline" size={22} color="#1c1917" />
              </View>
              <Text style={styles.optionText}>Photo library</Text>
            </TouchableOpacity>
          )}

          {showFiles && (
            <TouchableOpacity style={styles.option} onPress={fromFiles}>
              <View style={styles.optionIcon}>
                <Ionicons name="folder-outline" size={22} color="#1c1917" />
              </View>
              <Text style={styles.optionText}>Browse files</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={() => setVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showSpinner} transparent animationType="none">
        <View style={styles.spinnerBackdrop}>
          <View style={styles.spinnerCard}>
            <ActivityIndicator size="large" color="#1c1917" />
            <Text style={styles.spinnerText}>Processing…</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d6d3d1",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78716c",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e7e5e4",
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontSize: 16,
    color: "#1c1917",
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    color: "#78716c",
  },
  spinnerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 36,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  spinnerText: {
    fontSize: 15,
    color: "#57534e",
  },
});
