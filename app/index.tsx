import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { type UserInfo, clearAuth, getStoredUserInfo, isAuthenticated } from "../lib/auth";
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
  const { pendingCount, enqueue } = useEmailQueue();

  // Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Refs
  const textInputRef = useRef<TextInput>(null);

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
    if (!text.trim() || !userInfo?.email) return;
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

          <View style={styles.buttonRow}>
            {speechAvailable && (
              <Animated.View style={{ opacity: pulseAnim }}>
                <Pressable
                  style={[styles.micButton, recording && styles.micButtonActive]}
                  onPress={handleToggleRecording}
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
              style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!text.trim()}
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
