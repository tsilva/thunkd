.PHONY: help install ci start start-clear ios android web lint typecheck check \
	build-preview-android build-preview-ios \
	build-production-android build-production-ios build-production \
	update-preview update-production icons clean setup setup-gcloud

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-28s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

ci: ## Clean install (CI-style)
	npm ci

start: ## Start Expo dev server
	npx expo start

start-clear: ## Start Expo dev server (cache cleared)
	npx expo start --clear

ios: ## Start on iOS simulator
	npx expo start --ios

android: ## Start on Android emulator
	npx expo start --android

web: ## Start web version
	npx expo start --web

lint: ## Run ESLint
	npx expo lint

typecheck: ## Run TypeScript type checking
	npx tsc --noEmit

check: lint typecheck ## Run lint + typecheck

build-preview-android: ## EAS build: Android preview APK
	eas build --platform android --profile preview

build-preview-ios: ## EAS build: iOS preview
	eas build --platform ios --profile preview

build-production-android: ## EAS build: Android production
	eas build --platform android --profile production

build-production-ios: ## EAS build: iOS production
	eas build --platform ios --profile production

build-production: ## EAS build: all platforms production
	eas build --platform all --profile production

update-preview: ## OTA update to preview (msg="description")
	eas update --branch preview --message "$(msg)"

update-production: ## OTA update to production (msg="description")
	eas update --branch production --message "$(msg)"

icons: ## Generate app icons
	node scripts/generate-icons.mjs

setup: setup-gcloud ## Set up Google Cloud project and OAuth credentials

setup-gcloud: ## Set up Google Cloud project and OAuth credentials
	./scripts/setup-gcloud.sh

clean: ## Remove node_modules, caches
	rm -rf node_modules .expo .eas web-build
