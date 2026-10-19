// Builds the app icons from one SVG mark: a yellow card with a K, tilted.
// Run: node scripts/icons/build-icons.mjs
// Writes app/icon.svg, app/apple-icon.png, app/favicon.ico and the manifest
// icons in public/icons/. The K path is shared with lib/og.tsx (Logo).
import { writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const K_PATH = "M150 132h58v94l78-94h70l-90 104 96 122h-74l-80-102v102h-58z";

const card = `
  <g transform="rotate(-8 256 256)">
    <rect x="118" y="78" width="276" height="372" rx="44" fill="#d48a00"/>
    <rect x="118" y="62" width="276" height="372" rx="44" fill="#ffcc33"/>
    <path d="${K_PATH}" fill="#1d1656"/>
  </g>`;

/** Rounded indigo tile with the card: favicon, home screen, apple-touch. */
const tile = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="#2b2380"/><stop offset="1" stop-color="#120c3c"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(0.88) translate(-256 -256)">${card}</g>
</svg>`;

/** Maskable: full bleed, the card shrunk into the 80 % safe zone. */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1d1656"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">${card}</g>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

/** An .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

await mkdir("public/icons", { recursive: true });
const rounded = tile(112);
await writeFile("app/icon.svg", rounded);
await writeFile("app/apple-icon.png", await png(tile(0), 180));
await writeFile("public/icons/icon-192.png", await png(rounded, 192));
await writeFile("public/icons/icon-512.png", await png(rounded, 512));
await writeFile("public/icons/maskable-512.png", await png(maskable, 512));
await writeFile(
  "app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) })))),
);
console.log("Icons written.");
