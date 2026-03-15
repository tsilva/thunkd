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
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { isAuthenticated, signIn } from "../lib/auth";
import { getMockModeLabel, getMockUser, mockServicesEnabled } from "../lib/dev-mode";

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        fill="#FBBC05"
      />
      <Path
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        fill="#EA4335"
      />
      <Path
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        fill="#34A853"
      />
      <Path
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        fill="#4285F4"
      />
    </Svg>
  );
}

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
          pressed && styles.buttonPressed,
        ]}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#1F1F1F" style={styles.logoContainer} />
        ) : mockServicesEnabled ? (
          <View style={styles.mockIcon}>
            <Text style={styles.mockIconText}>DEV</Text>
          </View>
        ) : (
          <View style={styles.logoContainer}>
            <GoogleLogo size={20} />
          </View>
        )}
        <Text style={styles.buttonText}>
          {mockServicesEnabled ? "Continue in Mock Mode" : "Sign in with Google"}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.footnote}>
        {mockServicesEnabled
          ? `Using ${mockUser.email}. Sends are faked locally for UI development.`
          : "We only use Gmail to send thoughts to your own inbox"}
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
