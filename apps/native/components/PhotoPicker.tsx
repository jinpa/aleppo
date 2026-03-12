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
  ScrollView,
  Image,
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
  onPhotos: (uris: string[]) => void;
  children: (open: () => void) => React.ReactNode;
};

export function PhotoPicker({ mode, onPhotos, children }: PhotoPickerProps) {
  const [visible, setVisible] = useState(false);
  const [accumulated, setAccumulated] = useState<string[]>([]);
  const pendingAction = useRef<(() => void) | null>(null);

  const process = async (uris: string[]) => {
    const resized = await Promise.all(uris.map(resizeIfNeeded));
    if (mode === "single") {
      onPhotos(resized);
    } else {
      setAccumulated((prev) => [...prev, ...resized]);
      setVisible(true); // reopen sheet to add more or confirm
    }
  };

  const handleDone = () => {
    onPhotos(accumulated);
    setAccumulated([]);
    setVisible(false);
  };

  const removePhoto = (index: number) => {
    setAccumulated((prev) => prev.filter((_, i) => i !== index));
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

  // On web: camera and library are both just file pickers, so go directly to Browse Files
  // On mobile: camera + photo library only (no file browser)
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
      {children(open)}
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

          {mode === "multiple" && accumulated.length > 0 && (
            <View style={styles.thumbnailSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
                {accumulated.map((uri, i) => (
                  <View key={i} style={styles.thumbnailWrapper}>
                    <Image source={{ uri }} style={styles.thumbnail} />
                    <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(i)}>
                      <Ionicons name="close-circle" size={18} color="#1c1917" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>
                  Done — {accumulated.length} {accumulated.length === 1 ? "photo" : "photos"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
  thumbnailSection: {
    marginBottom: 16,
    gap: 12,
  },
  thumbnailRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  thumbnailWrapper: {
    position: "relative",
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#f5f5f4",
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 9,
  },
  doneButton: {
    backgroundColor: "#1c1917",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
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
});
