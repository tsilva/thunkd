#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PLAY = resolve(ROOT, "assets", "google-play");
const RAW = resolve(PLAY, "raw");
const IMAGES = resolve(ROOT, "assets", "images");
const BRANDING = resolve(ROOT, "assets", "branding");
const README_LOGO = resolve(ROOT, "logo.png");

const BRAND = {
  midnight: "#07152B",
  midnightSoft: "#11254B",
  cobalt: "#76A4FF",
  cobaltDeep: "#3B6EE8",
  amber: "#E3AF2A",
  amberSoft: "#FFD76B",
  mist: "#DCE8FF",
};

const LOGO_SOURCE = resolve(BRANDING, "logo-source.png");
const ICON_SOURCE = resolve(BRANDING, "icon-source.png");

function dataUri(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function renderSvg(svg, width, height) {
  return sharp(Buffer.from(svg), { density: 240 }).resize(width, height).png().toBuffer();
}

async function cover(inputPath, width, height) {
  return sharp(inputPath)
    .flatten({ background: "#FFFFFF" })
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

function removeGreenKey(data, info) {
  const output = Buffer.from(data);

  for (let index = 0; index < output.length; index += info.channels) {
    const r = output[index];
    const g = output[index + 1];
    const b = output[index + 2];
    const a = output[index + 3] ?? 255;
    const greenDominance = g - Math.max(r, b);
    const looksLikeKey = g >= 150 && r <= 120 && b <= 120 && greenDominance >= 40;

    if (a > 0 && looksLikeKey) {
      output[index + 3] = 0;
      continue;
    }

    if (a > 0 && greenDominance >= 18) {
      output[index + 1] = Math.max(r, b);
    }
  }

  return output;
}

async function loadSource(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = removeGreenKey(data, info);
  return sharp(cleaned, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function assertExists(path, description) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing ${description}: ${path}`);
  }
}

const SCREENSHOTS = [
  {
    input: resolve(RAW, "empty-compose.png"),
    output: resolve(PLAY, "phone-screenshot-01-home-empty-1080x1920.png"),
  },
  {
    input: resolve(RAW, "compose.png"),
    output: resolve(PLAY, "phone-screenshot-02-compose-1080x1920.png"),
  },
  {
    input: resolve(RAW, "settings.png"),
    output: resolve(PLAY, "phone-screenshot-03-settings-1080x1920.png"),
  },
  {
    input: resolve(RAW, "history.png"),
    output: resolve(PLAY, "phone-screenshot-04-history-1080x1920.png"),
  },
];

async function finalizeScreenshot(inputPath, outputPath) {
  const image = await cover(inputPath, 1080, 1920);
  await writeFile(outputPath, image);
}

async function buildFeatureGraphic() {
  const logo = await readFile(README_LOGO);
  const logoDataUri = dataUri(
    await sharp(logo).resize(720, 252, { fit: "contain" }).png().toBuffer(),
  );
  const icon = await loadSource(ICON_SOURCE);
  const iconDataUri = dataUri(
    await sharp(icon).resize(190, 190, { fit: "contain" }).png().toBuffer(),
  );
  const overlay = await renderSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${BRAND.midnight}"/>
          <stop offset="0.55" stop-color="${BRAND.midnightSoft}"/>
          <stop offset="1" stop-color="#0B1B36"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.52" cy="0.3" r="0.48">
          <stop offset="0" stop-color="${BRAND.cobalt}" stop-opacity="0.34"/>
          <stop offset="1" stop-color="${BRAND.cobalt}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#bg)"/>
      <rect width="1024" height="500" fill="url(#glow)"/>
      <path d="M-32 86 C78 10, 184 14, 280 90 S496 170, 596 106" fill="none" stroke="${BRAND.cobalt}" stroke-width="18" stroke-linecap="round" opacity="0.22"/>
      <path d="M768 418 C854 350, 930 344, 1058 426" fill="none" stroke="${BRAND.amber}" stroke-width="20" stroke-linecap="round" opacity="0.2"/>
      <path d="M736 -8 C860 46, 958 36, 1058 -24" fill="none" stroke="${BRAND.mist}" stroke-width="14" stroke-linecap="round" opacity="0.14"/>
      <image href="${iconDataUri}" x="72" y="58" width="124" height="124" opacity="0.9"/>
      <image href="${iconDataUri}" x="842" y="292" width="118" height="118" opacity="0.14"/>
      <image href="${logoDataUri}" x="152" y="118" width="720" height="252"/>
      <rect x="246" y="418" width="478" height="8" rx="4" fill="${BRAND.cobaltDeep}" opacity="0.8"/>
      <circle cx="748" cy="422" r="8" fill="${BRAND.amberSoft}" opacity="0.95"/>
    </svg>`,
    1024,
    500,
  );

  await writeFile(resolve(PLAY, "feature-graphic-1024x500.png"), overlay);
}

async function buildAssets() {
  await mkdir(PLAY, { recursive: true });

  await assertExists(resolve(IMAGES, "icon.png"), "generated Expo app icon");
  await assertExists(LOGO_SOURCE, "canonical logo source");
  await assertExists(ICON_SOURCE, "canonical icon source");

  const iconBuffer = await readFile(resolve(IMAGES, "icon.png"));

  await writeFile(
    resolve(PLAY, "play-store-icon-512.png"),
    await sharp(iconBuffer).resize(512, 512).png().toBuffer(),
  );

  await buildFeatureGraphic();

  for (const screenshot of SCREENSHOTS) {
    await assertExists(
      screenshot.input,
      `raw Play screenshot (${screenshot.input.split("/").pop()})`,
    );
    await finalizeScreenshot(screenshot.input, screenshot.output);
  }
}

buildAssets().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
