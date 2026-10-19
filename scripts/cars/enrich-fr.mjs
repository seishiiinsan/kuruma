// Second pass on data/cars.json: the French Wikipedia "Infobox Automobile"
// carries the specs the English one lacks (units built, power, displacement,
// weight, top speed, 0-100). Run after enrich.mjs.
// Usage: node scripts/cars/enrich-fr.mjs

import { readFile, writeFile } from "node:fs/promises";

const UA = "KurumaCardImport/0.1 (gabinhalloss@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.ok) return res.json();
    if (attempt === 4) throw new Error(`${res.status} ${url.slice(0, 120)}`);
    await sleep(3000 * attempt);
  }
}

const cars = JSON.parse(await readFile("data/cars.json", "utf8"));

/** Plain text from a wikitext value, French number formatting kept as digits. */
function clean(s) {
  return s
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, " ; ")
    .replace(/\{\{(?:formatnum|nombre|nb|unité|unite|nobr|nowrap):?\|?([^{}]*)\}\}/gi, (_, inner) => inner.replace(/\|/g, " "))
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/&nbsp;| | /g, " ")
    .replace(/(\d) (?=\d{3}\b)/g, "$1")
    .replace(/(\d)\.(?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function field(box, name) {
  const m = box.match(new RegExp(`\\n\\s*\\|\\s*${name}\\s*=([^\\n]*)`, "i"));
  const v = m ? clean(m[1]) : "";
  return v || null;
}

const numbers = (s) => [...(s ?? "").matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));

function production(s) {
  if (!s) return null;
  const millions = s.match(/(\d+(?:[.,]\d+)?)\s*millions?/i);
  if (millions) return Math.round(Number(millions[1].replace(",", ".")) * 1e6);
  const counted = [...s.matchAll(/(\d+)\s*(?:exemplaires?|unités?|voitures?|véhicules?|ex\.)/gi)].map((m) => Number(m[1]));
  if (counted.length) return Math.max(...counted);
  // A bare figure that isn't a year.
  const bare = numbers(s).filter((n) => Number.isInteger(n) && n > 0 && !(n >= 1880 && n <= 2035));
  return bare.length ? Math.max(...bare) : null;
}

function power(s) {
  if (!s) return null;
  const text = s.replace(/(?:à|@|de)?\s*\d+(?:\s*[-–à]\s*\d+)?\s*tr\/?min/gi, " ");
  // Figures with a unit first; a bare figure only when there are none.
  let withUnit = null;
  let bare = null;
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kW|ch|cv|hp|PS|bhp)?\b/gi)) {
    let n = Number(m[1].replace(",", "."));
    if (m[2]) {
      if (/kw/i.test(m[2])) n *= 1.36;
      if (n > 20 && n < 2500) withUnit = Math.max(withUnit ?? 0, Math.round(n));
    } else if (n > 20 && n < 1600 && !(n >= 1880 && n <= 2035)) {
      bare = Math.max(bare ?? 0, Math.round(n));
    }
  }
  return withUnit ?? bare;
}

const inRange = (n, lo, hi) => (n != null && n >= lo && n <= hi ? n : null);

function engine(s) {
  if (!s) return null;
  const first =
    s
      .split(/\s*;\s*|\s*-\s+/)
      .map((x) => x.trim().replace(/^(?:essence|diesel|électrique|hybride)\s*:\s*/i, ""))
      .find((x) => x.length > 1 && !/:$/.test(x)) ?? s;
  return first.length > 48 ? `${first.slice(0, 46).replace(/\s+\S*$/, "")}…` : first;
}

async function fetchBoxes(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url =
      "https://fr.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1" +
      "&prop=revisions&rvprop=content&rvslots=main&titles=" +
      encodeURIComponent(batch.join("|"));
    const data = await getJson(url);
    const redirect = new Map((data.query.redirects ?? []).map((r) => [r.to, r.from]));
    const normalized = new Map((data.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data.query.pages ?? []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (!text) continue;
      let title = redirect.get(page.title) ?? page.title;
      title = normalized.get(title) ?? title;
      const start = text.search(/\{\{\s*Infobox Automobile/i);
      if (start < 0) continue;
      const box = text.slice(start, start + 10000);
      const cc = numbers(field(box, "cylindrée"))[0];
      out.set(title, {
        produced: production(field(box, "production")),
        powerHp: power(field(box, "puissance(?:\\s*max(?:imale)?)?")),
        engine: engine(field(box, "moteurs?")),
        displacementCc: inRange(cc, 300, 15000),
        massKg: inRange(Math.max(...numbers(field(box, "poids")).filter((n) => n >= 300), -Infinity), 300, 6000),
        topSpeedKmh: inRange(Math.max(...numbers(field(box, "vitesse(?:\\s*max(?:imale)?)?")), -Infinity), 50, 500),
        zeroTo100: inRange(Math.min(...numbers(field(box, "accélération")).filter((n) => n >= 1.5), Infinity), 1.5, 60),
      });
    }
    process.stdout.write(`  frwiki ${Math.min(i + 50, titles.length)}/${titles.length}\r`);
    await sleep(300);
  }
  console.log();
  return out;
}

const boxes = await fetchBoxes(cars.filter((c) => c.frwiki).map((c) => c.frwiki));

for (const car of cars) {
  const b = car.frwiki ? boxes.get(car.frwiki) : null;
  if (!b) continue;
  car.produced = b.produced ?? car.produced;
  car.powerHp = b.powerHp ?? car.powerHp;
  car.engine = b.engine ?? car.engine;
  car.displacementCc = b.displacementCc ?? car.displacementCc ?? null;
  car.massKg = b.massKg ?? car.massKg;
  car.topSpeedKmh = b.topSpeedKmh ?? null;
  car.zeroTo100 = b.zeroTo100 ?? null;
}

await writeFile("data/cars.json", JSON.stringify(cars, null, 2));
const count = (k) => cars.filter((c) => c[k] != null).length;
console.log(
  ["produced", "powerHp", "engine", "displacementCc", "massKg", "topSpeedKmh", "zeroTo100"].map((k) => `${k} ${count(k)}`).join(" · "),
);
