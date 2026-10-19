// Builds data/cars.json from open sources:
//   Wikidata (model, maker, country, notability, photo)
//   English Wikipedia infobox (production years, class, body style, weight)
//   Wikimedia Commons (photo thumbnail, author, licence) for attribution.
// Usage: node scripts/cars/fetch.mjs [minSitelinks=12]

import { writeFile } from "node:fs/promises";

const UA = "KurumaCardImport/0.1 (gabinhalloss@gmail.com)";
const MIN_SITELINKS = Number(process.argv[2] ?? 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...init.headers } });
    if (res.ok) return res.json();
    if (attempt === 3) throw new Error(`${res.status} ${url.slice(0, 120)}`);
    await sleep(2000 * attempt);
  }
}

/* ---------- 1. Wikidata ---------- */

const SPARQL = `
SELECT ?model ?labelFr ?labelEn ?makerFr ?makerEn ?country ?image ?sitelinks ?enwiki WHERE {
  ?model wdt:P31 wd:Q3231690 ; wdt:P18 ?image ; wdt:P176 ?maker ; wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  ?enwiki schema:about ?model ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?model rdfs:label ?labelFr FILTER(lang(?labelFr) = "fr") }
  OPTIONAL { ?model rdfs:label ?labelEn FILTER(lang(?labelEn) = "en") }
  OPTIONAL { ?maker rdfs:label ?makerFr FILTER(lang(?makerFr) = "fr") }
  OPTIONAL { ?maker rdfs:label ?makerEn FILTER(lang(?makerEn) = "en") }
  OPTIONAL { ?maker wdt:P17/wdt:P297 ?makerCountry }
  OPTIONAL { ?model wdt:P495/wdt:P297 ?originCountry }
  BIND(COALESCE(?makerCountry, ?originCountry) AS ?country)
}`;

