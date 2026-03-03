# Google Cloud Console Setup

This guide walks through configuring Google Cloud so that Thunkd can authenticate users via Google OAuth and send emails through the Gmail API.

## Automated Setup (Recommended)

The setup script automates project creation and API enablement, then guides you through the manual OAuth steps with pre-filled instructions:

```bash
make setup-gcloud
```

**Prerequisites:** [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) must be installed.

The script is fully idempotent — you can re-run it at any time and it will skip steps that are already complete. If you prefer to do everything manually, follow the steps below.

---

## Manual Setup

### 1. Create or select a project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top bar) and either select an existing project or click **New Project**
3. Name it something like `thunkd` and click **Create**

### 2. Enable the Gmail API

1. Navigate to **APIs & Services > Library**
2. Search for **Gmail API**
3. Click it and press **Enable**

### 3. Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace org and want internal-only) and click **Create**
3. Fill in the required fields:
   - **App name:** `Thunkd`
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue**

#### Add scopes

1. Click **Add or Remove Scopes**
2. Add the following scopes:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.send`
3. Click **Update**, then **Save and Continue**

> **Note:** `gmail.send` is classified as a **sensitive scope**. During development this is fine — you just need to add test users (next step). For production, Google requires a brief verification process (typically a few days).

#### Add test users

1. On the **Test users** step, click **Add Users**
2. Enter the Gmail addresses that will test the app
3. Click **Save and Continue**

Only these accounts will be able to sign in while the app is in "Testing" publishing status.

### 4. Create OAuth 2.0 Client IDs

Go to **APIs & Services > Credentials** and click **Create Credentials > OAuth client ID**.

You need to create **three** client IDs:

#### Web client

- **Application type:** Web application
- **Name:** `Thunkd Web`
- No redirect URIs needed (the native SDK handles auth natively, not via browser redirects)
- Click **Create**
- Copy the **Client ID** and **Client Secret** — these are your `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET`

> The web client ID is used by the native Google Sign-In SDK to obtain a server auth code, which is then exchanged for access/refresh tokens.

#### iOS client

- **Application type:** iOS
- **Name:** `Thunkd iOS`
- **Bundle ID:** `com.tsilva.thunkd`
- Click **Create**

> The iOS client ID is automatically picked up by the native SDK via the config plugin — no env var needed.

#### Android client

- **Application type:** Android
- **Name:** `Thunkd Android`
- **Package name:** `com.tsilva.thunkd`
- **SHA-1 certificate fingerprint:** see [Getting the SHA-1](#getting-the-android-sha-1-fingerprint) below
- Click **Create**

> **Important:** The SHA-1 fingerprint must match the signing key used by your build. For EAS dev builds, use `eas credentials -p android` to find it. For local debug builds, use the debug keystore. A mismatched SHA-1 will cause sign-in to fail silently.

### 5. Add client IDs to your `.env`

Copy `.env.example` to `.env` and fill in the values:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET=GOCSPX-...
```

### 6. Verify the setup

1. Build a dev client: `eas build --platform android --profile development`
2. Install the APK and launch the app
3. Tap **Sign in with Google** — the native Google account picker should appear (no browser)
4. Sign in with one of the test users you added
5. After consent, you're redirected to the capture screen
6. Type a thought, tap Send — an email should arrive in your inbox (from yourself)

### Appendix

### Getting the Android SHA-1 fingerprint

For **EAS builds** (recommended):

```sh
eas credentials -p android
```

For **local debug builds**:

```sh
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep SHA1
```

For **production builds**, use the upload keystore or the signing key from Google Play Console (**Setup > App signing > SHA-1 certificate fingerprint**).

> **Tip:** If you have multiple SHA-1 fingerprints (debug + EAS), create a separate Android OAuth client for each one, or add multiple fingerprints to the same client.

### Moving to production

When you're ready to go beyond test users:

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. Google will review the app since `gmail.send` is a sensitive scope
4. You'll need to provide:
   - A homepage URL
   - A privacy policy URL
   - An explanation of why your app needs `gmail.send`
5. Review typically takes a few business days
