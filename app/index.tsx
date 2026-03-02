import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { isConfigured, sendEmail } from "../lib/send-email";

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConfigured()) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Setup Required</Text>
        <Text style={styles.setupText}>
          Add your Resend API key and email to .env:{"\n\n"}
          EXPO_PUBLIC_RESEND_API_KEY=re_...{"\n"}
          EXPO_PUBLIC_CAPTURE_EMAIL=you@gmail.com
        </Text>
      </View>
    );
  }

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendEmail(text.trim());
      setText("");
      setModalVisible(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.captureButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.captureButtonText}>Capture</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <TextInput
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#999"
              multiline
              autoFocus
              value={text}
              onChangeText={setText}
              editable={!sending}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.buttonRow}>
              <Pressable style={styles.cancelButton} onPress={handleCancel} disabled={sending}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },
  setupText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 22,
  },
  captureButton: {
    backgroundColor: "#000",
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 12,
  },
  captureButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 260,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    textAlignVertical: "top",
    minHeight: 120,
    marginBottom: 12,
  },
  errorText: {
    color: "#d00",
    fontSize: 14,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#333",
  },
  sendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#000",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
