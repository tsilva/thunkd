# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project: Thunkd



### Tech Stack

- React Native with Expo (managed workflow)
- Expo Router for file-based navigation
- TypeScript

### Development

```bash
npm install        # install dependencies
npx expo start     # start dev server
npx expo start -c  # start with cleared cache
```

### Building

```bash
eas build --platform ios      # iOS build
eas build --platform android  # Android build
eas build --platform all      # both platforms
```

### Project Structure

- `app/` — screens and layouts (file-based routing via Expo Router)
- `assets/` — static images, fonts, and other assets
- `app.json` — Expo app configuration

## Maintenance

README.md must be kept up to date with any significant project changes.
