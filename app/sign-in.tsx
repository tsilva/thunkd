import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { isAuthenticated, signIn } from "../lib/auth";
import { getMockModeLabel, getMockUser, mockServicesEnabled } from "../lib/dev-mode";

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockModeLabel = getMockModeLabel();
  const mockUser = getMockUser();

  useEffect(() => {
    isAuthenticated().then((authed) => {
      if (authed) router.replace("/");
    });
  }, []);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signIn();
      router.replace("/");
    } catch (e: any) {
      // Don't show error for user cancellation
      if (e?.code !== "SIGN_IN_CANCELLED") {
        setError(e?.message ?? "Sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Thunkd</Text>
      <Text style={styles.subtitle}>Capture thoughts, send to your inbox</Text>
      {mockServicesEnabled ? <Text style={styles.mockModeLabel}>{mockModeLabel}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          loading && styles.buttonDisabled,
          pressed && mockServicesEnabled && styles.buttonPressed,
        ]}
        onPress={handleSignIn}
        disabled={loading || !mockServicesEnabled}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#1F1F1F" style={styles.logoContainer} />
        ) : mockServicesEnabled ? (
          <View style={styles.mockIcon}>
            <Text style={styles.mockIconText}>DEV</Text>
          </View>
        ) : null}
        <Text style={styles.buttonText}>
          {mockServicesEnabled
            ? "Continue in Mock Mode"
            : "Google sign-in temporarily unavailable"}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.footnote}>
        {mockServicesEnabled
          ? `Using ${mockUser.email}. Sends are faked locally for UI development.`
          : "Live sign-in is disabled until OAuth token exchange is moved server-side."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  mockModeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8A4B00",
    backgroundColor: "#FFE6BF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#747775",
    paddingLeft: 16,
    paddingRight: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  logoContainer: {
    marginRight: 12,
  },
  mockIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F1F1F",
    marginRight: 12,
  },
  mockIconText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  buttonText: {
    fontSize: 14,
    color: "#1F1F1F",
    fontWeight: "500",
    fontFamily: Platform.OS === "android" ? "Roboto" : undefined,
  },
  error: {
    fontSize: 13,
    color: "#D32F2F",
    marginTop: 16,
    textAlign: "center",
  },
  footnote: {
    fontSize: 13,
    color: "#999",
    marginTop: 24,
    textAlign: "center",
  },
});
