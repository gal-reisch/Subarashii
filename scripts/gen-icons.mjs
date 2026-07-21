// Render app icons: a pink-to-cream gradient rounded square with the
// flower/daisy graphic from the user's Figma "App Icon" frame (task #24)
// composited on top. Source asset: scripts/assets/app-icon-source.png
// (downloaded from the Figma MCP asset endpoint — if that URL ever expires
// and this needs re-running from scratch, re-fetch the "App Icon" node's
// image via the Figma MCP and overwrite that file).
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

mkdirSync("public/icons", { recursive: true });

const ASSET_PATH = fileURLToPath(new URL("./assets/app-icon-source.png", import.meta.url));

// Rounded-square gradient background, pink (top) -> cream (bottom), corner
// radius scaled to iOS/Android icon conventions (~22% of size).
const backgroundSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4a6d2"/>
      <stop offset="100%" stop-color="#fcfdf7"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="${Math.round(size * 0.22)}" fill="url(#g)"/>
</svg>`;

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

for (const [file, size] of targets) {
  const flowerWidth = Math.round(size * 0.62);
  const flower = await sharp(ASSET_PATH).resize({ width: flowerWidth }).toBuffer();
  await sharp(Buffer.from(backgroundSvg(size)))
    .composite([{ input: flower, gravity: "center" }])
    .png()
    .toFile(file);
  console.log("wrote", file);
}
