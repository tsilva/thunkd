#!/usr/bin/env node

/**
 * Rebuild app assets from the checked-in Gemini-generated source images.
 *
 * Source images are expected at:
 *   assets/branding/icon-source.png
 *   assets/branding/adaptive-source.png
 *
 * They were generated with OpenRouter's `google/gemini-3.1-flash-image-preview`
 * model, then normalized locally into the platform assets used by Expo.
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BRANDING = resolve(ROOT, "assets", "branding");
const IMAGES = resolve(ROOT, "assets", "images");
const ICON_SOURCE = resolve(BRANDING, "icon-source.png");
const ADAPTIVE_SOURCE = resolve(BRANDING, "adaptive-source.png");

function neutralToTransparent(data, info, minAverage, maxSpread) {
  const output = Buffer.from(data);

  for (let index = 0; index < output.length; index += info.channels) {
    const r = output[index];
    const g = output[index + 1];
    const b = output[index + 2];
    const a = output[index + 3] ?? 255;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const average = (r + g + b) / 3;

    if (a > 0 && average >= minAverage && spread <= maxSpread) {
      output[index + 3] = 0;
    }
  }

  return output;
}

async function cleanNeutralBackground(inputPath, minAverage, maxSpread) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = neutralToTransparent(data, info, minAverage, maxSpread);
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

async function buildAppIcon() {
  const cleaned = await cleanNeutralBackground(ICON_SOURCE, 236, 20);

  return sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: "#05081B",
    },
  })
    .composite([{ input: cleaned }])
    .png()
    .toBuffer();
}

async function buildAdaptiveForeground() {
  return cleanNeutralBackground(ADAPTIVE_SOURCE, 184, 30);
}

async function buildMonochromeIcon(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.from(data);

  for (let index = 0; index < output.length; index += info.channels) {
    const alpha = output[index + 3] ?? 255;
    output[index] = 0;
    output[index + 1] = 0;
    output[index + 2] = 0;
    output[index + 3] = alpha > 0 ? 255 : 0;
  }

  return sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function buildLogo(iconBuffer) {
  const shell = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560">
      <rect x="40" y="60" width="1520" height="440" rx="220" fill="#F5F8FD"/>
      <rect x="40" y="60" width="1520" height="440" rx="220" fill="none" stroke="#D8E2EF" stroke-width="6"/>
      <text
        x="470"
        y="286"
        fill="#10203A"
        font-family="Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="188"
        font-weight="800"
        letter-spacing="-5"
      >thunkd</text>
      <text
        x="480"
        y="364"
        fill="#4E6A85"
        font-family="Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="40"
        font-weight="600"
        letter-spacing="5"
      >CAPTURE THE THOUGHT. SEND THE THOUGHT.</text>
      <rect x="481" y="395" width="232" height="14" rx="7" fill="#2C58D6"/>
      <circle cx="738" cy="402" r="7" fill="#F2C343"/>
    </svg>
  `);

  const badge = await sharp(iconBuffer).resize(300, 300).png().toBuffer();
  const base = await sharp(shell).png().toBuffer();

  return sharp(base)
    .composite([{ input: badge, left: 110, top: 130 }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(IMAGES, { recursive: true });
  await mkdir(BRANDING, { recursive: true });

  const icon = await buildAppIcon();
  const adaptive = await buildAdaptiveForeground();
  const monochrome = await buildMonochromeIcon(adaptive);
  const splash = await sharp(adaptive).resize(512, 512).png().toBuffer();
  const favicon = await sharp(icon).resize(48, 48).png().toBuffer();
  const logo = await buildLogo(icon);

  await writeFile(resolve(IMAGES, "icon.png"), icon);
  console.log(`-> App icon: ${resolve(IMAGES, "icon.png")}`);

  await writeFile(resolve(IMAGES, "adaptive-icon.png"), adaptive);
  console.log(`-> Android adaptive foreground: ${resolve(IMAGES, "adaptive-icon.png")}`);

  await writeFile(resolve(IMAGES, "adaptive-icon-monochrome.png"), monochrome);
  console.log(
    `-> Android adaptive monochrome: ${resolve(IMAGES, "adaptive-icon-monochrome.png")}`,
  );

  await writeFile(resolve(IMAGES, "splash-icon.png"), splash);
  console.log(`-> Splash mark: ${resolve(IMAGES, "splash-icon.png")}`);

  await writeFile(resolve(IMAGES, "favicon.png"), favicon);
  console.log(`-> Favicon: ${resolve(IMAGES, "favicon.png")}`);

  await writeFile(resolve(ROOT, "logo.png"), logo);
  console.log(`-> README logo: ${resolve(ROOT, "logo.png")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
