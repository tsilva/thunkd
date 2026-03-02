import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { type EmailConfig, isConfigured, sendEmail } from "../lib/send-email";
import { type Settings, getSettings, saveSetting } from "../lib/settings";
import {
  ExpoSpeechRecognitionModule,
  speechAvailable,
  useSpeechRecognitionEvent,
} from "../lib/speech";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<Settings>({ resendApiKey: "", captureEmail: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Speech recognition state
  const [recording, setRecording] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const baseTextRef = useRef("");

  // Pulse animation for mic button
  useEffect(() => {
    if (recording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [recording, pulseAnim]);

  // Speech recognition event listeners
  useSpeechRecognitionEvent("start", () => setRecording(true));
  useSpeechRecognitionEvent("end", () => setRecording(false));
  useSpeechRecognitionEvent("result", (ev) => {
    const transcript = ev.results[0]?.transcript ?? "";
    if (!transcript) return;
    const base = baseTextRef.current;
    const sep = base.length > 0 ? " " : "";
    if (ev.isFinal) {
      baseTextRef.current = base + sep + transcript;
      setText(baseTextRef.current);
    } else {
      setText(base + sep + transcript);
    }
  });
  useSpeechRecognitionEvent("error", (ev) => {
    setError(`Speech error: ${ev.error}`);
    setRecording(false);
  });

  const handleToggleRecording = async () => {
    if (!ExpoSpeechRecognitionModule) return;
    if (recording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setError("Microphone permission is required for voice input.");
      return;
    }
    baseTextRef.current = text;
    ExpoSpeechRecognitionModule.start({
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });
  };

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setSettingsLoaded(true);
    });
  }, []);

  const emailConfig: EmailConfig = {
    apiKey: settings.resendApiKey,
    captureEmail: settings.captureEmail,
  };

  const openSettings = () => {
    setApiKeyInput(settings.resendApiKey);
    setEmailInput(settings.captureEmail);
    setSettingsVisible(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("resendApiKey", apiKeyInput.trim()),
        saveSetting("captureEmail", emailInput.trim()),
      ]);
      const updated: Settings = {
        resendApiKey: apiKeyInput.trim(),
        captureEmail: emailInput.trim(),
      };
      setSettings(updated);
      setSettingsVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendEmail(text.trim(), emailConfig);
      setText("");
    } catch (e: any) {
      setError(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const gearButton = (
    <Pressable
      style={[styles.gearButton, { top: insets.top + 8, right: 16 }]}
      onPress={openSettings}
      hitSlop={12}
    >
      <Ionicons name="settings-sharp" size={24} color="#666" />
    </Pressable>
  );

  const settingsModal = (
    <Modal
      visible={settingsVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSettingsVisible(false)}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Settings</Text>

          <Text style={styles.label}>Resend API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="re_..."
            placeholderTextColor="#999"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Text style={styles.label}>Capture Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#999"
            value={emailInput}
            onChangeText={setEmailInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <View style={styles.modalButtons}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setSettingsVisible(false)}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, saving && styles.sendButtonDisabled]}
              onPress={handleSaveSettings}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (!settingsLoaded) {
    return (
      <View style={styles.setupContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!isConfigured(emailConfig)) {
    return (
      <View style={styles.setupContainer}>
        {gearButton}
        <Text style={styles.title}>Setup Required</Text>
        <Text style={styles.setupText}>
          Tap the gear icon to add your{"\n"}Resend API key and capture email.
        </Text>
        {settingsModal}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {gearButton}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
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
            {speechAvailable && (
              <Animated.View style={{ opacity: pulseAnim }}>
                <Pressable
                  style={[styles.micButton, recording && styles.micButtonActive]}
                  onPress={handleToggleRecording}
                  disabled={sending}
                >
                  <Ionicons
                    name={recording ? "mic" : "mic-outline"}
                    size={24}
                    color={recording ? "#fff" : "#333"}
                  />
                </Pressable>
              </Animated.View>
            )}
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
      {settingsModal}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  setupContainer: {
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
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    textAlignVertical: "top",
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
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: "#d00",
  },
  sendButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  gearButton: {
    position: "absolute",
    zIndex: 10,
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
    backgroundColor: "#fafafa",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
