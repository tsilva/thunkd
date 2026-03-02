import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
    if (request) {
      console.log("OAuth redirect URI:", request.redirectUri);
      console.log("OAuth request URL:", request.url);
    }
  }, [request]);

  useEffect(() => {
    isAuthenticated().then((authed) => {
      if (authed) router.replace("/");
    });
  }, []);

  useEffect(() => {
    if (response?.type !== "success") {
      if (response) console.log("OAuth response:", response.type, response);
      return;
    }

    (async () => {
      // Raw useAuthRequest returns an auth code, not tokens — exchange it
      if (response.params?.code && request?.codeVerifier) {
        const tokenResponse = await exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            code: response.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier },
          },
          googleAuthConfig,
        );
        console.log("Token response scopes:", tokenResponse.scope);
        console.log("Token response keys:", Object.keys(tokenResponse));
        await storeTokens(tokenResponse);
      } else if (response.authentication) {
        await storeTokens(response.authentication);
      } else {
        console.log("OAuth: no code or authentication in response", response);
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
        style={[styles.button, !request && styles.buttonDisabled]}
        onPress={() => promptAsync()}
        disabled={!request}
      >
        <Text style={styles.buttonText}>Sign in with Gmail</Text>
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
    width: "100%",
    height: 56,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  footnote: {
    fontSize: 13,
    color: "#999",
    marginTop: 24,
    textAlign: "center",
  },
});
