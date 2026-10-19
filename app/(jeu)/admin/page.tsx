import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { getAdminPlayer, getReports, getSuspects, isAdmin, type AdminPlayer } from "@/lib/admin";
import { cardBySlug } from "@/lib/catalog";
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation";
import { BanForm, CoinsForm, ResolveReport, RevertButton } from "@/components/game/admin-actions";
import { EmptyState, PageHeader, Panel, SectionTitle, formatScore } from "@/components/game/ui";

export const metadata: Metadata = { title: "Modération — Kuruma", robots: { index: false } };

type Search = { joueur?: string; signalements?: string };

const when = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
const at = (iso: string | null) => (iso ? when.format(new Date(iso)) : "—");
const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const carName = (slug: string) => cardBySlug(slug)?.name ?? slug;
const reasonLabel = (r: string) => REPORT_REASONS[r as ReportReason] ?? r;

const TRADE_STATUS: Record<string, string> = {
  pending: "En attente",
  accepted: "Conclu",
  declined: "Refusé",
  cancelled: "Annulé",
  expired: "Expiré",
  reverted: "Annulé (modération)",
};

function PlayerLink({ handle, name }: { handle: string | null; name?: string | null }) {
  if (!handle) return <span className="text-muted">compte supprimé</span>;
  return (
    <Link href={`/admin?joueur=${handle}`} className="font-extrabold underline-offset-4 hover:underline">
      {name ?? handle} <span className="font-normal text-muted">@{handle}</span>
    </Link>
  );
}

async function Reports({ status }: { status: "open" | "resolved" | "dismissed" }) {
  const reports = await getReports(status);
  if (reports.length === 0) return <EmptyState title="Aucun signalement." />;
  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => (
        <li key={r.id}>
          <Panel className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                <PlayerLink handle={r.target_handle} name={r.target_name} />
                {r.target_banned && <span className="ml-2 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-black text-danger">Banni</span>}
                <span className="ml-2 text-sm text-muted">
                  {r.target_open_reports} signalement{r.target_open_reports > 1 ? "s" : ""} ouvert{r.target_open_reports > 1 ? "s" : ""}
                </span>
              </p>
              <p className="text-xs text-muted">{at(r.created_at)}</p>
            </div>
            <p className="text-sm">
              <strong className="font-black">{reasonLabel(r.reason)}</strong>
              {r.details && <span className="text-muted"> · {r.details}</span>}
              <span className="block text-xs text-muted">
                par <PlayerLink handle={r.reporter_handle} name={r.reporter_name} />
              </span>
            </p>
            {status === "open" ? (
              <ResolveReport id={r.id} />
            ) : (
              r.resolution && <p className="text-xs text-muted">Suite : {r.resolution}</p>
            )}
          </Panel>
        </li>
      ))}
    </ul>
  );
}

