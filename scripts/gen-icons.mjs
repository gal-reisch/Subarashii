// Render the app icons from the artwork in the user's Figma file
// ("Subarashii", frame 1521:1095 "App Icon"): a pink-to-cream gradient square
// with the 3D daisy on it.
//
// The source here is the icon exactly as drawn, not a reconstruction. An
// earlier pass composited a separate flower cut-out over a gradient this
// script drew itself, and the cut-out turned out to be the *perspective*
// version of the daisy from elsewhere on the canvas — flattened to about 3:2
// and floated small in the middle of a gradient that wasn't the designed one.
// So: take the frame's own render and change as little as possible.
//
// To re-pull it after a design change, export the frame as PNG at scale 4
// (Figma's export API caps there, which puts the icon square at 600×600),
// crop the square off its white presentation mat, and overwrite
// scripts/assets/app-icon-source.png.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = fileURLToPath(new URL("./assets/app-icon-source.png", import.meta.url));

// Full-bleed, no rounding. The Figma artwork is drawn with a gentle ~7% corner
// radius, but every platform that shows this masks it to its own shape — iOS
// to a squircle at roughly 22%, Android to whatever the launcher picked. Baking
// in a radius only means the platform's mask cuts *inside* our corner and
// leaves a sliver of nothing along the edge. The corners of the source are the
// gradient continued to the edge, so there's something to cut.
const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

mkdirSync("public/icons", { recursive: true });

for (const [file, size] of targets) {
  await sharp(SOURCE)
    .resize(size, size, { fit: "fill", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log("wrote", file, `${size}×${size}`);
}

// ---- The maskable variant ------------------------------------------------
//
// Android crops a maskable icon to whatever shape the launcher fancies, and
// only promises to keep a centred circle 80% of the icon's width. The daisy is
// drawn 500 wide on a 600 square — 83% — so a circular launcher would shave a
// flat off the two side petals.
//
// Rather than shrink the daisy, which would mean cutting it out of a background
// it's shaded against, grow the background around it. The artwork's backdrop is
// a plain vertical linear gradient, so it can be continued past its own edges
// exactly: every row is one flat colour, and the ramp is a straight line that
// can be evaluated outside [0, 1]. Padding to 640 puts the daisy at 78%, inside
// the safe circle, with no seam where the added margin meets the original.
const MASKABLE_PAD = 20;
const src = sharp(SOURCE);
const { width: srcSize } = await src.metadata();
const padded = srcSize + MASKABLE_PAD * 2;

// Read the ramp off the source itself rather than repeating the hex codes, so
// this keeps working if the artwork is re-exported with a retuned gradient.
const edge = await sharp(SOURCE)
  .extract({ left: 0, top: 0, width: 1, height: srcSize })
  .raw()
  .toBuffer();
const top = [edge[0], edge[1], edge[2]];
const bottom = edge.subarray((srcSize - 1) * 3, srcSize * 3);
const at = (t) =>
  [0, 1, 2].map((c) =>
    Math.max(0, Math.min(255, Math.round(top[c] + (bottom[c] - top[c]) * t))),
  );

const canvas = Buffer.alloc(padded * padded * 3);
for (let y = 0; y < padded; y++) {
  // t is in the *source's* coordinates, so the rows either side of the seam
  // agree by construction; above and below the artwork it extrapolates.
  const [r, g, b] = at((y - MASKABLE_PAD) / (srcSize - 1));
  for (let x = 0; x < padded; x++) {
    const i = (y * padded + x) * 3;
    canvas[i] = r;
    canvas[i + 1] = g;
    canvas[i + 2] = b;
  }
}

// Two passes, not one chained call: sharp resizes before it composites, so
// asking for both at once would shrink the canvas to 512 and then refuse the
// 600-wide artwork for being larger than what it's being pasted onto.
const composited = await sharp(canvas, {
  raw: { width: padded, height: padded, channels: 3 },
})
  .composite([{ input: SOURCE, left: MASKABLE_PAD, top: MASKABLE_PAD }])
  .png()
  .toBuffer();

await sharp(composited)
  .resize(512, 512, { fit: "fill", kernel: "lanczos3" })
  // `composite` hands back an alpha channel whether or not anything in the
  // pipeline was transparent, and an alpha channel is the one thing a maskable
  // icon must not have.
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile("public/icons/icon-512-maskable.png");
console.log("wrote public/icons/icon-512-maskable.png 512×512");
