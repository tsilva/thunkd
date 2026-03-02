#!/usr/bin/env node

/**
 * Generate app icons for Mobile Capture using OpenRouter + Gemini image generation.
 *
 * Usage:
 *   OPENROUTER_API_KEY=or-... node scripts/generate-icons.mjs
 *
 * Generates:
 *   assets/images/icon.png          – 1024x1024, App Store icon (rounded corners, transparent)
 *   assets/images/adaptive-icon.png – 1024x1024, Android adaptive icon foreground (rounded corners, transparent)
 *   assets/images/splash-icon.png   – 512x512,   Splash screen logo (rounded corners, transparent)
 *   assets/images/favicon.png       – 48x48,     Web favicon (rounded corners, transparent)
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

const ICON_PROMPT = `Generate a striking, premium app icon for "thunkd" — a thought-capture app.
The name "thunkd" means a thought just hit you, like a lightning bolt of inspiration.

Design concept:
- A bold, stylized lightning bolt striking into a thought bubble — the moment an idea lands
- The lightning bolt should feel electric and alive, cutting diagonally through the icon
- Background: rich deep purple-to-black gradient, moody and premium
- Lightning bolt: electric bright yellow-gold (#FFD700) with a subtle white-hot core glow
- Thought bubble: subtle, translucent, ghostly white outline — not the main focus, just framing the bolt
- Style: sleek, high-contrast, dramatic — like a premium creative tool, NOT a generic corporate app
- No text, no letters, no words
- Square canvas, fills the entire frame edge to edge
- Should look incredible at small sizes on a phone home screen
- Think Notion meets Discord aesthetic — dark, bold, iconic

CRITICAL rendering instructions:
- Draw the icon design inside a large rounded rectangle with ~22% corner radius (iOS-style superellipse corners)
- Fill ALL areas OUTSIDE the rounded rectangle with solid bright green #00FF00
- The green must be pure #00FF00 — no gradients, no antialiasing bleed from green into the design
- The corners of the square canvas should be solid #00FF00 green
- The design itself must NOT contain any green (#00FF00) colors`;

const ADAPTIVE_PROMPT = `Generate an Android adaptive icon foreground layer for "thunkd" — a thought-capture app.

Design concept:
- Same identity: a bold stylized lightning bolt striking into a thought bubble
- Lightning bolt: electric bright yellow-gold (#FFD700) with white-hot core
- Thought bubble: subtle translucent white outline framing the bolt
- Center the design within the inner 66% of the canvas (Android crops outer edges)
- No text, no letters, no words
- Dramatic, high-contrast, sleek
- Should be instantly recognizable at small sizes

CRITICAL rendering instructions:
- Draw the icon design inside a large rounded rectangle with ~22% corner radius (iOS-style superellipse corners)
- Fill ALL areas OUTSIDE the rounded rectangle with solid bright green #00FF00
- The green must be pure #00FF00 — no gradients, no antialiasing bleed from green into the design
- The corners of the square canvas should be solid #00FF00 green
- The design itself must NOT contain any green (#00FF00) colors`;

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

async function chromakeyToTransparent(inputBuffer, tolerance = 70) {
  // Convert bright green (#00FF00) pixels to transparent using sharp's raw pixel access
  try {
    const sharp = await import("sharp");
    const image = sharp.default(inputBuffer).ensureAlpha();
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const pixels = Buffer.from(data);

    // Target color: #00FF00
    const keyR = 0, keyG = 255, keyB = 0;

    for (let i = 0; i < width * height; i++) {
      const off = i * channels;
      const r = pixels[off];
      const g = pixels[off + 1];
      const b = pixels[off + 2];

      // Color distance from chromakey green
      const dist = Math.sqrt(
        (r - keyR) ** 2 + (g - keyG) ** 2 + (b - keyB) ** 2
      );

      if (dist < tolerance * 0.6) {
        // Fully transparent — well within tolerance
        pixels[off + 3] = 0;
      } else if (dist < tolerance) {
        // Graduated alpha at edges to avoid halo
        const alpha = Math.round(255 * ((dist - tolerance * 0.6) / (tolerance * 0.4)));
        pixels[off + 3] = Math.min(pixels[off + 3], alpha);
      }
      // else: leave pixel unchanged
    }

    return await sharp
      .default(pixels, { raw: { width, height, channels } })
      .png()
      .toBuffer();
  } catch {
    // Fallback: write temp file and use ImageMagick if available
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { readFile: rf } = await import("node:fs/promises");
    const { execSync } = await import("node:child_process");

    const tmpIn = join(tmpdir(), `chromakey-in-${Date.now()}.png`);
    const tmpOut = join(tmpdir(), `chromakey-out-${Date.now()}.png`);

    await writeFile(tmpIn, inputBuffer);
    try {
      execSync(
        `magick "${tmpIn}" -fuzz ${tolerance}% -transparent "#00FF00" "${tmpOut}"`,
        { stdio: "pipe" }
      );
      const result = await rf(tmpOut);
      await Promise.allSettled([
        import("node:fs/promises").then((fs) => fs.unlink(tmpIn)),
        import("node:fs/promises").then((fs) => fs.unlink(tmpOut)),
      ]);
      return result;
    } catch {
      // Last resort: return as-is
      console.warn("  Warning: could not remove chromakey (sharp and ImageMagick unavailable)");
      await import("node:fs/promises").then((fs) => fs.unlink(tmpIn).catch(() => {}));
      return inputBuffer;
    }
  }
}

async function main() {
  await mkdir(ASSETS, { recursive: true });

  // --- Step 1: Generate main icon ---
  console.log("\n[1/2] Generating main app icon...");
  const iconBuffer = await generateImage(ICON_PROMPT);
  console.log(`  Got ${(iconBuffer.length / 1024).toFixed(0)} KB image`);

  // Save icon.png at 1024x1024 with rounded transparent corners
  const icon1024 = await resizeWithCanvas(iconBuffer, 1024, 1024);
  const iconTransparent = await chromakeyToTransparent(icon1024);
  await writeFile(resolve(ASSETS, "icon.png"), iconTransparent);
  console.log("  -> assets/images/icon.png (1024x1024)");

  // Derive splash-icon.png at 512x512
  const splash = await resizeWithCanvas(iconBuffer, 512, 512);
  const splashTransparent = await chromakeyToTransparent(splash);
  await writeFile(resolve(ASSETS, "splash-icon.png"), splashTransparent);
  console.log("  -> assets/images/splash-icon.png (512x512)");

  // Derive favicon.png at 48x48
  const favicon = await resizeWithCanvas(iconBuffer, 48, 48);
  const faviconTransparent = await chromakeyToTransparent(favicon);
  await writeFile(resolve(ASSETS, "favicon.png"), faviconTransparent);
  console.log("  -> assets/images/favicon.png (48x48)");

  // --- Step 2: Generate adaptive icon ---
  console.log("\n[2/2] Generating Android adaptive icon...");
  const adaptiveBuffer = await generateImage(ADAPTIVE_PROMPT);
  console.log(`  Got ${(adaptiveBuffer.length / 1024).toFixed(0)} KB image`);

  const adaptive1024 = await resizeWithCanvas(adaptiveBuffer, 1024, 1024);
  const adaptiveTransparent = await chromakeyToTransparent(adaptive1024);
  await writeFile(resolve(ASSETS, "adaptive-icon.png"), adaptiveTransparent);
  console.log("  -> assets/images/adaptive-icon.png (1024x1024)");

  console.log("\nDone! All icons generated in assets/images/");
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
