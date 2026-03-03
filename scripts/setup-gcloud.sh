#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Thunkd — Google Cloud Setup Script
#
# Automates what it can (project creation, API enablement) and guides you
# through the manual steps (OAuth consent screen, client IDs).
#
# Fully idempotent — safe to re-run at any time; only does what's missing.
# =============================================================================

# -- Colors -------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# -- Helpers ------------------------------------------------------------------
info()    { printf "${BLUE}ℹ${RESET}  %s\n" "$*"; }
success() { printf "${GREEN}✔${RESET}  %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${RESET}  %s\n" "$*"; }
error()   { printf "${RED}✖${RESET}  %s\n" "$*" >&2; }
header()  { printf "\n${BOLD}${CYAN}── %s ──${RESET}\n\n" "$*"; }
dim()     { printf "${DIM}%s${RESET}\n" "$*"; }

prompt_default() {
  local prompt="$1" default="$2" var_name="$3"
  printf "${BOLD}%s${RESET} [%s]: " "$prompt" "$default"
  read -r input
  eval "$var_name=\"${input:-$default}\""
}

open_url() {
  local url="$1"
  if command -v open &>/dev/null; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url"
  else
    warn "Could not open browser automatically."
    info "Please open this URL manually: ${BOLD}${url}${RESET}"
  fi
}

# -- State tracking -----------------------------------------------------------
STEPS_EXECUTED=()
STEPS_SKIPPED=()

step_done()    { STEPS_EXECUTED+=("$1"); success "$1"; }
step_skipped() { STEPS_SKIPPED+=("$1"); dim "Skipped: $1 (already configured)"; }

# -- .env helpers -------------------------------------------------------------
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
ENV_EXAMPLE="$(cd "$(dirname "$0")/.." && pwd)/.env.example"

env_get() {
  local key="$1"
  if [[ -f "$ENV_FILE" ]]; then
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-
  fi
}

env_has_real_value() {
  local key="$1"
  local val
  val="$(env_get "$key")"
  [[ -n "$val" && "$val" != *"_here"* && "$val" != "your_"* ]]
}

