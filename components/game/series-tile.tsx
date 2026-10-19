import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { cardBySlug } from "@/lib/catalog";
import type { SeriesProgress } from "@/lib/series";

/** One series in the album: a peek at its cars and how far along you are. */
export function SeriesTile({ series, owned }: { series: SeriesProgress; owned: Set<string> }) {
  const peek = series.cards.slice(0, 4);
  const pct = Math.round((series.owned / series.cards.length) * 100);
  return (
    <Link
      href={`/album/${series.id}`}
      className="group flex flex-col gap-4 panel p-4  transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110"
    >
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {peek.map((slug) => {
          const card = cardBySlug(slug);
          if (!card) return null;
          return (
            <span key={slug} className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-lo">
              <Image
                src={card.image}
                alt=""
                fill
                sizes="80px"
                className={`object-cover ${owned.has(slug) ? "" : "opacity-50 grayscale"}`}
              />
            </span>
          );
        })}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate font-semibold group-hover:underline">{series.name}</h3>
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {series.owned}/{series.cards.length}
          </span>
        </div>
        <div className={`gauge mt-2 h-2.5 ${series.complete ? "gauge-green" : ""}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          {series.claimedAt ? (
            <>
              <Check className="size-3.5 text-green" aria-hidden />
              Terminée · {series.points} pts
            </>
          ) : series.complete ? (
            <span className="font-extrabold text-accent">Récompense à réclamer</span>
          ) : (
            <>
              Récompense : {series.packs} pack{series.packs > 1 ? "s" : ""} · {series.points} pts
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
