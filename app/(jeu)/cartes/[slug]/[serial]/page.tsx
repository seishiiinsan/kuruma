import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, ArrowLeftRight, Store, Tag, UserX } from "lucide-react";
import { cardBySlug } from "@/lib/catalog";
import { FINISHES, TIERS, formatInt, formatSerial, serialBadge, toFace } from "@/lib/cards";
import { getCopyProvenance, getViewer, type HistoryVia } from "@/lib/game";
import { Avatar } from "@/components/avatar";
import { RarityDiamonds } from "@/components/rarity-diamonds";
import { TradingCard } from "@/components/trading-card";
import { Coins } from "@/components/game/coins";

const parseSerial = (raw: string) => (/^[1-9]\d{0,6}$/.test(raw) ? Number(raw) : null);

export async function generateMetadata({
  params,
}: PageProps<"/cartes/[slug]/[serial]">): Promise<Metadata> {
  const { slug, serial: raw } = await params;
  const card = cardBySlug(slug);
  const serial = parseSerial(raw);
  return {
    title: card && serial ? `${card.name} ${formatSerial(serial, card.supply)} — Kuruma` : "Exemplaire — Kuruma",
  };
}

export default function CopyPage({ params }: PageProps<"/cartes/[slug]/[serial]">) {
  return (
    <Suspense fallback={<div className="aspect-[5/7] w-64 animate-pulse rounded-[14px] bg-surface-lo sm:w-80" />}>
      <CopyDetail params={params} />
    </Suspense>
  );
}

const VIA: Record<HistoryVia, { label: string; first: string; icon: typeof Package }> = {
  pack: { label: "Tirée d'un pack", first: "Tirée d'un pack", icon: Package },
  trade: { label: "Reçue en échange", first: "Reçue en échange", icon: ArrowLeftRight },
  shop: { label: "Achetée d'occasion en boutique", first: "Achetée en boutique", icon: Store },
  market: { label: "Achetée sur le marché", first: "Achetée sur le marché", icon: Tag },
};

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

async function CopyDetail({ params }: { params: Promise<{ slug: string; serial: string }> }) {
  const { slug, serial: raw } = await params;
  const card = cardBySlug(slug);
  const serial = parseSerial(raw);
  if (!card || serial === null) notFound();

  const [viewer, copy] = await Promise.all([getViewer(), getCopyProvenance(slug, serial)]);
  if (!copy) notFound();

  const badge = serialBadge(copy.serial, card.supply);
  const current = copy.status === "owned" ? copy.owners.at(-1) : undefined;
  const isMine = Boolean(viewer && current?.player?.id === viewer.id);
  // Newest owner on top: who has it now reads first.
  const timeline = copy.owners.map((owner, i) => ({ owner, first: i === 0 })).reverse();
  const hands = new Set(copy.owners.map((o) => o.player?.id ?? `gone-${o.at}`)).size;

  return (
    <>
      <Link href={`/cartes/${card.slug}`} className="btn btn-sm mb-8">
        <ArrowLeft className="size-4" aria-hidden />
        {card.name}
      </Link>

      <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
        <div className="shrink-0 lg:sticky lg:top-24">
          <TradingCard card={toFace(card)} serial={copy.serial} finish={copy.finish} className="w-64 sm:w-80" priority />
        </div>

        <div className="w-full min-w-0 max-w-xl flex-1">
          <p className="text-sm font-extrabold text-muted">Exemplaire</p>
          <h1 className="title-drop text-balance font-display text-[2rem] leading-[1.05] tabular-nums sm:text-[2.75rem]">
            {formatSerial(copy.serial, card.supply)}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-black">
            <span
              className="inline-flex items-center gap-2 rounded-full bg-surface-lo px-3 py-1.5"
              style={{ color: TIERS[card.tier].color }}
            >
              <RarityDiamonds tier={card.tier} size={11} />
              {TIERS[card.tier].label}
            </span>
            {copy.finish !== "standard" && (
              <span className="rounded-full bg-surface-lo px-3 py-1.5">{FINISHES[copy.finish].label}</span>
            )}
            {badge && (
              <span className="rounded-full bg-tier-legendary px-3 py-1.5 text-[#4a3200]">{badge}</span>
            )}
          </p>
          {copy.finish !== "standard" && <p className="mt-3 text-sm text-muted">{FINISHES[copy.finish].blurb}</p>}

          <section className="mt-8 panel p-5">
            <h2 className="title-drop font-display text-lg">Aujourd&apos;hui</h2>
            {copy.status === "owned" ? (
              current?.player ? (
                <Link href={`/joueur/${current.player.handle}`} className="group mt-3 flex items-center gap-3">
                  <Avatar player={current.player} size={44} />
                  <span>
                    <span className="block font-extrabold group-hover:underline">
                      {isMine ? "À toi" : current.player.name}
                    </span>
                    <span className="block text-sm text-muted">depuis le {day.format(new Date(current.at))}</span>
                  </span>
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted">Chez un collectionneur.</p>
              )
            ) : copy.status === "market" ? (
              <p className="mt-2 text-sm">
                En vente sur le marché
                {copy.listingPrice !== null && (
                  <>
                    {" "}pour <Coins amount={copy.listingPrice} className="font-black" />
                  </>
                )}
                .{" "}
                <Link href={`/cartes/${card.slug}`} className="font-semibold underline underline-offset-4">
                  Voir l&apos;annonce
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-sm">
                Revendue à la boutique, elle attend un acheteur.{" "}
                <Link href="/boutique#occasions" className="font-semibold underline underline-offset-4">
                  Voir les occasions
                </Link>
              </p>
            )}
          </section>

          <section className="mt-10">
            <h2 className="title-drop font-display text-lg sm:text-xl">Son parcours</h2>
            <p className="mt-1 text-sm text-muted">
              {copy.owners.length === 0
                ? "Pas encore d'historique pour cet exemplaire."
                : hands === 1
                  ? "Toujours entre les mains de son premier propriétaire."
                  : `Passée entre ${formatInt(hands)} mains.`}
            </p>

            {timeline.length > 0 && (
              <ol className="mt-5 flex flex-col">
                {timeline.map(({ owner, first }, i) => {
                  const Icon = owner.player ? VIA[owner.via].icon : UserX;
                  const last = i === timeline.length - 1;
                  return (
                    <li key={`${owner.at}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                      {!last && (
                        <span aria-hidden className="absolute top-10 bottom-0 left-[19px] w-0.5 rounded-full bg-white/10" />
                      )}
                      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-lo text-muted">
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {owner.player ? (
                          <Link
                            href={`/joueur/${owner.player.handle}`}
                            className="inline-flex max-w-full items-center gap-2 font-extrabold hover:underline"
                          >
                            <Avatar player={owner.player} size={22} />
                            <span className="truncate">
                              {viewer?.id === owner.player.id ? "Toi" : owner.player.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="font-extrabold text-muted">Un ancien joueur</span>
                        )}
                        <p className="mt-0.5 text-sm text-muted">
                          {first ? VIA[owner.via].first : VIA[owner.via].label}
                          {owner.price !== null && (
                            <>
                              {" "}pour <Coins amount={owner.price} />
                            </>
                          )}
                          {" · "}
                          <time dateTime={owner.at}>{day.format(new Date(owner.at))}</time>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
