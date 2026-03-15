import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { sharedStyles } from "./importStyles";

type ImportTextModeProps = {
  textInput: string;
  setTextInput: (text: string) => void;
  importing: boolean;
  handleTextImport: () => void;
};

export function ImportTextMode({
  textInput,
  setTextInput,
  importing,
  handleTextImport,
}: ImportTextModeProps) {
  return (
    <View style={styles.textMode}>
      <Text style={sharedStyles.heading}>Import from text</Text>
      <Text style={sharedStyles.subheading}>
        Paste the recipe text below and we'll extract it for you.
      </Text>
      <TextInput
        style={[sharedStyles.input, styles.textModeInput]}
        value={textInput}
        onChangeText={setTextInput}
        placeholder="Paste recipe text here…"
        placeholderTextColor="#a8a29e"
        multiline
        textAlignVertical="top"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[sharedStyles.importButton, (!textInput.trim() || importing) && sharedStyles.fetchButtonDisabled]}
        onPress={handleTextImport}
        disabled={!textInput.trim() || importing}
      >
        {importing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={sharedStyles.fetchButtonText}>Import</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  textMode: { gap: 16 },
  textModeInput: { height: 200, paddingTop: 10 },
});
