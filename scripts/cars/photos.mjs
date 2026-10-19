// Downloads every card photo once from Wikimedia Commons, crops it to the
// card's 4:3 window (centred on the car) and saves it as WebP in .cache/cars/.
// Hotlinking Commons from the app gets throttled (HTTP 429), so the app serves
// these copies from Supabase Storage instead. Upload, then rebuild the catalogue:
//   supabase storage cp -r .cache/cars ss:///cars --linked --experimental -j 16
//   node scripts/cars/build-cards.mjs
// Usage: node scripts/cars/photos.mjs

import { mkdir, readFile, stat } from "node:fs/promises";
import sharp from "sharp";

const UA = "KurumaCardImport/0.1 (gabinhalloss@gmail.com)";
const OUT = ".cache/cars";
const CONCURRENCY = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cards = JSON.parse(await readFile("data/cards.json", "utf8"));
await mkdir(OUT, { recursive: true });

const exists = (p) => stat(p).then(() => true, () => false);

async function fetchPhoto(url) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status}`);
    await sleep(5000 * attempt);
  }
  throw new Error("gave up");
}

let done = 0;
const failed = [];
const queue = [...cards];

async function worker() {
  for (let card = queue.shift(); card; card = queue.shift()) {
    const file = `${OUT}/${card.slug}.webp`;
    if (!(await exists(file))) {
      try {
        const input = await fetchPhoto(card.image);
        await sharp(input)
          .rotate()
          .resize({ width: 720, height: 540, fit: "cover", position: sharp.strategy.attention })
          .webp({ quality: 78 })
          .toFile(file);
        await sleep(150);
      } catch (error) {
        failed.push(`${card.slug}: ${error.message}`);
      }
    }
    if (++done % 50 === 0) console.log(`${done}/${cards.length}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`${done - failed.length} photos prêtes, ${failed.length} échecs`);
if (failed.length) console.log(failed.join("\n"));
