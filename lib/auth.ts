import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getMockUser, mockServicesEnabled } from "./dev-mode";

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

export const LIVE_AUTH_DISABLED_MESSAGE =
  "Google sign-in is temporarily unavailable while OAuth is moved to a server-side flow.";

export type UserInfo = {
  email: string;
  name: string;
};

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

  await clearAuth();
  throw new Error(LIVE_AUTH_DISABLED_MESSAGE);
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

  await clearAuth();
  throw new Error(LIVE_AUTH_DISABLED_MESSAGE);
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
  if (!mockServicesEnabled) {
    await clearAuth();
    return false;
  }

  const [accessToken, refreshToken] = await Promise.all([
    store.getItemAsync(STORE_KEYS.accessToken),
    store.getItemAsync(STORE_KEYS.refreshToken),
  ]);

  if (!accessToken && !refreshToken) {
    return false;
  }

  try {
    await getValidAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function clearAuth() {
  await Promise.all(
    Object.values(STORE_KEYS).map((key) => store.deleteItemAsync(key)),
  );
}
