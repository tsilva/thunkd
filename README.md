<div align="center">
  <img src="assets/images/icon.png" alt="Thunkd" width="512"/>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-000020.svg?logo=expo)](https://expo.dev)
  [![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-lightgrey.svg)](https://reactnative.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

  **Capture thoughts instantly and send them straight to your inbox**

  [Google Cloud Setup](docs/google-cloud-setup.md)
</div>

---

## Overview

**The Pain:** You have a fleeting thought — a to-do, an idea, a reminder — but by the time you open a notes app, find the right folder, and type it out, the moment is gone.

**The Solution:** Thunkd is a single-screen mobile app. Open it, speak or type your thought, tap Send. It lands in your Gmail inbox in seconds.

**The Result:** Zero-friction capture. No accounts to manage, no syncing, no organizing. Your inbox *is* the inbox.

## Features

- **Voice capture** — tap the mic and speak, Thunkd transcribes in real-time via on-device speech recognition
- **One-tap send** — thoughts go straight to your own Gmail inbox as emails
- **Email queue with retry** — messages queue up and retry automatically if the network drops
- **Google OAuth** — sign in once with your Google account (PKCE flow, tokens stored securely)
- **Minimal UI** — one screen, one text field, one button. Nothing else.
- **Cross-platform** — runs on iOS, Android, and web

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- Google Cloud project with OAuth credentials ([setup guide](docs/google-cloud-setup.md))

### Install & Run

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Google OAuth client IDs (see docs/google-cloud-setup.md)

# Start the dev server
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `i`/`a` to launch a simulator.

> **Note:** Voice capture requires a [development build](https://docs.expo.dev/develop/development-builds/introduction/) — it won't work in Expo Go since it needs the native `expo-speech-recognition` module.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET` | Google OAuth web client secret |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client ID |

See [Google Cloud Setup](docs/google-cloud-setup.md) for step-by-step instructions on creating these credentials.

## Project Structure

```
app/
  _layout.tsx        # Root layout (Stack navigator)
  index.tsx          # Home screen — text input, mic, send button
  sign-in.tsx        # Google OAuth sign-in screen
lib/
  auth.ts            # Google OAuth token management & secure storage
  gmail.ts           # Gmail API — compose & send RFC 2822 emails
  email-queue.ts     # Offline-safe queue with automatic retry
  speech.ts          # Speech recognition wrapper (graceful Expo Go fallback)
docs/
  google-cloud-setup.md  # Google Cloud Console configuration guide
scripts/
  generate-icons.mjs     # App icon generation script
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [React Native](https://reactnative.dev) 0.81 + [Expo](https://expo.dev) SDK 54 |
| Language | [TypeScript](https://www.typescriptlang.org) 5.9 |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based) |
| Auth | [expo-auth-session](https://docs.expo.dev/versions/latest/sdk/auth-session/) + Google OAuth 2.0 (PKCE) |
| Email | [Gmail API](https://developers.google.com/gmail/api) (send scope) |
| Speech | [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition) |
| Storage | [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) (tokens) |

## Building

Thunkd uses [EAS Build](https://docs.expo.dev/build/introduction/) for native builds.

```bash
# Development build (internal distribution)
eas build --platform android --profile development
eas build --platform ios --profile development

# Preview APK
eas build --platform android --profile preview

# Production
eas build --platform all --profile production
```

### OTA Updates

```bash
eas update --branch preview --message "description of changes"
eas update --branch production --message "description of changes"
```

### Make Commands

Run `make help` to see all available commands, including `make start`, `make build-production`, `make icons`, and more.

## License

[MIT](LICENSE) &copy; Tiago Silva
