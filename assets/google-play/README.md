# Google Play Assets

Generated listing assets:

- `play-store-icon-512.png` — Main store listing icon (`512x512`)
- `feature-graphic-1024x500.png` — Feature graphic (`1024x500`)
- `phone-screenshot-01-home-empty-1080x1920.png` — Empty capture screen
- `phone-screenshot-02-compose-1080x1920.png` — Phone screenshot
- `phone-screenshot-03-settings-1080x1920.png` — Settings screen
- `phone-screenshot-04-history-1080x1920.png` — Phone screenshot

Canonical brand sources:

- `../branding/logo-source.png`
- `../branding/icon-source.png`

Raw app captures used for the screenshots:

- `raw/empty-compose.png`
- `raw/compose.png`
- `raw/settings.png`
- `raw/history.png`

The final screenshots are resized from real in-app captures. They intentionally avoid device frames and invented mock UI so the Play listing reflects the actual product.

Rebuild with:

```bash
make icons
make play-assets
```
