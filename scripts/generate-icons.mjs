#!/usr/bin/env node

/**
 * Rebuild app assets from the checked-in canonical brand sources.
 *
 * Source images are expected at:
 *   assets/branding/icon-source.png
 *   assets/branding/logo-source.png
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BRANDING = resolve(ROOT, "assets", "branding");
const IMAGES = resolve(ROOT, "assets", "images");
const ICON_SOURCE = resolve(BRANDING, "icon-source.png");
const MIDNIGHT = "#07152B";

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

async function composeSquareIcon(sourceBuffer, { size, padding, background }) {
  const inset = Math.round(size * (1 - padding * 2));
  const symbol = await sharp(sourceBuffer).resize(inset, inset, { fit: "contain" }).png().toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: symbol,
        left: Math.round((size - inset) / 2),
        top: Math.round((size - inset) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function buildAdaptiveForeground() {
  const cleaned = await loadSource(ICON_SOURCE);
  return composeSquareIcon(cleaned, {
    size: 1024,
    padding: 0.12,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
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

async function buildLogo(sourceIcon) {
  const badge = await composeSquareIcon(sourceIcon, {
    size: 320,
    padding: 0.16,
    background: MIDNIGHT,
  });

  const shell = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560">
      <text
        x="458"
        y="288"
        fill="#EEF4FF"
        font-family="Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="204"
        font-weight="800"
        letter-spacing="-6"
      >Thunkd</text>
      <rect x="462" y="346" width="214" height="14" rx="7" fill="#4B79EE"/>
      <circle cx="700" cy="353" r="7" fill="#FFD76B"/>
    </svg>
  `);

  const base = await sharp(shell).png().toBuffer();

  return sharp({
    create: {
      width: 1600,
      height: 560,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: badge, left: 96, top: 120 },
      { input: base, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(IMAGES, { recursive: true });
  await mkdir(BRANDING, { recursive: true });

  const sourceIcon = await loadSource(ICON_SOURCE);
  const icon = await composeSquareIcon(sourceIcon, {
    size: 1024,
    padding: 0.17,
    background: MIDNIGHT,
  });
  const adaptive = await buildAdaptiveForeground();
  const monochrome = await buildMonochromeIcon(adaptive);
  const splash = await composeSquareIcon(sourceIcon, {
    size: 512,
    padding: 0.18,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const favicon = await sharp(icon).resize(48, 48).png().toBuffer();
  const logo = await buildLogo(sourceIcon);

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
