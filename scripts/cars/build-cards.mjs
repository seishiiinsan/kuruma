// Turns data/cars.json (raw open data) into the game catalogue:
//   data/cards.json                    what the app renders
//   supabase/migrations/*_cards.sql    what the database draws from
// Rarity follows real-world scarcity first (units produced), then fame.
// Supply: a car can't have more copies in the game than were built.
// Usage: node scripts/cars/build-cards.mjs

import { readdir, readFile, writeFile } from "node:fs/promises";

const cars = JSON.parse(await readFile("data/cars.json", "utf8"));

// Photos copied by photos.mjs are served from Storage (bucket "cars", folder "cars");
// any car missing there falls back to the Commons thumbnail.
const hosted = new Set((await readdir(".cache/cars").catch(() => [])).map((f) => f.replace(/\.webp$/, "")));

const COUNTRIES = {
  JP: "Japon", US: "États-Unis", DE: "Allemagne", IT: "Italie", FR: "France", GB: "Royaume-Uni",
  SE: "Suède", ES: "Espagne", NL: "Pays-Bas", BE: "Belgique", AT: "Autriche", CH: "Suisse",
  CZ: "Tchéquie", SK: "Slovaquie", PL: "Pologne", RO: "Roumanie", RS: "Serbie", HR: "Croatie",
  SI: "Slovénie", PT: "Portugal", DK: "Danemark", NO: "Norvège", FI: "Finlande", IE: "Irlande",
  HU: "Hongrie", RU: "Russie", SU: "URSS", UA: "Ukraine", BY: "Biélorussie", DD: "RDA",
  BG: "Bulgarie", YU: "Yougoslavie", KR: "Corée du Sud", CN: "Chine", IN: "Inde", AU: "Australie",
  BR: "Brésil", MX: "Mexique", AR: "Argentine", CA: "Canada", MY: "Malaisie", TR: "Turquie",
  IR: "Iran", TW: "Taïwan", ZA: "Afrique du Sud", VN: "Viêt Nam", ID: "Indonésie", TH: "Thaïlande",
  NZ: "Nouvelle-Zélande", EG: "Égypte", UZ: "Ouzbékistan", KP: "Corée du Nord", CL: "Chili",
};

const BODY_FR = {
  "Pick-up": "pick-up", Cabriolet: "cabriolet", Coupé: "coupé", SUV: "SUV", Break: "break",
  Monospace: "monospace", Compacte: "compacte", Berline: "berline",
};

/* ---------- Rarity ---------- */

// Legendary is earned by real scarcity only: 200 units or fewer.
function productionTier(units) {
  if (units == null) return null;
  if (units <= 200) return 3;
  if (units <= 5000) return 2;
  if (units <= 150000) return 1;
  return 0;
}

// Fame percentile (Wikipedia language editions) lifts a car up to epic.
const bySitelinks = [...cars].sort((a, b) => b.sitelinks - a.sitelinks);
const fameRank = new Map(bySitelinks.map((c, i) => [c.wikidata, i / cars.length]));

function fameTier(car) {
  const p = fameRank.get(car.wikidata);
  let t = p < 0.04 ? 2 : p < 0.25 ? 1 : 0;
  const sporty = (car.tags ?? []).some((tag) => ["sportive", "gt", "muscle", "supercar", "hypercar"].includes(tag));
  // Fame alone makes an everyday car rare at most; epic takes a sports car.
  return sporty ? Math.max(t, 1) : Math.min(t, 1);
}

function tierOf(car) {
  const prod = productionTier(car.produced);
  const fame = fameTier(car);
  if (prod == null) return fame;
  // A mass-produced car can be famous, but stays within reach.
  if (prod === 0) return Math.min(fame, 1);
  return Math.max(prod, fame);
}

const TIERS = ["common", "rare", "epic", "legendary"];

/* ---------- Text ---------- */

