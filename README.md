<div align="center">
  <img src="./logo.png" alt="thunkd" width="256" />

  **⚡ Capture thoughts instantly and send them straight to your inbox 💭**
</div>

Thunkd is a single-screen Expo app for quickly capturing a thought by typing or speaking, then sending it to your own Gmail inbox.

It includes on-device speech recognition and a small in-memory send queue for the current app session. Mock authentication and Gmail services are available for UI work in Expo Go or local development. Live Google sign-in is disabled until OAuth token exchange is moved server-side.

## Install

```bash
git clone https://github.com/tsilva/thunkd.git
cd thunkd
pnpm install
EXPO_PUBLIC_USE_MOCK_SERVICES=1 keyenv run -- pnpm start
```

Scan the Expo QR code with Expo Go, or press `i`, `a`, or `w` in the Expo terminal to open iOS, Android, or web.

The Google Cloud helper remains available for project and client-ID setup:

```bash
./scripts/setup-gcloud.sh
```

Do not add an OAuth client secret to `.env` or any `EXPO_PUBLIC_*` variable. See [Google Cloud Setup](docs/google-cloud-setup.md) for the current mock-development path and the server-side requirement for restoring live auth.

Private local values declared in `.keyenv.toml` live in macOS Keychain. Check them with `keyenv doctor` and launch commands through `keyenv run -- ...`; application code continues to read normal environment variables.

## Commands

```bash
pnpm start       # start the Expo dev server
pnpm android     # open on an Android emulator
pnpm ios         # open on an iOS simulator
pnpm web         # run the web target
pnpm lint        # run Expo lint checks

eas build --platform android --profile development  # Android dev build
eas build --platform android --profile preview      # Android preview APK
eas build --platform all --profile production       # production builds
eas update --branch preview --message "message"     # preview OTA update
eas update --branch production --message "message"  # production OTA update
```

## Notes

- This repo declares `pnpm@10.27.0` in `package.json` and rejects non-pnpm installs in `preinstall`.
- Voice capture uses `expo-speech-recognition`, so it needs a development build for real native speech input; Expo Go is best used with mock services.
- Live Google sign-in is temporarily disabled while OAuth token exchange moves to a server-side flow. Mock sign-in and mock Gmail sends remain available with `EXPO_PUBLIC_USE_MOCK_SERVICES=1`.
- `EXPO_PUBLIC_USE_MOCK_SERVICES=1` enables mocked sign-in and mocked Gmail sends. Optional mock identity values are `EXPO_PUBLIC_MOCK_USER_EMAIL` and `EXPO_PUBLIC_MOCK_USER_NAME`.
- Sent history and queued messages are kept in memory for the current app session. Mock auth state is stored with `expo-secure-store`, with a web localStorage fallback.
- EAS is configured for development, preview, and production builds in `eas.json`; the Android production submit profile expects `service-account-play-store.json`.

## Architecture

![Thunkd architecture diagram](./architecture.png)

## License

[MIT](LICENSE) © Tiago Silva
