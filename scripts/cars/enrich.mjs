// Completes data/cars.json in place with the fields a card needs:
//   Wikidata  brand, total produced, power, frwiki title
//   Wikipedia infobox (en)  engine, power, units produced
//   Wikipedia (fr, else en)  two-sentence intro for the card description
// Usage: node scripts/cars/enrich.mjs

import { readFile, writeFile } from "node:fs/promises";

const UA = "KurumaCardImport/0.1 (gabinhalloss@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, init = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...init.headers } });
    if (res.ok) return res.json();
    if (attempt === 4) throw new Error(`${res.status} ${url.slice(0, 120)}`);
    await sleep(3000 * attempt);
  }
}

const cars = JSON.parse(await readFile("data/cars.json", "utf8"));

/* ---------- 1. Wikidata ---------- */

const HP_UNITS = new Set(["Q160680", "Q23763"]); // horsepower, metric horsepower
const KW_UNITS = new Set(["Q3249365"]); // kilowatt
const W_UNITS = new Set(["Q25236"]); // watt

async function fetchWikidata(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 150) {
    const batch = ids.slice(i, i + 150);
    const query = `
SELECT ?model ?brandFr ?brandEn ?produced ?powerAmount ?powerUnit ?frwiki WHERE {
  VALUES ?model { ${batch.map((id) => `wd:${id}`).join(" ")} }
  OPTIONAL { ?model wdt:P1716 ?brand .
    OPTIONAL { ?brand rdfs:label ?brandFr FILTER(lang(?brandFr) = "fr") }
    OPTIONAL { ?brand rdfs:label ?brandEn FILTER(lang(?brandEn) = "en") } }
  OPTIONAL { ?model wdt:P1092 ?produced }
  OPTIONAL { ?model p:P2109/psv:P2109 [ wikibase:quantityAmount ?powerAmount ; wikibase:quantityUnit ?powerUnit ] }
  OPTIONAL { ?frwiki schema:about ?model ; schema:isPartOf <https://fr.wikipedia.org/> }
}`;
    const data = await getJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json" },
    });
    for (const row of data.results.bindings) {
      const id = row.model.value.split("/").pop();
      const entry = out.get(id) ?? { brand: null, produced: null, powerHp: null, frwiki: null };
      const v = (k) => row[k]?.value ?? null;
      entry.brand ??= v("brandFr") ?? v("brandEn");
      if (v("produced")) entry.produced = Math.max(entry.produced ?? 0, Math.round(Number(v("produced"))));
      if (v("powerAmount")) {
        const amount = Number(v("powerAmount"));
        const unit = v("powerUnit").split("/").pop();
        const hp = HP_UNITS.has(unit) ? amount : KW_UNITS.has(unit) ? amount * 1.36 : W_UNITS.has(unit) ? amount / 735.5 : null;
        if (hp && hp > 20 && hp < 2500) entry.powerHp = Math.max(entry.powerHp ?? 0, Math.round(hp));
      }
      if (v("frwiki")) entry.frwiki = decodeURIComponent(v("frwiki").split("/wiki/").pop()).replace(/_/g, " ");
      out.set(id, entry);
    }
    process.stdout.write(`  wikidata ${Math.min(i + 150, ids.length)}/${ids.length}\r`);
    await sleep(1000);
  }
  console.log();
  return out;
}

/* ---------- 2. English infobox: engine, power, units ---------- */

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

function rawField(box, name) {
  const m = box.match(new RegExp(`\\n\\s*\\|\\s*${name}\\s*=([^\\n]*(?:\\n(?!\\s*\\|)[^\\n]*)*)`, "i"));
  return m ? m[1] : null;
}