const BRANDS = {
  "Groupe BMW": "BMW", "Volvo Cars": "Volvo", "Suzuki Motor Corporation": "Suzuki", "Lotus Cars": "Lotus",
  "Rolls-Royce Motor Cars": "Rolls-Royce", "Rolls-Royce Motors": "Rolls-Royce", "Ascari Cars": "Ascari",
  "Automobili Pininfarina": "Pininfarina", "Bristol Cars": "Bristol", "Ruf Automobile": "Ruf",
  "DeLorean Motor Company": "DeLorean", "AC Cars": "AC", "Jensen Motors": "Jensen", "Zastava Automobiles": "Zastava",
  "DS Automobiles": "DS", "Hudson Motor Car Company": "Hudson", "Spyker Cars": "Spyker", "British Motor Corporation": "BMC",
  "Marussia Motors": "Marussia", "American Motors Corporation": "AMC", "Shanghai Automotive Industry Corporation": "SAIC",
  "Hindustan Motors": "Hindustan", "Groupe PSA": "PSA", "Renault Korea Motors": "Renault Korea", "Sinclair Vehicles Ltd": "Sinclair",
  "Genesis Motors": "Genesis", "MG Motor": "MG", "Kaiser Motors": "Kaiser", "Changan Automobile": "Changan",
  "Wuling Motors": "Wuling", "Checker Motors Corporation": "Checker", "Peel Engineering Company": "Peel",
  "Rimac Automobili": "Rimac", "Tucker Corporation": "Tucker", "Marussia": "Marussia",
};
const brandName = (b) => (b ? (BRANDS[b] ?? b).replace(/\s*\([^)]*\)$/, "") : null);

function yearsText(car) {
  if (!car.yearStart) return null;
  if (!car.yearEnd || car.yearEnd === car.yearStart) return car.yearEnd ? `en ${car.yearStart}` : `depuis ${car.yearStart}`;
  return `de ${car.yearStart} à ${car.yearEnd}`;
}

function generatedDescription(car) {
  const body = car.body ? BODY_FR[car.body] : "modèle";
  const country = COUNTRIES[car.country];
  const parts = [`${capitalize(body)} ${car.brand ? `de ${car.brand}` : ""}`.trim()];
  if (country) parts[0] += ` (${country})`;
  const years = yearsText(car);
  if (years) parts.push(`produit${body === "berline" || body === "compacte" ? "e" : ""} ${years}`);
  let text = parts.join(", ") + ".";
  if (car.produced) text += ` ${formatInt(car.produced)} exemplaires construits.`;
  return text;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const formatInt = (n) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");

// Past 900 ch, only hypercars, supercars and electric cars are believable.
function plausiblePower(car) {
  const hp = car.powerHp ?? null;
  if (hp == null || hp <= 900) return hp;
  const tags = car.tags ?? [];
  return tags.includes("hypercar") || tags.includes("supercar") || tags.includes("électrique") || (car.yearStart ?? 0) >= 2015
    ? hp
    : null;
}

/* ---------- Build ---------- */

const cards = [];
for (const car of cars) {
  if (car.produced != null && car.produced < 1) car.produced = null;
  const tier = TIERS[tierOf(car)];
  const country = COUNTRIES[car.country] ?? null;
  const fr = car.introLang === "fr";
  cards.push({
    slug: car.slug,
    name: car.name,
    brand: brandName(car.brand ?? car.make ?? null),
    culture: car.culture,
    tags: car.tags ?? [],
    tier,
    year: car.yearStart ?? null,
    yearEnd: car.yearEnd ?? null,
    country,
    body: car.body ?? null,
    powerHp: plausiblePower(car),
    engine: car.engine ?? null,
    displacementCc: car.displacementCc ?? null,
    massKg: car.massKg ?? null,
    topSpeedKmh: car.topSpeedKmh ?? null,
    zeroTo100: car.zeroTo100 ?? null,
    supply: car.produced ?? null,
    description: fr && car.intro ? car.intro : generatedDescription(car),
    source: fr
      ? { lang: "fr", url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(car.frwiki.replace(/ /g, "_"))}` }
      : { lang: "en", url: `https://en.wikipedia.org/wiki/${encodeURIComponent(car.enwiki.replace(/ /g, "_"))}` },
    image: hosted.has(car.slug) ? `cars/cars/${car.slug}.webp` : car.photo.url,
    photo: {
      author: car.photo.author,
      license: car.photo.license,
      licenseUrl: car.photo.licenseUrl,
      source: car.photo.source,
    },
    wikidata: car.wikidata,
    fame: car.sitelinks,
  });
}

cards.sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier) || b.fame - a.fame);

await writeFile("data/cards.json", JSON.stringify(cards));

const sql = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
// What packs and missions match on: culture, tags, launch decade ("decennie-1990")
// and country ("pays-royaume-uni").
const countryTrait = (country) =>
  `pays-${country.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, "-")}`;
