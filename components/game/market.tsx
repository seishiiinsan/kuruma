"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Tag, X } from "lucide-react";
import { buyListing, cancelListing, listCopy } from "@/app/actions/economy";
import { formatSerial } from "@/lib/cards";
import { MARKET_DAYS, MARKET_FEE_RATE, QUOTE_DAYS, marketFee, marketWeight, type HistoryPoint, type Quote } from "@/lib/market";
import type { Wallet } from "@/lib/packs";
import type { Listing } from "@/lib/shop";
import { useWallet } from "@/lib/wallet-store";
import { Avatar } from "../avatar";
import { Coins } from "./coins";
import { buttonGhost, buttonPrimary } from "./ui";
import { useEconomy } from "./use-economy";

const int = new Intl.NumberFormat("fr-FR");
const dayLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
const DAY = 86_400_000;

function Feedback({ result }: { result: { ok: boolean; text: string } | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-muted" : "font-bold text-danger"}`}>
      {result.text}
    </p>
  );
}

/* ---------- What the quote is made of ---------- */

const factor = (f: number) => `×${f.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function QuoteBreakdown({
  quote,
  tierLabel,
  supply,
  minted,
  listings,
}: {
  quote: Quote;
  tierLabel: string;
  supply: number | null;
  minted: number;
  listings: number;
}) {
  const weight = marketWeight(quote.sales);
  const rows: [label: string, detail: string, value: string][] = [
    [`Prix de base ${tierLabel.toLowerCase()}`, "Ce que vaut une occasion de cette rareté.", int.format(quote.tierPrice)],
    [
      "Exemplaires construits",
      supply
        ? `${int.format(supply)} en vrai, comparés aux autres voitures ${tierLabel.toLowerCase()}s : moins il y en a, plus elle vaut.`
        : "Production inconnue : pas de correction.",
      factor(quote.scarcity),
    ],
    [
      "Exemplaires sortis",
      supply
        ? `${int.format(minted)} sur ${int.format(supply)} déjà sortis des packs et de la boutique. Elle prend de la valeur en s'épuisant.`
        : "Sans limite connue d'exemplaires : pas de correction.",
      factor(quote.exhaustion),
    ],
    ["Demande", "Les joueurs qui l'ont dans leur liste d'envies.", factor(quote.demand)],
    ["Offre", `${listings} exemplaire${listings > 1 ? "s" : ""} en vente sur le marché.`, factor(quote.offer)],
  ];

  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer list-none text-xs font-bold text-muted marker:hidden hover:text-ink">
        <span className="group-open:hidden">Comment se calcule la cote ?</span>
        <span className="hidden group-open:inline">Masquer le détail</span>
      </summary>
      <dl className="mt-3 divide-y divide-white/10 rounded-xl bg-bg-deep/50 px-4">
        {rows.map(([label, detail, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-2.5">
            <dt className="min-w-0">
              <span className="block font-extrabold">{label}</span>
              <span className="block text-xs text-muted">{detail}</span>
            </dt>
            <dd className="shrink-0 font-black tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="font-extrabold">Valeur de base</dt>
          <dd className="font-black tabular-nums">
            <Coins amount={quote.base} />
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="min-w-0">
            <span className="block font-extrabold">Ventes entre joueurs</span>
            <span className="block text-xs text-muted">
              {quote.sales === 0 || quote.marketMedian === null
                ? `Aucune sur ${QUOTE_DAYS} jours. Chaque paire vendeur-acheteur compte une fois, pour qu'on ne puisse pas gonfler la cote entre amis.`
                : `${quote.sales} paire${quote.sales > 1 ? "s" : ""} vendeur-acheteur sur ${QUOTE_DAYS} jours, prix médian ${int.format(quote.marketMedian)}. Elles pèsent ${Math.round(weight * 100)} % de la cote.`}
            </span>
          </dt>
          <dd className="shrink-0 font-black tabular-nums">{Math.round(weight * 100)} %</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="font-black">Cote</dt>
          <dd className="font-black tabular-nums text-accent">
            <Coins amount={quote.reference} />
          </dd>
        </div>
      </dl>
    </details>
  );
}

/* ---------- Quote chart: daily median price over time ---------- */

/** Round step for about 4 gridlines. */
function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

export function QuoteChart({ history, today }: { history: HistoryPoint[]; today: string }) {
  const [range, setRange] = useState<30 | 90>(30);
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  const end = toTime(today);
  const start = end - (range - 1) * DAY;
  const points = useMemo(() => history.filter((p) => toTime(p.day) >= start), [history, start]);
  const hasPoints = points.length > 0;
  // Drawn at the container's pixel width, so text and marks keep their size.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasPoints]);

  const H = 200;
  const pad = { top: 14, right: 12, bottom: 26, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const top = Math.max(1, ...points.map((p) => p.high));
  const step = niceStep(top);
  const yMax = Math.ceil(top / step) * step;
  const x = (day: string) => pad.left + ((toTime(day) - start) / (end - start || DAY)) * innerW;
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const xTicks = [start, start + (end - start) / 2, end];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.median).toFixed(1)}`).join(" ");
  const active = hover !== null ? points[hover] : null;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].day) - px) < Math.abs(x(points[best].day) - px)) best = i;
    }
    setHover(best);
  }

  return (
    <figure className="flex min-w-0 flex-col gap-3" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <figcaption id={titleId} className="text-sm font-extrabold">
          Prix de vente médian par jour
        </figcaption>
        <div role="group" aria-label="Période" className="inline-flex rounded-xl bg-bg-deep p-0.5">
          {([30, 90] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setHover(null);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${range === r ? "bg-white/15 text-ink" : "text-muted hover:text-ink"}`}
            >
              {r} jours
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="panel-sunken px-4 py-8 text-center text-sm text-muted">
          Aucune vente entre joueurs sur {range} jours. La première fixera la cote.
        </p>
      ) : (
        <div ref={box} className="relative w-full min-w-0 overflow-hidden">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block touch-none select-none"
            role="img"
            aria-label={`Cote sur ${range} jours : ${points.length} jour${points.length > 1 ? "s" : ""} avec des ventes, dernier prix médian ${int.format(points[points.length - 1].median)} jetons.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-white/10" strokeWidth="1" />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[11px] font-bold tabular-nums">
                  {int.format(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text
                key={t}
                x={pad.left + ((t - start) / (end - start)) * innerW}
                y={H - 6}
                textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                className="fill-[var(--muted)] text-[11px] font-bold"
              >
                {dayLabel.format(t)}
              </text>
            ))}

            {/* Low-high spread of each day, recessive behind the median. */}
            {points.map((p) =>
              p.high > p.low ? (
                <line key={`r-${p.day}`} x1={x(p.day)} x2={x(p.day)} y1={y(p.low)} y2={y(p.high)} stroke="var(--accent)" strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round" />
              ) : null,
            )}
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {active && (
              <line x1={x(active.day)} x2={x(active.day)} y1={pad.top} y2={pad.top + innerH} stroke="currentColor" className="text-white/30" strokeWidth="1" />
            )}
            {points.map((p, i) => (
              <circle
                key={p.day}
                cx={x(p.day)}
                cy={y(p.median)}
                r={hover === i ? 6 : 4}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}
          </svg>

          {active && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-xl bg-bg-deep px-3 py-2 text-xs shadow-[var(--shadow-lift)]"
              style={{ left: `clamp(6rem, ${(x(active.day) / W) * 100}%, calc(100% - 6rem))` }}
            >
              <p className="font-extrabold first-letter:uppercase">{dayLong.format(toTime(active.day))}</p>
              <p className="mt-0.5 tabular-nums">
                Médiane <strong className="font-black">{int.format(active.median)}</strong> jetons
              </p>
              <p className="text-muted tabular-nums">
                {active.sales} vente{active.sales > 1 ? "s" : ""}
                {active.high > active.low && ` · de ${int.format(active.low)} à ${int.format(active.high)}`}
              </p>
            </div>
          )}
        </div>
      )}

      {points.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-bold text-muted hover:text-ink">Voir les données</summary>
          <table className="mt-2 w-full text-left text-xs tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-bold">Jour</th>
                <th className="py-1 text-right font-bold">Médiane</th>
                <th className="py-1 text-right font-bold">Min – max</th>
                <th className="py-1 text-right font-bold">Ventes</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.day} className="border-t border-white/10">
                  <td className="py-1">{dayLabel.format(toTime(p.day))}</td>
                  <td className="py-1 text-right font-extrabold">{int.format(p.median)}</td>
                  <td className="py-1 text-right">
                    {int.format(p.low)} – {int.format(p.high)}
                  </td>
                  <td className="py-1 text-right">{p.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}

/* ---------- One listing: buy it, or take yours back ---------- */

export function ListingRow({
  listing,
  supply,
  mine,
  title,
  wallet: initial,
}: {
  listing: Listing;
  supply: number | null;
  mine: boolean;
  /** Replaces the seller's name and avatar, e.g. with the car in a list of your own listings. */
  title?: string;
  wallet: Wallet | null;
}) {
  const { pending, result, run } = useEconomy();
  const wallet = useWallet(initial ?? { available: 0, msToNext: null, bonus: 0, coins: 0, dailyReady: false, streak: 0, claimable: 0, missions: 0, readAt: 0 });
  const short = listing.price - wallet.coins;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {!title && listing.seller && <Avatar player={listing.seller} size={32} />}
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold">
            {title ?? (mine ? "Ton annonce" : (listing.seller?.name ?? "Un joueur"))}
          </span>
          <span className="block text-xs text-muted tabular-nums">{formatSerial(listing.serial, supply)}</span>
        </span>
      </span>
      <Coins amount={listing.price} className="font-black" />
      {mine ? (
        <button type="button" disabled={pending} onClick={() => run(() => cancelListing(listing.id))} className={`${buttonGhost} btn-sm`}>
          <X className="size-4" aria-hidden />
          {pending ? "…" : "Retirer"}
        </button>
      ) : initial ? (
        <button
          type="button"
          disabled={pending || short > 0}
          onClick={() => run(() => buyListing(listing.id))}
          title={short > 0 ? `Il te manque ${int.format(short)} jetons` : undefined}
          className={`${buttonPrimary} btn-sm`}
        >
          {pending ? "Achat…" : "Acheter"}
        </button>
      ) : null}
      {result && (
        <div className="basis-full">
          <Feedback result={result} />
        </div>
      )}
    </li>
  );
}

/* ---------- Sell one of your copies ---------- */

export function SellForm({
  copies,
  supply,
  quote,
}: {
  copies: { id: string; serial: number }[];
  supply: number | null;
  quote: Quote;
}) {
  const { pending, result, run } = useEconomy();
  const [copyId, setCopyId] = useState(copies[0]?.id ?? "");
  const [price, setPrice] = useState(String(quote.reference));
  const n = Number(price);
  const valid = Number.isInteger(n) && n >= quote.min && n <= quote.max;
  const fee = valid ? marketFee(n) : 0;
  const priceId = useId();

  if (copies.length === 0) return null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) run(() => listCopy(copyId, n));
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        {copies.length > 1 && (
          <label className="flex flex-col gap-1 text-xs font-bold text-muted">
            Exemplaire
            <select
              value={copyId}
              onChange={(e) => setCopyId(e.target.value)}
              className="h-11 rounded-xl bg-bg-deep px-3 text-sm font-extrabold text-ink"
            >
              {copies.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatSerial(c.serial, supply)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label htmlFor={priceId} className="flex flex-col gap-1 text-xs font-bold text-muted">
          Ton prix
          <span className="flex h-11 items-center gap-2 rounded-xl bg-bg-deep px-3 focus-within:ring-2 focus-within:ring-accent">
            <input
              id={priceId}
              type="number"
              inputMode="numeric"
              min={quote.min}
              max={quote.max}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-describedby={`${priceId}-hint`}
              className="w-24 bg-transparent text-sm font-extrabold text-ink tabular-nums outline-none"
            />
            <span className="text-xs">jetons</span>
          </span>
        </label>
        <button type="button" onClick={() => setPrice(String(quote.reference))} className={`${buttonGhost} btn-sm h-11`}>
          Prix suggéré · {int.format(quote.reference)}
        </button>
        <button type="submit" disabled={pending || !valid} className={`${buttonPrimary} h-11`}>
          <Tag className="size-4" aria-hidden />
          {pending ? "Mise en vente…" : "Mettre en vente"}
        </button>
      </div>
      <p id={`${priceId}-hint`} className={`text-xs ${valid || price === "" ? "text-muted" : "font-bold text-danger"}`}>
        Entre {int.format(quote.min)} et {int.format(quote.max)} jetons.
        {valid && (
          <>
            {" "}
            Tu touches <strong className="font-extrabold text-ink">{int.format(n - fee)}</strong> après {int.format(fee)} de frais (
            {MARKET_FEE_RATE * 100} %). L&apos;annonce dure {MARKET_DAYS} jours, puis la carte te revient.
          </>
        )}
      </p>
      <Feedback result={result} />
    </form>
  );
}

/** Link to the market section of the shop. */
export function MarketLink() {
  return (
    <Link href="/boutique#marche" className="text-sm font-extrabold text-accent underline-offset-4 hover:underline">
      Tout le marché
    </Link>
  );
}
