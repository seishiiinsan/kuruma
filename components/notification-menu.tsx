"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Award, Bell, CheckCheck, Gift, Heart, IdCard, Package, ShieldCheck, Target } from "lucide-react";
import { markNotificationRead, markNotificationsRead } from "@/app/actions/notifications";
import type { Notification, NotificationKind } from "@/lib/game";
import { MAX_PACKS, type Wallet } from "@/lib/packs";
import { GRADES, rewardsText } from "@/lib/permit";
import { timeAgo } from "@/lib/time";
import { useWallet } from "@/lib/wallet-store";
import { Avatar } from "./avatar";

const TRADE_TEXT: Partial<Record<NotificationKind, string>> = {
  trade_received: "te propose un échange",
  trade_accepted: "a accepté ton échange",
  trade_declined: "a refusé ton échange",
  trade_cancelled: "a annulé son offre",
};

/** Wishlist alerts: what happened to a car the player looks for, and where to get it. */
function wishAlert(n: Notification) {
  const car = n.card?.name ?? "Une voiture de ta liste";
  switch (n.kind) {
    case "wish_shop":
      return { href: "/boutique", text: <><strong className="font-extrabold text-ink">{car}</strong> est en vitrine à la boutique</> };
    case "wish_used":
      return { href: "/boutique#occasions", text: <><strong className="font-extrabold text-ink">{car}</strong> est en vente d&apos;occasion</> };
    case "wish_double":
      return {
        href: n.card ? `/cartes/${n.card.slug}` : "/echanges",
        text: (
          <>
            <strong className="font-extrabold text-ink">{n.actor?.name ?? "Un joueur"}</strong> a un double de{" "}
            <strong className="font-extrabold text-ink">{car}</strong>
          </>
        ),
      };
    case "wish_market":
      return {
        href: n.card ? `/cartes/${n.card.slug}` : "/boutique#marche",
        text: (
          <>
            <strong className="font-extrabold text-ink">{n.actor?.name ?? "Un joueur"}</strong> vend{" "}
            <strong className="font-extrabold text-ink">{car}</strong>
          </>
        ),
      };
    case "market_sold":
      return {
        href: n.card ? `/cartes/${n.card.slug}` : "/boutique#marche",
        text: (
          <>
            <strong className="font-extrabold text-ink">{n.actor?.name ?? "Un joueur"}</strong> a acheté ta{" "}
            <strong className="font-extrabold text-ink">{n.card?.name ?? "voiture"}</strong>
          </>
        ),
      };
    case "market_expired":
      return {
        href: n.card ? `/cartes/${n.card.slug}` : "/collection",
        text: (
          <>
            Ta <strong className="font-extrabold text-ink">{n.card?.name ?? "voiture"}</strong> ne s&apos;est pas vendue : elle
            est revenue dans ta collection
          </>
        ),
      };
    case "friend_request":
    case "friend_accepted":
      return {
        href: n.actor ? `/joueur/${n.actor.handle}` : "/echanges/nouveau",
        text: (
          <>
            <strong className="font-extrabold text-ink">{n.actor?.name ?? "Un joueur"}</strong>{" "}
            {n.kind === "friend_request" ? "veut devenir ton ami" : "a accepté ta demande d'ami"}
          </>
        ),
      };
    case "permit_up": {
      const grade = GRADES.find((g) => g.level === n.level);
      return {
        href: "/moi",
        text: grade ? (
          <>
            Tu obtiens ton permis <strong className="font-extrabold text-ink">{grade.name}</strong> :{" "}
            {rewardsText(grade)}
          </>
        ) : (
          <>
            Ton permis passe au <strong className="font-extrabold text-ink">niveau {n.level}</strong>
          </>
        ),
      };
    }
    case "moderation":
      return {
        href: "/moi",
        text: (
          <>
            La <strong className="font-extrabold text-ink">modération</strong> a corrigé ton compte : échange ou vente
            annulé, ou solde de jetons ajusté
          </>
        ),
      };
    default:
      return null;
  }
}

