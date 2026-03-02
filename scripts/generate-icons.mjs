#!/usr/bin/env node

/**
 * Generate app icons for Mobile Capture using OpenRouter + Gemini image generation.
 *
 * Usage:
 *   OPENROUTER_API_KEY=or-... node scripts/generate-icons.mjs
 *
 * Generates:
 *   assets/images/icon.png          – 1024x1024, App Store icon (no transparency)
 *   assets/images/adaptive-icon.png – 1024x1024, Android adaptive icon foreground
 *   assets/images/splash-icon.png   – 512x512,   Splash screen logo
 *   assets/images/favicon.png       – 48x48,     Web favicon
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ASSETS = resolve(ROOT, "assets", "images");

// Load .env file
try {
  const envContent = await readFile(resolve(ROOT, ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable is required.");
  process.exit(1);
}

const MODEL = "google/gemini-3.1-flash-image-preview";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const ICON_PROMPT = `Generate a modern, minimalist app icon for a mobile app called "thunkd".
The app lets users quickly capture thoughts via voice or text and email them to themselves.

Design requirements:
- Clean, bold, instantly recognizable at small sizes
- Use a simple icon/symbol: a stylized speech bubble combined with a small microphone motif
- Color palette: deep indigo/navy (#1a1a2e) background with a bright accent (white or soft cyan glow)
- Flat design, no gradients, no text, no letters
- Square canvas, fill the frame
- Professional, modern, suitable for the iOS App Store
- No rounded corners (iOS adds them automatically)
- No transparency — solid background filling the entire square`;

const ADAPTIVE_PROMPT = `Generate a modern, minimalist Android adaptive icon foreground layer for an app called "thunkd".
The app lets users quickly capture thoughts via voice or text and email them to themselves.

Design requirements:
- Same visual identity: a stylized speech bubble combined with a small microphone motif
- Color palette: deep indigo/navy symbol with bright white or soft cyan accent
- TRANSPARENT background (this is the foreground layer only — the background color is white)
- Center the icon in the inner 66% of the canvas (Android crops the outer edges into circles/squircles)
- Flat design, no gradients, no text, no letters
- Professional, clean, instantly recognizable at small sizes`;

async function generateImage(prompt) {
  console.log("  Calling Gemini...");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: "1:1",
        image_size: "1K",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error(`No choices in response: ${JSON.stringify(data)}`);
  }

  // Extract base64 image from the response
  // Images can be in choice.message.images[] or inline in content as multipart
  const images = choice.message?.images;
  if (images?.length > 0) {
    const url = images[0].image_url?.url ?? images[0].url;
    if (url) return extractBase64(url);
  }

  // Some models return images inline in content array
  const content = choice.message?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "image_url") {
        const url = part.image_url?.url ?? part.url;
        if (url) return extractBase64(url);
      }
    }
  }

  // Try parsing base64 from string content
  if (typeof content === "string" && content.includes("data:image")) {
    return extractBase64(content);
  }

  throw new Error(
    `Could not find image in response: ${JSON.stringify(choice.message, null, 2).slice(0, 500)}`
  );
}

function extractBase64(dataUrl) {
  const match = dataUrl.match(
    /data:image\/(png|jpeg|webp);base64,(.+)/s
  );
  if (match) return Buffer.from(match[2], "base64");
  // If it's raw base64 without prefix
  if (/^[A-Za-z0-9+/]+=*$/.test(dataUrl.trim())) {
    return Buffer.from(dataUrl.trim(), "base64");
  }
  throw new Error("Could not extract base64 image data");
}

async function resizeWithCanvas(inputBuffer, width, height) {
  // Use sharp if available, otherwise fall back to sips (macOS built-in)
  try {
    const sharp = await import("sharp");
    return await sharp
      .default(inputBuffer)
      .resize(width, height, { fit: "cover" })
      .png()
      .toBuffer();
  } catch {
    // Fallback: write to temp file, use sips, read back
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { readFile } = await import("node:fs/promises");
    const { execSync } = await import("node:child_process");

    const tmpIn = join(tmpdir(), `icon-resize-in-${Date.now()}.png`);
    const tmpOut = join(tmpdir(), `icon-resize-out-${Date.now()}.png`);

    await writeFile(tmpIn, inputBuffer);
    execSync(`sips -z ${height} ${width} "${tmpIn}" --out "${tmpOut}"`, {
      stdio: "pipe",
    });
    const result = await readFile(tmpOut);

    // Clean up temp files
    await Promise.allSettled([
      import("node:fs/promises").then((fs) => fs.unlink(tmpIn)),
      import("node:fs/promises").then((fs) => fs.unlink(tmpOut)),
    ]);

    return result;
  }
}

async function removeTransparency(inputBuffer) {
  // Flatten onto white background to remove alpha channel
  try {
    const sharp = await import("sharp");
    return await sharp
      .default(inputBuffer)
      .flatten({ background: { r: 26, g: 26, b: 46 } }) // #1a1a2e
      .png()
      .toBuffer();
  } catch {
    return inputBuffer; // sips doesn't easily remove transparency; return as-is
  }
}

async function main() {
  await mkdir(ASSETS, { recursive: true });

  // --- Step 1: Generate main icon ---
  console.log("\n[1/2] Generating main app icon...");
  const iconBuffer = await generateImage(ICON_PROMPT);
  console.log(`  Got ${(iconBuffer.length / 1024).toFixed(0)} KB image`);

  // Save icon.png at 1024x1024 (resize if needed, ensure no transparency)
  const icon1024 = await resizeWithCanvas(iconBuffer, 1024, 1024);
  const iconFlat = await removeTransparency(icon1024);
  await writeFile(resolve(ASSETS, "icon.png"), iconFlat);
  console.log("  -> assets/images/icon.png (1024x1024)");

  // Derive splash-icon.png at 512x512
  const splash = await resizeWithCanvas(iconFlat, 512, 512);
  await writeFile(resolve(ASSETS, "splash-icon.png"), splash);
  console.log("  -> assets/images/splash-icon.png (512x512)");

  // Derive favicon.png at 48x48
  const favicon = await resizeWithCanvas(iconFlat, 48, 48);
  await writeFile(resolve(ASSETS, "favicon.png"), favicon);
  console.log("  -> assets/images/favicon.png (48x48)");

  // --- Step 2: Generate adaptive icon ---
  console.log("\n[2/2] Generating Android adaptive icon...");
  const adaptiveBuffer = await generateImage(ADAPTIVE_PROMPT);
  console.log(`  Got ${(adaptiveBuffer.length / 1024).toFixed(0)} KB image`);

  const adaptive1024 = await resizeWithCanvas(adaptiveBuffer, 1024, 1024);
  await writeFile(resolve(ASSETS, "adaptive-icon.png"), adaptive1024);
  console.log("  -> assets/images/adaptive-icon.png (1024x1024)");

  console.log("\nDone! All icons generated in assets/images/");
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
