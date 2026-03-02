// Safe wrapper for expo-speech-recognition that won't crash in Expo Go.
// requireNativeModule throws if the native binary isn't linked, so we
// catch that and export no-op replacements with matching hook counts.

import { useEffect } from "react";

type SpeechModule = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;

let ExpoSpeechRecognitionModule: SpeechModule | null = null;
let realHook: typeof import("expo-speech-recognition").useSpeechRecognitionEvent | null = null;

try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  realHook = mod.useSpeechRecognitionEvent;
} catch {
  // Native module not available (e.g. Expo Go)
}

const speechAvailable = ExpoSpeechRecognitionModule != null;

/**
 * Drop-in replacement for the library's hook.
 * When the native module is missing, calls useEffect as a placeholder
 * so the hook count stays consistent across renders.
 */
const useSpeechRecognitionEvent: typeof import("expo-speech-recognition").useSpeechRecognitionEvent =
  realHook ??
  ((_eventName: any, _listener: any) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {}, []);
  });

export { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent, speechAvailable };
