import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getMockUser, mockServicesEnabled } from "./dev-mode";

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

let googleSigninModule: GoogleSigninModule | null = null;

try {
  googleSigninModule = require("@react-native-google-signin/google-signin") as GoogleSigninModule;
} catch {
  // Native module unavailable (for example Expo Go)
}

const GoogleSignin = googleSigninModule?.GoogleSignin ?? null;
const isSuccessResponse = googleSigninModule?.isSuccessResponse ?? null;

// expo-secure-store doesn't support web — fall back to localStorage
const store = {
  getItemAsync: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  setItemAsync: (key: string, value: string) =>
    Platform.OS === "web"
      ? (localStorage.setItem(key, value), Promise.resolve())
      : SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key: string) =>
    Platform.OS === "web"
      ? (localStorage.removeItem(key), Promise.resolve())
      : SecureStore.deleteItemAsync(key),
};

const STORE_KEYS = {
  accessToken: "google_access_token",
  refreshToken: "google_refresh_token",
  expiresAt: "google_expires_at",
  userEmail: "google_user_email",
  userName: "google_user_name",
} as const;

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const WEB_CLIENT_SECRET =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET ?? "";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.send",
];

export type UserInfo = {
  email: string;
  name: string;
};

GoogleSignin?.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
  scopes: SCOPES,
  forceCodeForRefreshToken: true,
});

/**
 * Trigger the native Google Sign-In flow, then exchange the server auth code
 * for access + refresh tokens via Google's token endpoint.
 */
export async function signIn(): Promise<UserInfo> {
  if (mockServicesEnabled) {
    const mockUser = getMockUser();
    const expiresAt = String(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await Promise.all([
      store.setItemAsync(STORE_KEYS.accessToken, "mock-access-token"),
      store.setItemAsync(STORE_KEYS.refreshToken, "mock-refresh-token"),
      store.setItemAsync(STORE_KEYS.expiresAt, expiresAt),
    ]);

    await storeUserInfo(mockUser);
    return mockUser;
  }

  if (!GoogleSignin || !isSuccessResponse) {
    throw new Error(
      "Google Sign-In requires a development build. Use Expo Go with mock services enabled or run a dev client.",
    );
  }

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error("Google Sign-In was cancelled");
  }

  const { serverAuthCode } = response.data;
  if (!serverAuthCode) {
    throw new Error("No server auth code returned — check webClientId and offlineAccess config");
  }

  // Exchange auth code for tokens
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: serverAuthCode,
      client_id: WEB_CLIENT_ID,
      client_secret: WEB_CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: "",
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();

  const expiresAt = tokens.expires_in
    ? String(Date.now() + tokens.expires_in * 1000)
    : "";

  await Promise.all([
    store.setItemAsync(STORE_KEYS.accessToken, tokens.access_token),
    tokens.refresh_token
      ? store.setItemAsync(STORE_KEYS.refreshToken, tokens.refresh_token)
      : Promise.resolve(),
    expiresAt
      ? store.setItemAsync(STORE_KEYS.expiresAt, expiresAt)
      : Promise.resolve(),
  ]);

  const profile = await fetchUserProfile();
  await storeUserInfo(profile);
  return profile;
}

export async function getValidAccessToken(): Promise<string> {
  if (mockServicesEnabled) {
    const [accessToken, expiresAtStr] = await Promise.all([
      store.getItemAsync(STORE_KEYS.accessToken),
      store.getItemAsync(STORE_KEYS.expiresAt),
    ]);

    if (!accessToken) throw new Error("Not signed in");

    const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
    if (expiresAt > 0 && Date.now() >= expiresAt) {
      throw new Error("Mock session expired");
    }

    return accessToken;
  }

  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    store.getItemAsync(STORE_KEYS.accessToken),
    store.getItemAsync(STORE_KEYS.refreshToken),
    store.getItemAsync(STORE_KEYS.expiresAt),
  ]);

  if (!accessToken) throw new Error("Not signed in");

  const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
  const isExpired = expiresAt > 0 && Date.now() >= expiresAt - 60_000;

  if (!isExpired) return accessToken;

  if (!refreshToken) throw new Error("Session expired — please sign in again");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: WEB_CLIENT_ID,
      client_secret: WEB_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    // Clear auth data on refresh failure to force fresh sign-in
    await clearAuth();
    throw new Error(`Session expired — please sign in again`);
  }

  const refreshed = await res.json();

  const newExpiresAt = refreshed.expires_in
    ? String(Date.now() + refreshed.expires_in * 1000)
    : "";

  await Promise.all([
    store.setItemAsync(STORE_KEYS.accessToken, refreshed.access_token),
    refreshed.refresh_token
      ? store.setItemAsync(STORE_KEYS.refreshToken, refreshed.refresh_token)
      : Promise.resolve(),
    newExpiresAt
      ? store.setItemAsync(STORE_KEYS.expiresAt, newExpiresAt)
      : Promise.resolve(),
  ]);

  return refreshed.access_token;
}

export async function fetchUserProfile(): Promise<UserInfo> {
  if (mockServicesEnabled) {
    return getMockUser();
  }

  const token = await getValidAccessToken();
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user profile");
  const data = await res.json();
  return { email: data.email, name: data.name ?? "" };
}

export async function storeUserInfo(info: UserInfo) {
  await Promise.all([
    store.setItemAsync(STORE_KEYS.userEmail, info.email),
    store.setItemAsync(STORE_KEYS.userName, info.name),
  ]);
}

export async function getStoredUserInfo(): Promise<UserInfo | null> {
  const [email, name] = await Promise.all([
    store.getItemAsync(STORE_KEYS.userEmail),
    store.getItemAsync(STORE_KEYS.userName),
  ]);
  if (!email) return null;
  return { email, name: name ?? "" };
}

export async function isAuthenticated(): Promise<boolean> {
  const [accessToken, expiresAtStr] = await Promise.all([
    store.getItemAsync(STORE_KEYS.accessToken),
    store.getItemAsync(STORE_KEYS.expiresAt),
  ]);
  
  if (!accessToken) return false;
  
  // Check if token is expired
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
  if (expiresAt > 0 && Date.now() >= expiresAt) {
    return false;
  }
  
  return true;
}

export async function clearAuth() {
  if (GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore — user may not have an active native session
    }
  }
  await Promise.all(
    Object.values(STORE_KEYS).map((key) => store.deleteItemAsync(key)),
  );
}