async function fetchWikidata() {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL)}`;
  const data = await getJson(url, { headers: { Accept: "application/sparql-results+json" } });
  const byModel = new Map();
  for (const row of data.results.bindings) {
    const id = row.model.value.split("/").pop();
    if (byModel.has(id)) continue; // one maker/country per model
    const v = (k) => row[k]?.value ?? null;
    byModel.set(id, {
      wikidata: id,
      label: v("labelFr") ?? v("labelEn"),
      labelEn: v("labelEn"),
      make: v("makerFr") ?? v("makerEn"),
      country: v("country"),
      sitelinks: Number(v("sitelinks")),
      imageFile: decodeURIComponent(v("image").split("Special:FilePath/").pop()),
      enwiki: decodeURIComponent(v("enwiki").split("/wiki/").pop()).replace(/_/g, " "),
    });
  }
  return [...byModel.values()];
}

/* ---------- 2. Wikipedia infobox ---------- */

function cleanWikitext(s) {
  return s
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/\{\{(?:nowrap|nobr|small|ubl|unbulleted list|plainlist|flatlist|hlist)\|/gi, "")
    .replace(/\{\{convert\|([\d.,]+)\|(\w+)[^}]*\}\}/gi, "$1 $2")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/[{}|*]/g, " ")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function infoboxFields(wikitext) {
  const start = wikitext.search(/\{\{\s*Infobox automobile/i);
  if (start < 0) return null;
  const box = wikitext.slice(start, start + 8000);
  const field = (name) => {
    const m = box.match(new RegExp(`\\n\\s*\\|\\s*${name}\\s*=([^\\n]*(?:\\n(?!\\s*\\|)[^\\n]*)*)`, "i"));
    return m ? cleanWikitext(m[1]) : null;
  };
  return {
    production: field("production"),
    class: field("class"),
    bodyStyle: field("body_style"),
    weight: field("(?:weight|curb_weight|kerb_weight)"),
  };
}

async function fetchInfoboxes(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1" +
      "&prop=revisions&rvprop=content&rvslots=main&titles=" +
      encodeURIComponent(batch.join("|"));
    const data = await getJson(url);
    const redirect = new Map((data.query.redirects ?? []).map((r) => [r.to, r.from]));
    const normalized = new Map((data.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data.query.pages ?? []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      if (!text) continue;
      let title = page.title;
      title = redirect.get(title) ?? title;
      title = normalized.get(title) ?? title;
      out.set(title, infoboxFields(text));
    }
    process.stdout.write(`  infobox ${Math.min(i + 50, titles.length)}/${titles.length}\r`);
    await sleep(300);
  }
  console.log();
  return out;
}

/* ---------- 3. Commons photo + licence ---------- */

const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function fetchImages(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
      "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&titles=" +
      encodeURIComponent(batch.map((f) => `File:${f}`).join("|"));
    const data = await getJson(url);
    const normalized = new Map((data.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data.query.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      const key = (normalized.get(page.title) ?? page.title).replace(/^File:/, "");
      out.set(key, {
        url: info.thumburl ?? info.url,
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        author: stripHtml(meta.Artist?.value) || null,
        license: meta.LicenseShortName?.value ?? null,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        source: info.descriptionurl,
      });
    }
    process.stdout.write(`  photos ${Math.min(i + 50, files.length)}/${files.length}\r`);
    await sleep(300);
  }
  console.log();
  return out;
}

/* ---------- 4. Classification ---------- */

const EURO = new Set(["DE", "IT", "FR", "GB", "SE", "ES", "NL", "BE", "AT", "CH", "CZ", "SK", "PL", "RO", "RS", "HR", "SI", "PT", "DK", "NO", "FI", "IE", "HU"]);
const EAST = new Set(["RU", "SU", "UA", "BY", "DD", "BG", "YU"]);

function years(production) {
  if (!production) return { start: null, end: null };
  const found = [...production.matchAll(/\b(18[89]\d|19\d\d|20[0-3]\d)\b/g)].map((m) => Number(m[1]));
  if (!found.length) return { start: null, end: null };
  const ongoing = /present|current|today/i.test(production);
  return { start: Math.min(...found), end: ongoing ? null : Math.max(...found) };
}

function kg(weight) {
  const m = weight?.replace(/,/g, "").match(/(\d{3,4})(?:\.\d+)?\s*(?:kg|kilograms?)/i);
  return m ? Number(m[1]) : null;
}

const has = (text, ...words) => words.some((w) => text.includes(w));

function classify(car) {
  const text = `${car.class ?? ""} ${car.bodyStyle ?? ""}`.toLowerCase();
  const tags = new Set();
  if (has(text, "hypercar")) tags.add("hypercar");
  if (has(text, "supercar")) tags.add("supercar");
  if (has(text, "sports car", "sport compact", "sports coupé", "sports coupe", "hot hatch", "roadster")) tags.add("sportive");
  if (has(text, "grand tourer", "gran turismo", "grand touring")) tags.add("gt");
  if (has(text, "muscle", "pony car")) tags.add("muscle");
  if (has(text, "kei")) tags.add("kei");
  if (has(text, "luxury", "full-size luxury", "executive")) tags.add("luxe");
  if (has(text, "off-road", "off road", "4x4", "suv", "sport utility")) tags.add("tout-terrain");
  if (has(text, "electric", "battery")) tags.add("électrique");
  if (car.yearStart && car.yearStart < 1975) tags.add("classique");
  else if (car.yearStart && car.yearStart < 1996) tags.add("youngtimer");

  let culture = "Monde";
  if (car.country === "JP") culture = tags.has("kei") ? "Kei" : "JDM";
  else if (car.country === "US") culture = tags.has("muscle") ? "Muscle" : "US";
  else if (EURO.has(car.country)) culture = "Euro";
  else if (EAST.has(car.country)) culture = "Est";
  else if (car.country === "KR") culture = "Corée";

  let body = null;
  if (has(text, "pickup", "pick-up", "ute")) body = "Pick-up";
  else if (has(text, "convertible", "cabriolet", "roadster", "spider", "spyder", "targa")) body = "Cabriolet";
  else if (has(text, "coupé", "coupe", "fastback")) body = "Coupé";
  else if (has(text, "suv", "crossover", "sport utility", "off-road")) body = "SUV";
  else if (has(text, "estate", "station wagon", "wagon", "shooting brake")) body = "Break";
  else if (has(text, "minivan", "mpv", "van")) body = "Monospace";
  else if (has(text, "hatchback", "liftback")) body = "Compacte";
  else if (has(text, "sedan", "saloon")) body = "Berline";

  return { culture, body, tags: [...tags] };
}

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ---------- Run ---------- */

console.log(`Wikidata (sitelinks >= ${MIN_SITELINKS})…`);
const models = await fetchWikidata();
console.log(`  ${models.length} modèles`);

console.log("Wikipédia…");
const boxes = await fetchInfoboxes(models.map((m) => m.enwiki));

console.log("Commons…");
const photos = await fetchImages([...new Set(models.map((m) => m.imageFile))]);

const usedSlugs = new Set();
const cars = [];
const skipped = { noLabel: 0, noPhoto: 0, noLicence: 0 };

for (const m of models) {
  const label = m.label && !/^Q\d+$/.test(m.label) ? m.label : m.enwiki.replace(/\s*\(.*\)$/, "");
  if (!label) { skipped.noLabel++; continue; }
  const photo = photos.get(m.imageFile);
  if (!photo?.url) { skipped.noPhoto++; continue; }
  if (!photo.license) { skipped.noLicence++; continue; }

  const box = boxes.get(m.enwiki) ?? {};
  const { start, end } = years(box.production);
  const car = {
    ...m,
    name: label,
    class: box.class ?? null,
    bodyStyle: box.bodyStyle ?? null,
    yearStart: start,
    yearEnd: end,
    massKg: kg(box.weight),
    photo,
  };
  Object.assign(car, classify(car));

  let slug = slugify(label);
  if (usedSlugs.has(slug)) slug = `${slug}-${m.wikidata.toLowerCase()}`;
  usedSlugs.add(slug);
  car.slug = slug;
  cars.push(car);
}

await writeFile("data/cars.json", JSON.stringify(cars, null, 2));
console.log(`\n${cars.length} voitures écrites dans data/cars.json`, skipped);
