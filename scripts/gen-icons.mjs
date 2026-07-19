// One-off: render placeholder app icons (persimmon tile with an "S").
// Real icon art is deferred per the owner. Re-run after replacing the art.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="#d9743b"/>
  <text x="50%" y="53%" font-family="Georgia, 'Times New Roman', serif"
        font-size="${Math.round(size * 0.62)}" font-weight="700" fill="#fbf7f0"
        text-anchor="middle" dominant-baseline="central">S</text>
</svg>`;

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

for (const [file, size] of targets) {
  await sharp(Buffer.from(svg(size))).png().toFile(file);
  console.log("wrote", file);
}
