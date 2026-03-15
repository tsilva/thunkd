import Constants, { ExecutionEnvironment } from "expo-constants";

const mockEnvValue = process.env.EXPO_PUBLIC_USE_MOCK_SERVICES?.trim().toLowerCase();

export const mockServicesForced =
  mockEnvValue === "1" || mockEnvValue === "true" || mockEnvValue === "yes";

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const mockServicesEnabled = __DEV__ && (mockServicesForced || isExpoGo);

export function getMockUser() {
  return {
    email: process.env.EXPO_PUBLIC_MOCK_USER_EMAIL?.trim() || "dev@thunkd.local",
    name: process.env.EXPO_PUBLIC_MOCK_USER_NAME?.trim() || "Thunkd Dev",
  };
}

export function getMockModeLabel() {
  if (!mockServicesEnabled) return null;
  if (mockServicesForced) return "Mock services";
  if (isExpoGo) return "Expo Go mock services";
  return "Mock services";
}