const traitsOf = (c) => [
  c.culture,
  ...c.tags,
  ...(c.year ? [`decennie-${Math.floor(c.year / 10) * 10}`] : []),
  ...(c.country ? [countryTrait(c.country)] : []),
];
const rows = cards.map(
  (c) =>
    `  (${sql(c.slug)}, ${sql(c.tier)}, ${sql(c.culture)}, '{${traitsOf(c).map((t) => `"${t}"`).join(",")}}', ${c.supply ?? "null"})`,
);
await writeFile(
  "supabase/migrations/20261019150100_cards_catalogue.sql",
  `-- Generated by scripts/cars/build-cards.mjs from data/cars.json. Do not edit.\n` +
    `insert into public.cards (slug, tier, culture, traits, supply) values\n${rows.join(",\n")}\n` +
    `on conflict (slug) do update set tier = excluded.tier, culture = excluded.culture,\n` +
    `  traits = excluded.traits, supply = case when excluded.supply is null then null else greatest(excluded.supply, public.cards.minted) end;\n`,
);

/* ---------- Series ---------- */

// A series must stay completable: cars with a real run under 5 000 units
// (every legendary) are a chase of their own and never block a series.
const SERIES_MAX = 24;
const eligible = cards.filter((c) => c.supply == null || c.supply >= 5000);

function chunked(id, name, kind, members) {
  if (members.length < 5) return [];
  if (members.length <= SERIES_MAX) return [{ id, name, kind, cards: members }];
  // Too big to be fun: split by era, oldest first, into even parts.
  const dated = members.filter((c) => c.year).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  const parts = Math.ceil(dated.length / SERIES_MAX);
  const size = Math.ceil(dated.length / parts);
  const out = [];
  for (let i = 0; i < parts; i++) {
    const part = dated.slice(i * size, (i + 1) * size);
    if (part.length < 5) continue;
    const from = part[0].year;
    const to = part.at(-1).year;
    out.push({ id: `${id}-${from}`, name: `${name} ${from === to ? from : `${from}–${to}`}`, kind, cards: part });
  }
  return out;
}

const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const byBrand = new Map();
for (const c of eligible) if (c.brand) byBrand.set(c.brand, [...(byBrand.get(c.brand) ?? []), c]);

const series = [
  ...chunked("kei-cars", "Kei cars", "theme", eligible.filter((c) => c.culture === "Kei")),
  ...chunked("muscle-cars", "Muscle cars", "theme", eligible.filter((c) => c.culture === "Muscle")),
  ...chunked("bloc-de-l-est", "Bloc de l'Est", "theme", eligible.filter((c) => c.culture === "Est")),
  ...[...byBrand.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .flatMap(([brand, members]) => chunked(slug(brand), brand, "brand", members)),
].map((s) => ({
  ...s,
  cards: s.cards.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name)).map((c) => c.slug),
  // Reward: bonus packs and leaderboard points, both growing with size.
  packs: Math.ceil(s.cards.length / 6),
  points: s.cards.length * 20,
}));

await writeFile("data/series.json", JSON.stringify(series));
await writeFile(
  "supabase/migrations/20261019170100_series_catalogue.sql",
  `-- Generated by scripts/cars/build-cards.mjs. Do not edit.\n` +
    `delete from public.series_cards;\n` +
    `insert into public.series (id, name, kind, packs, points) values\n${series
      .map((s) => `  (${sql(s.id)}, ${sql(s.name)}, ${sql(s.kind)}, ${s.packs}, ${s.points})`)
      .join(",\n")}\non conflict (id) do update set name = excluded.name, kind = excluded.kind, packs = excluded.packs, points = excluded.points;\n` +
    `insert into public.series_cards (series_id, card_slug) values\n${series
      .flatMap((s) => s.cards.map((c) => `  (${sql(s.id)}, ${sql(c)})`))
      .join(",\n")};\n`,
);
console.log(`${series.length} séries (${series.filter((s) => s.kind === "theme").length} thèmes), ${series.reduce((n, s) => n + s.cards.length, 0)} cartes`);

const dist = Object.fromEntries(TIERS.map((t) => [t, cards.filter((c) => c.tier === t).length]));
console.log(`${cards.length} cartes`, dist, `· tirage limité: ${cards.filter((c) => c.supply).length}`);
console.log(
  "Légendaires les plus rares:",
  cards.filter((c) => c.tier === "legendary" && c.supply).sort((a, b) => a.supply - b.supply).slice(0, 12).map((c) => `${c.name} (${c.supply})`).join(", "),
);
