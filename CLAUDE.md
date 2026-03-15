# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Thunkd

Zero-friction mobile app for capturing thoughts via voice or text and sending them to the user's Gmail inbox. Single-screen app — open, speak/type, tap Send.

## Tech Stack

- React Native 0.81 + Expo 54 (managed workflow, New Architecture enabled)
- TypeScript 5.9 (strict mode)
- Expo Router for file-based navigation
- @react-native-google-signin for native Google OAuth
- Gmail API for sending emails
- expo-speech-recognition for voice capture
- expo-secure-store for token storage
- expo-updates for OTA updates

## Commands

All commands available via `make help`.

```bash
make install          # npm install
make start            # Start Expo dev server
make start-clear      # Start with cleared cache
make ios              # Run on iOS simulator
make android          # Run on Android emulator
make web              # Run web version
make lint             # ESLint via expo lint
make typecheck        # TypeScript type checking (tsc --noEmit)
make check            # lint + typecheck
make setup-gcloud     # Interactive Google Cloud OAuth setup
make icons            # Generate app icons from source SVG
make build-production # EAS production build (all platforms)
make submit-android   # Submit Android build to Play Store (internal track)
make submit-ios       # Submit iOS build to App Store
make clean            # Remove node_modules and caches
```

## Architecture

### Screens (`app/`)

File-based routing via Expo Router. Two screens + root layout:

- `_layout.tsx` — Stack navigator (both screens headerless)
- `index.tsx` — Home: text input, mic button, send button, settings modal. Redirects to `/sign-in` if unauthenticated.
- `sign-in.tsx` — Google OAuth sign-in. Redirects to `/` on success.

### Libraries (`lib/`)

- `auth.ts` — Google OAuth token management. Native sign-in → server auth code → token exchange → secure storage, with a development-only mock auth path for Expo Go/UI work. Auto-refreshes access tokens 60s before expiry. Platform-aware: uses SecureStore on native, localStorage on web.
- `dev-mode.ts` — Runtime helpers for enabling mock auth/send flows in development and Expo Go.
- `gmail.ts` — Constructs RFC 2822 emails, base64url encodes, sends via Gmail API, with a development-only mock send path.
- `email-queue.ts` — Offline-safe queue using `useSyncExternalStore`. Single async processor with retry. Activates `expo-keep-awake` during processing.
- `speech.ts` — Wraps expo-speech-recognition with graceful no-op fallback when native module is unavailable (e.g., Expo Go).

### State Management

No external state library. Uses React `useState` for UI state and `useSyncExternalStore` for the email queue. Auth tokens persisted in `expo-secure-store`.

### Auth Flow

1. Native Google Sign-In → receives `serverAuthCode`
2. Exchange auth code for access + refresh tokens via `https://oauth2.googleapis.com/token`
3. Store tokens in secure storage with expiration timestamp
4. `getValidAccessToken()` auto-refreshes before expiry
5. OAuth scopes: `openid`, `userinfo.email`, `userinfo.profile`, `gmail.send`

## Environment

Copy `.env.example` to `.env`. Required variables:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Google OAuth web client ID
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET` — Google OAuth web client secret
- `EXPO_PUBLIC_USE_MOCK_SERVICES` — Enable mocked sign-in + send in development
- `EXPO_PUBLIC_MOCK_USER_EMAIL` — Override the default mock email
- `EXPO_PUBLIC_MOCK_USER_NAME` — Override the default mock name

Run `make setup-gcloud` for interactive setup.

## CI/CD

- **PR checks** (`.github/workflows/ci.yml`): PII scan
- **Production builds** (`.github/workflows/eas-build.yml`): EAS Build on push to main (Play Store submission steps are commented out pending service account key setup)

## Play Store

- `android.versionCode` in `app.json` must be incremented for each Play Store upload
- Privacy policy hosted at a GitHub Gist, URL stored in `expo.extra.privacyPolicyUrl` in `app.json`
- EAS Submit configured for Android internal track; requires `service-account-play-store.json` (gitignored)

## Maintenance

README.md must be kept up to date with any significant project changes.
