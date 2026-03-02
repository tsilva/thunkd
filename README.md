# Thunkd

💭 **Capture thoughts instantly and send them straight to your inbox** 📬

A quick-capture note-taking app built with React Native and Expo. Speak or type a thought, and Thunkd emails it to you — so nothing slips through the cracks.

## ⚡ Features

- **Voice capture** — tap and speak, Thunkd transcribes via speech recognition
- **One-tap send** — thoughts go straight to your email inbox
- **Minimal UI** — zero friction between idea and capture

## 🚀 Quick Start

```bash
npm install
npx expo start
```

### Tech Stack

- React Native with Expo (managed workflow)
- Expo Router for file-based navigation
- TypeScript

## 📁 Project Structure

- `app/` — screens and layouts (file-based routing via Expo Router)
- `lib/` — shared utilities (email, speech, settings)
- `assets/` — static images, fonts, and other assets
- `app.json` — Expo app configuration

## 🏗️ Building

```bash
eas build --platform ios
eas build --platform android
eas build --platform all
```

## 📄 License

[MIT](LICENSE)