export function NotificationMenu({
  notifications,
  wallet,
}: {
  notifications: Notification[];
  wallet: Wallet;
}) {
  const live = useWallet(wallet);
  // A full wallet wastes refills, and rewards wait to be claimed: worth a nudge.
  const packsFull = live.available >= MAX_PACKS;
  const nudges = [
    packsFull && {
      href: "/boosters",
      icon: Package,
      title: "Tes 10 packs sont prêts.",
      text: "Ouvre-en un pour relancer la recharge.",
    },
    live.dailyReady && {
      href: "/succes",
      icon: Gift,
      title: "Ta prime du jour t'attend.",
      text: live.streak > 0 ? `${live.streak} jour${live.streak > 1 ? "s" : ""} d'affilée : ne casse pas la série.` : "Des jetons, chaque jour.",
    },
    live.missions > 0 && {
      href: "/succes",
      icon: Target,
      title: `${live.missions} mission${live.missions > 1 ? "s" : ""} terminée${live.missions > 1 ? "s" : ""}.`,
      text: "Réclame tes jetons.",
    },
    live.claimable > 0 && {
      href: "/succes",
      icon: Award,
      title: `${live.claimable} palier${live.claimable > 1 ? "s" : ""} de succès atteint${live.claimable > 1 ? "s" : ""}.`,
      text: "Réclame tes jetons.",
    },
  ].filter((n) => n !== false);
  const menu = useRef<HTMLDivElement>(null);
  // Read on this page, before the next server reading catches up.
  const [allRead, setAllRead] = useState(false);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const isUnread = (n: Notification) => n.unread && !allRead && !read.has(n.id);
  const unread = notifications.filter(isUnread).length;
  const badge = unread + nudges.length;
  const close = () => menu.current?.hidePopover();

  function readAll() {
    setAllRead(true);
    void markNotificationsRead();
  }

  function open(n: Notification) {
    close();
    if (!isUnread(n)) return;
    setRead((ids) => new Set(ids).add(n.id));
    void markNotificationRead(n.id);
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="notification-menu"
        aria-label={`Notifications${badge ? `, ${badge} nouvelles` : ""}`}
        className="hud-pill relative size-[2.375rem] justify-center p-0 transition-[filter] hover:brightness-125"
      >
        <Bell className="size-5" aria-hidden />
        {badge > 0 && (
          <span aria-hidden className="bubble absolute -top-1.5 -right-1.5">
            {badge}
          </span>
        )}
      </button>

      <div
        ref={menu}
        id="notification-menu"
        popover="auto"
        className="panel fixed inset-auto top-[4.5rem] m-0 max-h-[min(32rem,calc(100vh-6rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-1.5 text-sm text-ink shadow-[var(--shadow-lift)]"
        style={{ right: "max(1.25rem, calc((100vw - 72rem) / 2 + 1.5rem))" }}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-2">
          <p className="title-drop font-display text-base">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={readAll}
              className="-mr-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-extrabold text-muted transition-colors hover:bg-white/10 hover:text-ink"
            >
              <CheckCheck className="size-4" aria-hidden />
              Tout marquer comme lu
            </button>
          )}
        </div>

        {nudges.map(({ href, icon: Icon, title, text }) => (
          <Link
            key={title}
            href={href}
            onClick={close}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
              <Icon className="size-4 text-accent" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="font-extrabold">{title}</span>
              <span className="block text-muted">{text}</span>
            </span>
          </Link>
        ))}

        {notifications.length === 0 && nudges.length === 0 ? (
          <p className="px-3 pt-1 pb-4 text-muted">
            Rien de neuf. Les offres d&apos;échange, leurs réponses et les voitures de ta liste d&apos;envies arriveront ici.
          </p>
        ) : (
          <ul>
            {notifications.map((n) => {
              const unreadNow = isUnread(n);
              const wish = wishAlert(n);
              return (
                <li key={n.id}>
                  <Link
                    href={wish?.href ?? "/echanges"}
                    onClick={() => open(n)}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10"
                  >
                    {n.kind === "permit_up" ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
                        <IdCard className="size-4 text-accent" aria-hidden />
                      </span>
                    ) : n.kind === "moderation" ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue/15">
                        <ShieldCheck className="size-4 text-blue" aria-hidden />
                      </span>
                    ) : wish && !n.actor ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/15">
                        <Heart className="size-4 text-danger" aria-hidden />
                      </span>
                    ) : (
                      <Avatar player={n.actor ?? { name: "?", avatarUrl: null }} size={36} />
                    )}
                    <span className="flex-1">
                      <span className={unreadNow ? "text-ink" : "text-muted"}>
                        {wish ? (
                          wish.text
                        ) : (
                          <>
                            <strong className="font-extrabold text-ink">{n.actor?.name ?? "Un joueur"}</strong>{" "}
                            {TRADE_TEXT[n.kind]}
                          </>
                        )}
                      </span>
                      <span className="block text-xs text-muted" suppressHydrationWarning>
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {unreadNow && (
                      <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-danger">
                        <span className="sr-only">Non lue</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
