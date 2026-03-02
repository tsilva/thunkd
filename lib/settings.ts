import * as SecureStore from "expo-secure-store";

const KEYS = {
  resendApiKey: "resend_api_key",
  captureEmail: "capture_email",
} as const;

export type Settings = {
  resendApiKey: string;
  captureEmail: string;
};

export async function getSettings(): Promise<Settings> {
  const [resendApiKey, captureEmail] = await Promise.all([
    SecureStore.getItemAsync(KEYS.resendApiKey),
    SecureStore.getItemAsync(KEYS.captureEmail),
  ]);
  return { resendApiKey: resendApiKey ?? "", captureEmail: captureEmail ?? "" };
}

export async function saveSetting(
  key: keyof typeof KEYS,
  value: string,
): Promise<void> {
  const storeKey = KEYS[key];
  if (value) {
    await SecureStore.setItemAsync(storeKey, value);
  } else {
    await SecureStore.deleteItemAsync(storeKey);
  }
}