/** Highest power found in a power field or engine list, in metric hp. */
function powerFrom(raw) {
  if (!raw) return null;
  let best = null;
  const keep = (hp) => {
    if (hp > 20 && hp < 2500) best = Math.max(best ?? 0, Math.round(hp));
  };
  for (const m of raw.matchAll(/\{\{convert\|([\d.,]+)\|(kW|hp|PS|bhp|cv)\b/gi)) {
    const n = Number(m[1].replace(/,/g, ""));
    keep(/kw/i.test(m[2]) ? n * 1.36 : /hp|bhp/i.test(m[2]) ? n * 1.014 : n);
  }
  const text = cleanWikitext(raw).replace(/(\d),(\d{3})/g, "$1$2");
  for (const m of text.matchAll(/([\d.]+)\s*(kW|hp|PS|bhp|cv)\b/gi)) {
    const n = Number(m[1]);
    keep(/kw/i.test(m[2]) ? n * 1.36 : /hp|bhp/i.test(m[2]) ? n * 1.014 : n);
  }
  return best;
}

/** "1,315 produced", "106 built", "(400 units)". */
function unitsFrom(raw) {
  if (!raw) return null;
  const text = cleanWikitext(raw).replace(/(\d)[,.\s](\d{3})\b/g, "$1$2").replace(/(\d)[,.\s](\d{3})\b/g, "$1$2");
  const found = [...text.matchAll(/(?:^|[^\d])(\d{1,8})\s*(?:units?|produced|built|made|examples|cars|vehicles)\b/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && !(n >= 1880 && n <= 2035));
  return found.length ? found.reduce((a, b) => a + b, 0) : null;
}

function engineFrom(raw) {
  if (!raw) return null;
  const text = cleanWikitext(raw);
  const first = text.split(/,\s*(?=\d[\d.]*\s*L\b|\d[\d.]*\s*(?:kW|hp))/)[0];
  const m = first.match(/(\d\.\d)\s*L\b[^,;]*?\b((?:[VW]|I|H|flat|straight|inline)[- ]?(?:\d{1,2}|six|four|eight|twelve))?/i);
  if (m) return [m[1].replace(".", ",") + " L", m[2]?.replace(/straight|inline/i, "L").replace(/flat/i, "H").replace(/[- ]/g, "")].filter(Boolean).join(" ");
  if (/electric/i.test(text)) return "Électrique";
  if (/wankel|rotary/i.test(text)) return "Rotatif";
  return null;
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
      let title = redirect.get(page.title) ?? page.title;
      title = normalized.get(title) ?? title;
      const start = text.search(/\{\{\s*Infobox automobile/i);
      if (start < 0) continue;
      const box = text.slice(start, start + 12000);
      out.set(title, {
        powerHp: powerFrom(rawField(box, "(?:power|max_power)")) ?? powerFrom(rawField(box, "engine")),
        engine: engineFrom(rawField(box, "engine")),
        units: unitsFrom(rawField(box, "production")) ?? unitsFrom(rawField(box, "(?:units|number_built|built)")),
      });
    }
    process.stdout.write(`  infobox ${Math.min(i + 50, titles.length)}/${titles.length}\r`);
    await sleep(300);
  }
  console.log();
  return out;
}

/* ---------- 3. Intro paragraph ---------- */

async function fetchIntros(host, titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const url =
      `https://${host}/w/api.php?action=query&format=json&formatversion=2&redirects=1` +
      "&prop=extracts&exintro=1&explaintext=1&exsentences=3&titles=" +
      encodeURIComponent(batch.join("|"));
    const data = await getJson(url);
    const redirect = new Map((data.query.redirects ?? []).map((r) => [r.to, r.from]));
    const normalized = new Map((data.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data.query.pages ?? []) {
      if (!page.extract) continue;
      let title = redirect.get(page.title) ?? page.title;
      title = normalized.get(title) ?? title;
      out.set(title, tidyIntro(page.extract));
    }
    process.stdout.write(`  ${host} ${Math.min(i + 20, titles.length)}/${titles.length}\r`);
    await sleep(250);
  }
  console.log();
  return out;
}

function tidyIntro(text) {
  const clean = text
    .replace(/\s*\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "") // parentheticals: pronunciations, codes
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 320 && out) break;
    out += s;
  }
  return out.trim() || null;
}

/* ---------- Run ---------- */

console.log("Wikidata…");
const wd = await fetchWikidata(cars.map((c) => c.wikidata));
console.log("Infobox…");
const boxes = await fetchInfoboxes(cars.map((c) => c.enwiki));
console.log("Intros FR…");
const frTitles = [...wd.values()].map((e) => e.frwiki).filter(Boolean);
const introsFr = await fetchIntros("fr.wikipedia.org", frTitles);
const missingFr = cars.filter((c) => !introsFr.has(wd.get(c.wikidata)?.frwiki ?? "")).map((c) => c.enwiki);
console.log(`Intros EN (${missingFr.length} sans article FR)…`);
const introsEn = await fetchIntros("en.wikipedia.org", missingFr);

for (const car of cars) {
  const w = wd.get(car.wikidata) ?? {};
  const b = boxes.get(car.enwiki) ?? {};
  car.brand = w.brand ?? car.make;
  car.produced = w.produced ?? b.units ?? null;
  car.powerHp = w.powerHp ?? b.powerHp ?? null;
  car.engine = b.engine ?? null;
  car.frwiki = w.frwiki ?? null;
  const fr = w.frwiki ? introsFr.get(w.frwiki) : null;
  car.intro = fr ?? introsEn.get(car.enwiki) ?? null;
  car.introLang = fr ? "fr" : car.intro ? "en" : null;
}

await writeFile("data/cars.json", JSON.stringify(cars, null, 2));
const count = (k) => cars.filter((c) => c[k] != null).length;
console.log(
  `${cars.length} voitures · brand ${count("brand")} · produced ${count("produced")} · power ${count("powerHp")} · engine ${count("engine")} · intro ${count("intro")} (fr ${cars.filter((c) => c.introLang === "fr").length})`,
);
