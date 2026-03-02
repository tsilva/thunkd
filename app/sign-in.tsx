import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SCOPES,
  fetchUserProfile,
  googleAuthConfig,
  isAuthenticated,
  storeTokens,
  storeUserInfo,
} from "../lib/auth";

WebBrowser.maybeCompleteAuthSession();

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

const redirectUri = makeRedirectUri({
  native: "thunkd://sign-in",
  preferLocalhost: false,
});

export default function SignInScreen() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: SCOPES,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
      usePKCE: true,
    },
    googleAuthConfig,
  );

  useEffect(() => {
    isAuthenticated().then((authed) => {
      if (authed) router.replace("/");
    });
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;

    (async () => {
      if (response.params?.code && request?.codeVerifier) {
        const tokenResponse = await exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            // client secret required on web, not needed on native
            ...(Platform.OS === "web" && { clientSecret: GOOGLE_CLIENT_SECRET }),
            code: response.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier },
          },
          googleAuthConfig,
        );
        await storeTokens(tokenResponse);
      } else if (response.authentication) {
        await storeTokens(response.authentication);
      } else {
        return;
      }

      const profile = await fetchUserProfile();
      await storeUserInfo(profile);
      router.replace("/");
    })();
  }, [response]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
      />
      <Text style={styles.title}>Thunkd</Text>
      <Text style={styles.subtitle}>Capture thoughts, send to your inbox</Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          !request && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => promptAsync()}
        disabled={!request}
      >
        <View style={styles.logoContainer}>
          <GoogleLogo size={20} />
        </View>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </Pressable>

      <Text style={styles.footnote}>
        We only use Gmail to send thoughts to your own inbox
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
    marginBottom: 48,
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
  buttonText: {
    fontSize: 14,
    color: "#1F1F1F",
    fontWeight: "500",
    fontFamily: Platform.OS === "android" ? "Roboto" : undefined,
  },
  footnote: {
    fontSize: 13,
    color: "#999",
    marginTop: 24,
    textAlign: "center",
  },
});