env_set() {
  local key="$1" value="$2"

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      info "Created .env from .env.example"
    else
      touch "$ENV_FILE"
      info "Created empty .env"
    fi
  fi

  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Use a temp file for portable sed in-place editing
    local tmp
    tmp="$(mktemp)"
    sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "$tmp" && mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# =============================================================================
# Phase 1: Prerequisites
# =============================================================================
header "Phase 1: Prerequisites"

if ! command -v gcloud &>/dev/null; then
  error "gcloud CLI is not installed."
  info "Install it from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi
success "gcloud CLI found"

ACCOUNT="$(gcloud config get-value account 2>/dev/null || true)"
if [[ -z "$ACCOUNT" || "$ACCOUNT" == "(unset)" ]]; then
  warn "No active gcloud account. Launching login..."
  gcloud auth login
  ACCOUNT="$(gcloud config get-value account 2>/dev/null)"
fi
success "Authenticated as ${BOLD}${ACCOUNT}${RESET}"

# =============================================================================
# Phase 2: Project setup
# =============================================================================
header "Phase 2: Google Cloud project"

prompt_default "Project ID" "thunkd" PROJECT_ID

if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  step_skipped "Create project '$PROJECT_ID'"
else
  info "Creating project ${BOLD}${PROJECT_ID}${RESET}..."
  gcloud projects create "$PROJECT_ID" --name="Thunkd"
  step_done "Created project '$PROJECT_ID'"
fi

gcloud config set project "$PROJECT_ID" 2>/dev/null
success "Active project: ${BOLD}${PROJECT_ID}${RESET}"

# Enable Gmail API (idempotent)
if gcloud services list --enabled --filter="config.name:gmail.googleapis.com" --format="value(config.name)" 2>/dev/null | grep -q gmail; then
  step_skipped "Enable Gmail API"
else
  info "Enabling Gmail API..."
  gcloud services enable gmail.googleapis.com
  step_done "Enabled Gmail API"
fi

# =============================================================================
# Phase 3: OAuth consent screen
# =============================================================================
header "Phase 3: OAuth consent screen"

ALL_IDS_SET=true
for key in EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID; do
  if ! env_has_real_value "$key"; then
    ALL_IDS_SET=false
    break
  fi
done

if $ALL_IDS_SET; then
  step_skipped "Configure OAuth consent screen (all client IDs already present)"
else
  CONSENT_URL="https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT_ID}"
  info "The OAuth consent screen must be configured in the Google Cloud Console."
  echo ""
  printf "  ${BOLD}App name:${RESET}               Thunkd\n"
  printf "  ${BOLD}User support email:${RESET}      %s\n" "$ACCOUNT"
  printf "  ${BOLD}Developer contact:${RESET}       %s\n" "$ACCOUNT"
  printf "  ${BOLD}User type:${RESET}               External\n"
  echo ""
  printf "  ${BOLD}Scopes to add:${RESET}\n"
  printf "    • openid\n"
  printf "    • https://www.googleapis.com/auth/userinfo.email\n"
  printf "    • https://www.googleapis.com/auth/userinfo.profile\n"
  printf "    • https://www.googleapis.com/auth/gmail.send\n"
  echo ""
  printf "  ${BOLD}Test users:${RESET}              %s\n" "$ACCOUNT"
  echo ""

  info "Opening Console..."
  open_url "$CONSENT_URL"
  echo ""
  printf "${YELLOW}→ Configure the consent screen, then press Enter to continue...${RESET}"
  read -r
  step_done "OAuth consent screen configured"
fi

# =============================================================================
# Phase 4: OAuth client IDs
# =============================================================================
header "Phase 4: OAuth client IDs"

CREDENTIALS_URL="https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"

# --- Web client ---
if env_has_real_value "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"; then
  step_skipped "Web client ID"
else
  info "Create a ${BOLD}Web application${RESET} OAuth client ID:"
  echo ""
  printf "  ${BOLD}Name:${RESET}                    Thunkd Web\n"
  printf "  ${BOLD}Authorized redirect URI:${RESET} https://auth.expo.io/@engtiagosilva/thunkd\n"
  echo ""
  info "Opening Credentials page..."
  open_url "$CREDENTIALS_URL"
  echo ""

  printf "${YELLOW}→ Paste the Web Client ID:${RESET} "
  read -r WEB_CLIENT_ID
  env_set "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" "$WEB_CLIENT_ID"

  printf "${YELLOW}→ Paste the Web Client Secret (or press Enter to skip):${RESET} "
  read -r WEB_CLIENT_SECRET
  if [[ -n "$WEB_CLIENT_SECRET" ]]; then
    env_set "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET" "$WEB_CLIENT_SECRET"
  fi

  step_done "Web client ID saved"
fi

# --- iOS client ---
if env_has_real_value "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"; then
  step_skipped "iOS client ID"
else
  info "Create an ${BOLD}iOS${RESET} OAuth client ID:"
  echo ""
  printf "  ${BOLD}Name:${RESET}       Thunkd iOS\n"
  printf "  ${BOLD}Bundle ID:${RESET}  com.tsilva.thunkd\n"
  echo ""

  if ! $ALL_IDS_SET; then
    # Console should already be open from web client step
    dim "(Credentials page should already be open)"
  fi
  echo ""

  printf "${YELLOW}→ Paste the iOS Client ID:${RESET} "
  read -r IOS_CLIENT_ID
  env_set "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" "$IOS_CLIENT_ID"
  step_done "iOS client ID saved"
fi

# --- Android client ---
if env_has_real_value "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"; then
  step_skipped "Android client ID"
else
  # Try to get SHA-1 automatically
  SHA1=""
  DEBUG_KEYSTORE="$HOME/.android/debug.keystore"
  if [[ -f "$DEBUG_KEYSTORE" ]]; then
    SHA1="$(keytool -list -v -keystore "$DEBUG_KEYSTORE" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep SHA1 | awk '{print $2}' || true)"
  fi

  info "Create an ${BOLD}Android${RESET} OAuth client ID:"
  echo ""
  printf "  ${BOLD}Name:${RESET}          Thunkd Android\n"
  printf "  ${BOLD}Package name:${RESET}  com.tsilva.thunkd\n"
  if [[ -n "$SHA1" ]]; then
    printf "  ${BOLD}SHA-1:${RESET}         %s  ${GREEN}(auto-detected from debug keystore)${RESET}\n" "$SHA1"
  else
    warn "Could not auto-detect SHA-1 fingerprint."
    info "Get it with: keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android"
    info "Or run: eas credentials -p android"
  fi
  echo ""

  printf "${YELLOW}→ Paste the Android Client ID:${RESET} "
  read -r ANDROID_CLIENT_ID
  env_set "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID" "$ANDROID_CLIENT_ID"
  step_done "Android client ID saved"
fi

# =============================================================================
# Phase 5: Summary
# =============================================================================
header "Summary"

if [[ ${#STEPS_EXECUTED[@]} -gt 0 ]]; then
  printf "${GREEN}Executed:${RESET}\n"
  for step in "${STEPS_EXECUTED[@]}"; do
    printf "  ${GREEN}✔${RESET} %s\n" "$step"
  done
  echo ""
fi

if [[ ${#STEPS_SKIPPED[@]} -gt 0 ]]; then
  printf "${DIM}Skipped (already configured):${RESET}\n"
  for step in "${STEPS_SKIPPED[@]}"; do
    printf "  ${DIM}– %s${RESET}\n" "$step"
  done
  echo ""
fi

success "Setup complete! Run ${BOLD}make start${RESET} to verify."
