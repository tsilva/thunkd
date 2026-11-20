<p align="center">
  <img src="./logo.png" alt="thunkd" width="256" />
  <br />
  <!-- repo-tagline:start -->
  <strong>⚡ Capture thoughts instantly and send them straight to your inbox 💭</strong>
  <!-- repo-tagline:end -->
</p>

Thunkd is a one-screen app for capturing a thought by typing or speaking.
Its intended delivery target is your own Gmail inbox.

## Try it

Live Google sign-in is temporarily disabled. Use mock mode to try the
capture and send flow without sending email. From a checkout:

```bash
pnpm install --frozen-lockfile
EXPO_PUBLIC_USE_MOCK_SERVICES=1 pnpm start
```

Open the QR code in Expo Go or use the emulator shortcuts printed by Expo.
Type a thought and send it to see a mock result. Native speech recognition
requires a development build. The queue and sent history last for the current
app session.

See [development](docs/development.md) for native builds and checks, and
[Google Cloud setup](docs/google-cloud-setup.md) for the sign-in boundary.

## License

[MIT License](LICENSE).
