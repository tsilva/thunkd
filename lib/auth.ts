import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

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

export const googleAuthConfig: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET ?? "";
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

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

export async function storeTokens(response: AuthSession.TokenResponse) {
  const expiresAt = response.expiresIn
    ? String(Date.now() + response.expiresIn * 1000)
    : "";

  await Promise.all([
    store.setItemAsync(STORE_KEYS.accessToken, response.accessToken),
    response.refreshToken
      ? store.setItemAsync(
          STORE_KEYS.refreshToken,
          response.refreshToken,
        )
      : Promise.resolve(),
    expiresAt
      ? store.setItemAsync(STORE_KEYS.expiresAt, expiresAt)
      : Promise.resolve(),
  ]);
}

export async function getValidAccessToken(): Promise<string> {
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

  const refreshed = await AuthSession.refreshAsync(
    {
      clientId: GOOGLE_CLIENT_ID,
      refreshToken,
    },
    googleAuthConfig,
  );

  await storeTokens(refreshed);
  return refreshed.accessToken;
}

export async function fetchUserProfile(): Promise<UserInfo> {
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
  const token = await store.getItemAsync(STORE_KEYS.accessToken);
  return Boolean(token);
}

export async function clearAuth() {
  await Promise.all(
    Object.values(STORE_KEYS).map((key) =>
      store.deleteItemAsync(key),
    ),
  );
}
