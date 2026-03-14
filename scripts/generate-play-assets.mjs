#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PLAY = resolve(ROOT, "assets", "google-play");
const SOURCES = resolve(PLAY, "sources");
const IMAGES = resolve(ROOT, "assets", "images");

const BRAND = {
  midnight: "#0B0F19",
  cobalt: "#2C58D6",
  cobaltDark: "#17306F",
  gold: "#F2C343",
  goldSoft: "#F7DA73",
  teal: "#57E7D8",
  ink: "#10203A",
  muted: "#58728F",
  surface: "#F7FAFF",
  stroke: "#D8E2EF",
};

const PLAY_SOURCES = {
  feature: resolve(SOURCES, "feature-background.png"),
  signin: resolve(SOURCES, "screen-background-01.png"),
  capture: resolve(SOURCES, "screen-background-02.png"),
  voice: resolve(SOURCES, "screen-background-03.png"),
  history: resolve(SOURCES, "screen-background-04.png"),
};

function dataUri(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function renderSvg(svg, width, height) {
  return sharp(Buffer.from(svg), { density: 240 }).resize(width, height).png().toBuffer();
}

async function cover(inputPath, width, height) {
  return sharp(inputPath).resize(width, height, { fit: "cover", position: "centre" }).png().toBuffer();
}

function escapeText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function wrapLines(text, maxLen) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLen) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function textBlock({
  x,
  y,
  text,
  fontSize,
  lineHeight,
  fill,
  weight = 700,
  letterSpacing = 0,
  maxLen = 26,
}) {
  const lines = wrapLines(text, maxLen);
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${letterSpacing}">${escapeText(line)}</text>`,
    )
    .join("");
}

function topCopy({ title, subtitle }) {
  return `
    ${textBlock({
      x: 96,
      y: 132,
      text: title,
      fontSize: 66,
      lineHeight: 74,
      fill: "#FFFFFF",
      maxLen: 22,
    })}
    ${textBlock({
      x: 96,
      y: 226,
      text: subtitle,
      fontSize: 28,
      lineHeight: 38,
      fill: "#D7E4FF",
      weight: 500,
      maxLen: 38,
    })}
  `;
}

function screenShell(inner) {
  return `
    <rect x="54" y="350" width="972" height="1498" rx="52" fill="${BRAND.surface}"/>
    <rect x="54" y="350" width="972" height="1498" rx="52" fill="none" stroke="${BRAND.stroke}" stroke-width="4"/>
    <rect x="54" y="350" width="972" height="96" rx="52" fill="#FFFFFF"/>
    <rect x="116" y="392" width="120" height="10" rx="5" fill="#D0D7E2"/>
    <circle cx="912" cy="398" r="6" fill="#D0D7E2"/>
    <circle cx="936" cy="398" r="6" fill="#D0D7E2"/>
    <circle cx="960" cy="398" r="6" fill="#D0D7E2"/>
    ${inner}
  `;
}

function signInUi(iconDataUri) {
  return screenShell(`
    <image href="${iconDataUri}" x="416" y="540" width="248" height="248"/>
    <text x="540" y="852" text-anchor="middle" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800">Thunkd</text>
    <text x="540" y="918" text-anchor="middle" fill="${BRAND.muted}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500">Capture thoughts, send to your inbox</text>
    <rect x="234" y="1042" width="612" height="96" rx="48" fill="#FFFFFF" stroke="#747775" stroke-width="3"/>
    <circle cx="314" cy="1090" r="16" fill="#4285F4"/>
    <circle cx="292" cy="1090" r="16" fill="#34A853"/>
    <circle cx="314" cy="1068" r="16" fill="#EA4335"/>
    <circle cx="336" cy="1090" r="16" fill="#FBBC05"/>
    <text x="564" y="1102" text-anchor="middle" fill="#1F1F1F" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="600">Sign in with Google</text>
    <text x="540" y="1240" text-anchor="middle" fill="#8A97A8" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">We only use Gmail to send thoughts to your own inbox</text>
  `);
}