async function Suspects() {
  const pairs = await getSuspects();
  if (pairs.length === 0) return <EmptyState title="Aucune paire de joueurs ne commerce beaucoup ensemble." />;
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-bold">Joueur A</th>
            <th className="px-4 py-3 font-bold">Joueur B</th>
            <th className="px-4 py-3 text-right font-bold">Échanges</th>
            <th className="px-4 py-3 text-right font-bold">Ventes</th>
            <th className="px-4 py-3 text-right font-bold">Jetons</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={`${p.a_handle}-${p.b_handle}`} className="border-t border-white/10">
              <td className="px-4 py-2.5">
                <PlayerLink handle={p.a_handle} name={p.a_name} /> <span className="text-xs text-muted">{p.a_days} j</span>
              </td>
              <td className="px-4 py-2.5">
                <PlayerLink handle={p.b_handle} name={p.b_name} /> <span className="text-xs text-muted">{p.b_days} j</span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{p.trades}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{p.sales}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatScore(p.jetons)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function PlayerFile({ player }: { player: AdminPlayer }) {
  const banned = player.banned_until !== null && new Date(player.banned_until) > new Date();
  const facts: [string, string][] = [
    ["Compte Kuruma", `${at(player.created_at)} (${days(player.created_at)} j)`],
    ["Compte Discord", player.discord_created_at ? `${at(player.discord_created_at)} (${days(player.discord_created_at)} j)` : "inconnu"],
    ["Jetons", formatScore(player.coins)],
    ["Packs bonus", String(player.bonus)],
    ["Exemplaires", formatScore(player.copies)],
    ["Packs ouverts", formatScore(player.packs)],
  ];

  return (
    <div className="flex flex-col gap-10">
      <Panel className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="title-drop font-display text-2xl">
            {player.name ?? player.handle} <span className="text-base text-muted">@{player.handle}</span>
          </h2>
          <Link href={`/joueur/${player.handle}`} className="text-sm font-bold text-muted underline-offset-4 hover:underline">
            Profil public
          </Link>
        </div>
        {banned && (
          <p className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-bold text-danger">
            Banni jusqu&apos;au {at(player.banned_until)}
            {player.ban_reason && ` · ${player.ban_reason}`}
          </p>
        )}
        {!banned && player.trade_block && (
          <p className="text-sm text-muted">Échanges bloqués : {player.trade_block}</p>
        )}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="panel-sunken px-4 py-3">
              <dt className="text-xs font-bold text-muted">{label}</dt>
              <dd className="mt-0.5 font-black tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold">Bannissement</p>
            <BanForm userId={player.id} banned={banned} />
          </div>
          <div>
            <p className="mb-2 text-sm font-bold">Solde de jetons</p>
            <CoinsForm userId={player.id} />
          </div>
        </div>
      </Panel>

      <section>
        <SectionTitle detail="Les 40 derniers. Annuler remet chaque carte à son ancien propriétaire, si aucune n'a bougé depuis.">
          Échanges
        </SectionTitle>
        {player.trades.length === 0 ? (
          <div className="mt-4"><EmptyState title="Aucun échange." /></div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {player.trades.map((t) => {
              const sent = t.items.filter((i) => (i.side === "give") === t.outgoing);
              const got = t.items.filter((i) => (i.side === "give") !== t.outgoing);
              return (
                <li key={t.id} className="panel-sunken flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p>
                      {t.outgoing ? "Vers" : "De"} <PlayerLink handle={t.partner_handle} name={t.partner_name} />
                      {t.partner_young && <span className="ml-2 text-xs font-bold text-blue">compte récent</span>}
                      <span className="ml-2 text-xs text-muted">
                        {TRADE_STATUS[t.status] ?? t.status} · {at(t.resolved_at ?? t.created_at)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Donne : {sent.map((i) => `${carName(i.slug)} nº${i.serial}`).join(", ") || "—"}
                      <br />
                      Reçoit : {got.map((i) => `${carName(i.slug)} nº${i.serial}`).join(", ") || "—"}
                    </p>
                  </div>
                  {t.status === "accepted" && <RevertButton kind="trade" id={t.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle detail="Annuler rend la voiture au vendeur et le prix à l'acheteur ; le vendeur rend ce qu'il a touché, dans la limite de son solde.">
          Marché
        </SectionTitle>
        {player.sales.length === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune vente ni achat." /></div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {player.sales.map((s) => (
              <li key={s.id} className="panel-sunken flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="min-w-0 flex-1">
                  {s.sold ? "Vendu à" : "Acheté à"} <PlayerLink handle={s.partner_handle} name={s.partner_name} /> ·{" "}
                  <strong className="font-extrabold">{carName(s.card_slug)}</strong> · {formatScore(s.price)} jetons
                  <span className="ml-2 text-xs text-muted">
                    {at(s.sold_at)}
                    {s.reverted_at && " · annulée"}
                  </span>
                </p>
                {!s.reverted_at && <RevertButton kind="sale" id={s.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Mouvements de jetons</SectionTitle>
          <ul className="mt-4 flex flex-col text-sm">
            {player.ledger.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-white/5 py-1.5">
                <span className="text-muted">
                  {at(l.created_at)} · {l.reason}
                  {l.ref && ` · ${l.ref.length > 24 ? `${l.ref.slice(0, 24)}…` : l.ref}`}
                </span>
                <span className={`font-black tabular-nums ${l.amount < 0 ? "text-danger" : "text-green"}`}>
                  {l.amount > 0 ? "+" : ""}
                  {formatScore(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-10">
          <div>
            <SectionTitle>Signalements reçus</SectionTitle>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {player.reports.length === 0 && <li className="text-muted">Aucun.</li>}
              {player.reports.map((r) => (
                <li key={r.id}>
                  <strong className="font-extrabold">{reasonLabel(r.reason)}</strong>
                  <span className="text-muted">
                    {" "}· @{r.reporter_handle} · {at(r.created_at)} · {r.status}
                    {r.details && ` · ${r.details}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionTitle>Journal de modération</SectionTitle>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {player.log.length === 0 && <li className="text-muted">Rien.</li>}
              {player.log.map((m, i) => (
                <li key={i} className="text-muted">
                  <strong className="font-extrabold text-ink">{m.action}</strong> · @{m.admin_handle ?? "?"} · {at(m.created_at)}
                  {typeof m.detail.note === "string" && m.detail.note && ` · ${m.detail.note}`}
                  {typeof m.detail.reason === "string" && m.detail.reason && ` · ${m.detail.reason}`}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

async function PlayerLookup({ handle }: { handle: string }) {
  const player = await getAdminPlayer(handle);
  if (!player) return <EmptyState title={`Aucun joueur @${handle}.`} />;
  return <PlayerFile player={player} />;
}

async function Console({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await isAdmin())) notFound();
  const { joueur, signalements } = await searchParams;
  const status = signalements === "traites" ? "resolved" : signalements === "classes" ? "dismissed" : "open";

  return (
    <>
      <form action="/admin" className="mb-10 flex max-w-xl gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Pseudo du joueur</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="joueur" defaultValue={joueur ?? ""} placeholder="Pseudo (@handle)" className="field pl-10" />
        </label>
        <button type="submit" className="btn btn-blue">
          Ouvrir la fiche
        </button>
      </form>

      {joueur ? (
        <PlayerLookup handle={joueur.replace(/^@/, "")} />
      ) : (
        <div className="flex flex-col gap-12">
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionTitle>Signalements</SectionTitle>
              <nav className="flex gap-3 text-sm font-bold">
                {[
                  ["Ouverts", "/admin"],
                  ["Traités", "/admin?signalements=traites"],
                  ["Classés", "/admin?signalements=classes"],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="text-muted underline-offset-4 hover:text-ink hover:underline">
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-4">
              <Reports status={status} />
            </div>
          </section>
          <section>
            <SectionTitle detail="Paires de joueurs qui ont conclu au moins 2 affaires ensemble en 30 jours : la trace habituelle d'un compte principal et de ses comptes secondaires.">
              Comptes liés possibles
            </SectionTitle>
            <div className="mt-4">
              <Suspects />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <>
      <PageHeader title="Modération" description="Signalements, bans, annulations et corrections de solde. Chaque action est journalisée." />
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Console searchParams={searchParams} />
      </Suspense>
    </>
  );
}
