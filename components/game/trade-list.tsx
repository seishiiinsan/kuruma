"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { respondToTrade } from "@/app/actions/trades";
import type { Copy, Trade, TradeStatus } from "@/lib/game";
import { timeAgo } from "@/lib/time";
import { Avatar } from "../avatar";
import { TradingCard } from "../trading-card";
import { buttonClaim, buttonGhost } from "./ui";

const STATUS: Record<Exclude<TradeStatus, "pending">, { label: string; tone: string }> = {
  accepted: { label: "Conclu", tone: "bg-green/15 text-green" },
  declined: { label: "Refusé", tone: "bg-bg-deep text-muted" },
  cancelled: { label: "Annulé", tone: "bg-bg-deep text-muted" },
  expired: { label: "Expiré", tone: "bg-bg-deep text-muted" },
  reverted: { label: "Annulé par la modération", tone: "bg-danger/15 text-danger" },
};

function Cards({ copies, label }: { copies: Copy[]; label: string }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-xs font-black uppercase tracking-wider text-muted">{label}</figcaption>
      <ul className="flex flex-wrap gap-2">
        {copies.map((copy) => (
          <li key={copy.id}>
            <Link href={`/cartes/${copy.card.slug}`} className="block" title={copy.card.name}>
              <TradingCard card={copy.card} serial={copy.serial} interactive={false} className="w-20 sm:w-24" />
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function act(accept: boolean) {
    start(async () => {
      const result = await respondToTrade(trade.id, accept);
      setFeedback(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });
  }

  const when = trade.status === "pending" ? trade.createdAt : (trade.resolvedAt ?? trade.createdAt);
  const headline =
    trade.status === "pending"
      ? trade.outgoing
        ? `Ton offre à ${trade.other.name}`
        : `${trade.other.name} te propose un échange`
      : trade.outgoing
        ? `Ton offre à ${trade.other.name}`
        : `Offre de ${trade.other.name}`;

  return (
    <li className="panel p-5 ">
      <div className="flex items-center gap-3">
        <Link href={`/joueur/${trade.other.handle}`} className="shrink-0">
          <Avatar player={trade.other} size={40} />
        </Link>
        <p className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-extrabold">{headline}</span>
          <span className="text-muted" suppressHydrationWarning>
            {timeAgo(when)}
          </span>
        </p>
        {trade.status !== "pending" && (
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${STATUS[trade.status].tone}`}>
            {STATUS[trade.status].label}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Cards copies={trade.give} label={trade.status === "accepted" ? "Tu as donné" : "Tu donnes"} />
        <ArrowLeftRight className="size-5 shrink-0 rotate-90 self-center text-muted sm:rotate-0" aria-hidden />
        <Cards copies={trade.get} label={trade.status === "accepted" ? "Tu as reçu" : "Tu reçois"} />
      </div>

      {trade.status === "pending" && !feedback?.ok && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {trade.outgoing ? (
            <button type="button" disabled={pending} onClick={() => act(false)} className={buttonGhost}>
              Annuler l&apos;offre
            </button>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => act(true)} className={buttonClaim}>
                Accepter l&apos;échange
              </button>
              <button type="button" disabled={pending} onClick={() => act(false)} className={buttonGhost}>
                Refuser
              </button>
              <Link
                href={`/echanges/nouveau?avec=${trade.other.handle}`}
                className="btn btn-sm ml-auto"
              >
                Faire une contre-offre
              </Link>
            </>
          )}
        </div>
      )}
      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`mt-4 text-sm font-semibold ${feedback.ok ? "text-green" : "text-danger"}`}
        >
          {feedback.text}
        </p>
      )}
    </li>
  );
}

export function TradeList({ trades, empty }: { trades: Trade[]; empty: React.ReactNode }) {
  if (trades.length === 0) return <>{empty}</>;
  return (
    <ul className="flex flex-col gap-4">
      {trades.map((trade) => (
        <TradeCard key={trade.id} trade={trade} />
      ))}
    </ul>
  );
}