function composeUi() {
  return screenShell(`
    <circle cx="930" cy="492" r="22" fill="#F2F4F8"/>
    <circle cx="930" cy="492" r="8" fill="#6A7280"/>
    <rect x="106" y="500" width="848" height="728" rx="28" fill="#FFFFFF"/>
    <text x="132" y="600" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">Need to follow up with Ana</text>
    <text x="132" y="664" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">about pricing tomorrow</text>
    <text x="132" y="728" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">and send the demo link.</text>
    <rect x="106" y="1268" width="144" height="144" rx="32" fill="#F0F0F0"/>
    <circle cx="178" cy="1340" r="26" fill="#444444"/>
    <rect x="286" y="1268" width="668" height="144" rx="32" fill="#000000"/>
    <text x="620" y="1360" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700">Send</text>
  `);
}

function voiceUi() {
  return screenShell(`
    <circle cx="930" cy="492" r="22" fill="#F2F4F8"/>
    <circle cx="930" cy="492" r="8" fill="#6A7280"/>
    <rect x="106" y="500" width="848" height="608" rx="28" fill="#FFFFFF"/>
    <rect x="106" y="1138" width="280" height="72" rx="36" fill="#FDEAEA"/>
    <circle cx="154" cy="1174" r="11" fill="#D40000"/>
    <text x="184" y="1186" fill="#8F1111" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">Recording...</text>
    <text x="132" y="610" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">Remember to email myself</text>
    <text x="132" y="674" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">the podcast idea about</text>
    <text x="132" y="738" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">weekend rituals and focus.</text>
    <rect x="106" y="1268" width="144" height="144" rx="32" fill="#D40000"/>
    <circle cx="178" cy="1340" r="26" fill="#FFFFFF"/>
    <rect x="286" y="1268" width="668" height="144" rx="32" fill="#000000"/>
    <text x="620" y="1360" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700">Send</text>
  `);
}

function historyUi() {
  return screenShell(`
    <circle cx="930" cy="492" r="22" fill="#F2F4F8"/>
    <circle cx="930" cy="492" r="8" fill="#6A7280"/>
    <rect x="106" y="500" width="848" height="380" rx="28" fill="#FFFFFF"/>
    <text x="132" y="602" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">Draft a weekend packing list</text>
    <text x="132" y="666" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="500">and send it to myself.</text>
    <rect x="106" y="920" width="848" height="392" rx="28" fill="#FAFAFA" stroke="#E5E5E5" stroke-width="3"/>
    <text x="132" y="990" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">Previously sent</text>
    <text x="846" y="990" text-anchor="end" fill="#777777" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500">3 this session</text>
    <text x="132" y="1068" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">Check hotel Wi-Fi before Friday</text>
    <text x="132" y="1112" fill="#777777" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500">09:14</text>
    <line x1="132" y1="1150" x2="928" y2="1150" stroke="#ECECEC" stroke-width="2"/>
    <text x="132" y="1220" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">Ask Marta about invoice copy</text>
    <text x="132" y="1264" fill="#777777" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500">08:52</text>
    <rect x="106" y="1360" width="144" height="144" rx="32" fill="#F0F0F0"/>
    <circle cx="178" cy="1432" r="26" fill="#444444"/>
    <rect x="286" y="1360" width="668" height="144" rx="32" fill="#000000"/>
    <text x="620" y="1452" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700">Send</text>
  `);
}

