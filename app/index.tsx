import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { type UserInfo, clearAuth, getStoredUserInfo, isAuthenticated } from "../lib/auth";
import { getMockModeLabel, mockServicesEnabled } from "../lib/dev-mode";
import { setErrorHandler, useEmailQueue } from "../lib/email-queue";
import {
  ExpoSpeechRecognitionModule,
  speechAvailable,
  useSpeechRecognitionEvent,
} from "../lib/speech";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pendingCount, enqueue, sentItems } = useEmailQueue();

  // Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const mockModeLabel = getMockModeLabel();

  // Refs
  const textInputRef = useRef<TextInput>(null);

  // Speech recognition state
  const [recording, setRecording] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const baseTextRef = useRef("");
  const micPressActiveRef = useRef(false);
  const recordingRequestedRef = useRef(false);

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
  useSpeechRecognitionEvent("start", () => {
    setRecording(true);
    if (!micPressActiveRef.current) {
      ExpoSpeechRecognitionModule?.stop();
    }
  });
  useSpeechRecognitionEvent("end", () => {
    recordingRequestedRef.current = false;
    setRecording(false);
  });
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
    recordingRequestedRef.current = false;
    setError(`Speech error: ${ev.error}`);
    setRecording(false);
  });

  const handleStartRecording = async () => {
    micPressActiveRef.current = true;
    if (!ExpoSpeechRecognitionModule || recording || recordingRequestedRef.current) return;
    setError(null);
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setError("Microphone permission is required for voice input.");
      return;
    }
    if (!micPressActiveRef.current) return;
    baseTextRef.current = text;
    recordingRequestedRef.current = true;
    try {
      ExpoSpeechRecognitionModule.start({
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      });
    } catch (err) {
      recordingRequestedRef.current = false;
      setError(err instanceof Error ? err.message : "Unable to start recording.");
    }
  };

  const handleStopRecording = () => {
    micPressActiveRef.current = false;
    if (!ExpoSpeechRecognitionModule || (!recording && !recordingRequestedRef.current)) return;
    ExpoSpeechRecognitionModule.stop();
  };

  useEffect(() => {
    (async () => {
      const loggedIn = await isAuthenticated();
      if (loggedIn) {
        const info = await getStoredUserInfo();
        setUserInfo(info);
      }
      setAuthed(loggedIn);
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    setErrorHandler((msg) => setError(msg));
    return () => setErrorHandler(null);
  }, []);

  // Prevent back button from dismissing keyboard on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      // Always return true to prevent default behavior
      // Keyboard stays open, nothing happens on back press
      return true;
    });
    return () => backHandler.remove();
  }, []);

  const handleSend = () => {
    if (recording || !text.trim() || !userInfo?.email) return;
    setError(null);
    enqueue(text.trim(), userInfo.email);
    setText("");
    baseTextRef.current = "";
  };

  const handleSignOut = async () => {
    await clearAuth();
    setSettingsVisible(false);
    router.replace("/sign-in");
  };

  const formatSentTime = (sentAt: number) =>
    new Date(sentAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!authChecked) {
    return (
      <View style={styles.setupContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!authed) {
    return <Redirect href="/sign-in" />;
  }

  const sendDisabled = recording || !text.trim();

  const gearButton = (
    <Pressable
      style={[styles.gearButton, { top: insets.top + 8, right: 16 }]}
      onPress={() => setSettingsVisible(true)}
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
      onRequestClose={() => {
        setSettingsVisible(false);
        // Restore keyboard focus when modal closes
        setTimeout(() => textInputRef.current?.focus(), 100);
      }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Settings</Text>

          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.emailText}>{userInfo?.email ?? "Unknown"}</Text>
          {mockServicesEnabled ? (
            <Text style={styles.mockHelpText}>
              {mockModeLabel}. Send actions are mocked and stay local to this device.
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              const url = Constants.expoConfig?.extra?.privacyPolicyUrl;
              if (url) openBrowserAsync(url);
            }}
          >
            <Text style={styles.privacyLink}>Privacy Policy</Text>
          </Pressable>

          <View style={styles.modalButtons}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setSettingsVisible(false);
                // Restore keyboard focus when modal closes
                setTimeout(() => textInputRef.current?.focus(), 100);
              }}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </Pressable>
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {gearButton}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <View style={styles.container}>
          {mockServicesEnabled ? (
            <View style={styles.mockBanner}>
              <Text style={styles.mockBannerText}>
                {mockModeLabel}: sign-in and send are mocked for development.
              </Text>
            </View>
          ) : null}
          <View style={styles.textInputWrapper}>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#999"
              multiline
              autoFocus
              blurOnSubmit={false}
              value={text}
              onChangeText={setText}
              onBlur={() => {
                // Always refocus to keep keyboard open
                textInputRef.current?.focus();
              }}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {pendingCount > 0 && (
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" color="#999" />
              <Text style={styles.pendingText}>
                Sending {pendingCount} message{pendingCount !== 1 ? "s" : ""}...
              </Text>
            </View>
          )}

          {recording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}

          {sentItems.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Previously sent</Text>
                <Text style={styles.historyCount}>{sentItems.length} this session</Text>
              </View>
              <ScrollView
                style={styles.historyList}
                contentContainerStyle={styles.historyListContent}
                keyboardShouldPersistTaps="handled"
              >
                {sentItems.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.historyItem,
                      index < sentItems.length - 1 && styles.historyItemBorder,
                    ]}
                  >
                    <Text style={styles.historyText}>{item.text}</Text>
                    <Text style={styles.historyTime}>{formatSentTime(item.sentAt)}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.buttonRow}>
            {speechAvailable && (
              <Animated.View style={{ opacity: pulseAnim }}>
                <Pressable
                  style={[styles.micButton, recording && styles.micButtonActive]}
                  onPressIn={handleStartRecording}
                  onPressOut={handleStopRecording}
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
              style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sendDisabled}
            >
              <Text style={styles.sendButtonText}>Send</Text>
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
  mockBanner: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FFF4E5",
  },
  mockBannerText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#8A4B00",
    textAlign: "center",
  },
  setupContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  textInputWrapper: {
    flex: 1,
    minHeight: 0,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    color: "#111",
    textAlignVertical: "top",
  },
  errorText: {
    color: "#d00",
    fontSize: 14,
    marginBottom: 12,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  pendingText: {
    color: "#999",
    fontSize: 13,
  },
  historySection: {
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  historyCount: {
    fontSize: 12,
    color: "#777",
  },
  historyList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },
  historyListContent: {
    paddingHorizontal: 12,
  },
  historyItem: {
    paddingVertical: 12,
    gap: 4,
  },
  historyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
  },
  historyText: {
    fontSize: 14,
    color: "#111",
  },
  historyTime: {
    fontSize: 12,
    color: "#777",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fdeaea",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d00",
  },
  recordingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#900",
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
  emailText: {
    fontSize: 16,
    color: "#000",
    marginBottom: 24,
  },
  mockHelpText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8A4B00",
    backgroundColor: "#FFF4E5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
  },
  privacyLink: {
    fontSize: 15,
    color: "#007AFF",
    marginBottom: 32,
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
  signOutButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#d00",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