async function buildScreenshot({
  backgroundPath,
  title,
  subtitle,
  innerSvg,
  outputPath,
}) {
  const bg = await cover(backgroundPath, 1080, 1920);
  const overlay = await renderSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#06101F" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#06101F" stop-opacity="0.58"/>
        </linearGradient>
        <filter id="shadow" x="0" y="0" width="1080" height="1920">
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#04101F" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="1080" height="1920" fill="url(#scrim)"/>
      ${topCopy({ title, subtitle })}
      <g filter="url(#shadow)">
        ${innerSvg}
      </g>
    </svg>`,
    1080,
    1920,
  );

  const out = await sharp(bg).composite([{ input: overlay }]).png().toBuffer();
  await writeFile(outputPath, out);
}

async function buildFeatureGraphic(iconDataUri) {
  const bg = await cover(PLAY_SOURCES.feature, 1024, 500);
  const overlay = await renderSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#07111E" stop-opacity="0.78"/>
          <stop offset="0.58" stop-color="#07111E" stop-opacity="0.46"/>
          <stop offset="1" stop-color="#07111E" stop-opacity="0.14"/>
        </linearGradient>
        <filter id="cardShadow" x="0" y="0" width="1024" height="500">
          <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#020A14" flood-opacity="0.28"/>
        </filter>
      </defs>
      <rect width="1024" height="500" fill="url(#scrim)"/>
      <text x="72" y="176" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="800" letter-spacing="-2">thunkd</text>
      <text x="72" y="230" fill="#D7E4FF" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="3">CAPTURE THE THOUGHT. SEND THE THOUGHT.</text>
      <text x="72" y="292" fill="#B8C9E2" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">Voice or type the idea.</text>
      <text x="72" y="328" fill="#B8C9E2" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">Send it straight to your inbox.</text>
      <rect x="72" y="390" width="160" height="10" rx="5" fill="${BRAND.gold}"/>
      <circle cx="252" cy="395" r="6" fill="${BRAND.teal}"/>
      <g filter="url(#cardShadow)">
        <rect x="676" y="60" width="276" height="372" rx="34" fill="${BRAND.surface}"/>
        <rect x="676" y="60" width="276" height="372" rx="34" fill="none" stroke="${BRAND.stroke}" stroke-width="3"/>
        <image href="${iconDataUri}" x="706" y="90" width="68" height="68"/>
        <text x="790" y="134" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800">Thunkd</text>
        <text x="706" y="192" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500">Need to send myself</text>
        <text x="706" y="222" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500">the investor update</text>
        <text x="706" y="252" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500">notes before lunch.</text>
        <rect x="706" y="308" width="56" height="56" rx="16" fill="#F0F0F0"/>
        <circle cx="734" cy="336" r="9" fill="#444444"/>
        <rect x="782" y="308" width="138" height="56" rx="16" fill="#000000"/>
        <text x="851" y="344" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">Send</text>
      </g>
    </svg>`,
    1024,
    500,
  );

  await writeFile(resolve(PLAY, "feature-graphic-1024x500.png"), await sharp(bg).composite([{ input: overlay }]).png().toBuffer());
}

async function buildAssets() {
  await mkdir(PLAY, { recursive: true });

  const iconBuffer = await readFile(resolve(IMAGES, "icon.png"));
  const iconDataUri = dataUri(await sharp(iconBuffer).resize(256, 256).png().toBuffer());

  await writeFile(
    resolve(PLAY, "play-store-icon-512.png"),
    await sharp(iconBuffer).resize(512, 512).png().toBuffer(),
  );

  await buildFeatureGraphic(iconDataUri);

  await buildScreenshot({
    backgroundPath: PLAY_SOURCES.signin,
    title: "Start capturing in seconds",
    subtitle: "Google sign-in, one screen, one inbox.",
    innerSvg: signInUi(iconDataUri),
    outputPath: resolve(PLAY, "phone-screenshot-01-signin-1080x1920.png"),
  });

  await buildScreenshot({
    backgroundPath: PLAY_SOURCES.capture,
    title: "Type the thought. Tap Send.",
    subtitle: "Open the app and email the idea to yourself.",
    innerSvg: composeUi(),
    outputPath: resolve(PLAY, "phone-screenshot-02-compose-1080x1920.png"),
  });

  await buildScreenshot({
    backgroundPath: PLAY_SOURCES.voice,
    title: "Hold to record ideas fast",
    subtitle: "Voice capture transcribes in real time.",
    innerSvg: voiceUi(),
    outputPath: resolve(PLAY, "phone-screenshot-03-voice-1080x1920.png"),
  });

  await buildScreenshot({
    backgroundPath: PLAY_SOURCES.history,
    title: "Check what already landed",
    subtitle: "A lightweight history confirms what you sent.",
    innerSvg: historyUi(),
    outputPath: resolve(PLAY, "phone-screenshot-04-history-1080x1920.png"),
  });
}

buildAssets().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
