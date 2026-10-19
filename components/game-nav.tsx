"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Award,
  Layers,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { Wallet } from "@/lib/packs";
import { useWallet } from "@/lib/wallet-store";

type NavItem = { href: string; label: string; icon: LucideIcon | typeof PackIcon; badge?: keyof Badges };

type Badges = { packs: number; trades: number; rewards: number };

/** A sealed booster, drawn: bag, crimped seals, the photo window. */
export function PackIcon({ className = "size-5" }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M6 2.5h12l-.5 2v15l.5 2H6l.5-2v-15z" />
      <path d="M6.5 4.5h11M6.5 19.5h11" strokeWidth="1.6" />
      <path d="M9 8h7l-1 5H8z" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

/** Live counts: packs and rewards come from the shared wallet store, so they follow every action. */
function useBadges(wallet: Wallet, trades: number): Badges {
  const live = useWallet(wallet);
  return { packs: live.total, trades, rewards: live.claimable + live.missions + (live.dailyReady ? 1 : 0) };
}

const BOOSTERS: NavItem = { href: "/boosters", label: "Boosters", icon: PackIcon, badge: "packs" };

const GAME_LINKS: NavItem[] = [
  BOOSTERS,
  { href: "/collection", label: "Collection", icon: Layers },
  { href: "/echanges", label: "Échanges", icon: ArrowLeftRight, badge: "trades" },
  { href: "/boutique", label: "Boutique", icon: Store },
  { href: "/succes", label: "Succès", icon: Award, badge: "rewards" },
];

/* Phones: Boosters raised in the middle. Ranking lives in the account menu on every screen. */
const MOBILE_LINKS: NavItem[] = [GAME_LINKS[1], GAME_LINKS[2], BOOSTERS, GAME_LINKS[3], GAME_LINKS[4]];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/collection" && (pathname.startsWith("/cartes/") || pathname.startsWith("/album")));
}

const BADGE_TEXT: Record<keyof Badges, string> = {
  packs: "packs disponibles",
  trades: "offres à traiter",
  rewards: "récompenses à réclamer",
};

const badgeLabel = (item: NavItem, badges: Badges) => {
  if (!item.badge || badges[item.badge] <= 0) return item.label;
  return `${item.label}, ${badges[item.badge]} ${BADGE_TEXT[item.badge]}`;
};

function Bubble({ count, gold = false }: { count: number; gold?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="bubble"
      style={gold ? { background: "var(--accent)", color: "var(--accent-ink)", boxShadow: "0 2px 0 var(--accent-edge), 0 0 0 2px var(--bg-deep)" } : undefined}
    >
      {count}
    </span>
  );
}

export function GameNavLinks({ wallet, trades }: { wallet: Wallet; trades: number }) {
  const isActive = useIsActive();
  const badges = useBadges(wallet, trades);
  return (
    <nav aria-label="Jeu" className="hidden items-center gap-1 lg:flex">
      {GAME_LINKS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={badgeLabel(item, badges)}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={`relative inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-extrabold transition-colors xl:gap-2 xl:px-3 ${
              active ? "bg-white/10 text-ink" : "text-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            <Icon className={`size-[1.15rem] ${active ? "text-accent" : ""}`} strokeWidth={2.4} />
            {item.label}
            {item.badge && <Bubble count={badges[item.badge]} gold={item.badge === "packs"} />}
            {active && <span aria-hidden className="absolute inset-x-3 -bottom-[0.6rem] h-[3px] rounded-full bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTabBar({ wallet, trades }: { wallet: Wallet; trades: number }) {
  const isActive = useIsActive();
  const badges = useBadges(wallet, trades);
  return (
    <nav
      aria-label="Jeu"
      className="mobile-tabs fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-bg-deep/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-10px_rgb(6_3_30/0.8)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5 items-end">
        {MOBILE_LINKS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const count = item.badge ? badges[item.badge] : 0;
          if (item === BOOSTERS) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-label={badgeLabel(item, badges)}
                  aria-current={active ? "page" : undefined}
                  className="group -mt-7 flex flex-col items-center gap-1 pb-2 text-[0.7rem] font-extrabold"
                >
                  <span
                    className={`relative flex size-16 items-center justify-center rounded-full bg-gradient-to-b from-[#ffe066] to-[#ffbf1f] text-accent-ink shadow-[inset_0_2px_0_rgb(255_255_255/0.5),0_4px_0_var(--accent-edge),0_10px_20px_-6px_rgb(0_0_0/0.6)] ring-4 ring-bg-deep transition-transform group-active:translate-y-0.5 ${
                      count > 0 && !active ? "pulse-ring" : ""
                    }`}
                  >
                    <PackIcon className="size-7" />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1">
                        <Bubble count={count} />
                      </span>
                    )}
                  </span>
                  <span className={active ? "text-accent" : "text-ink"}>{item.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={badgeLabel(item, badges)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-2.5 text-[0.7rem] font-extrabold ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon className={`size-6 ${active ? "text-accent" : ""}`} strokeWidth={active ? 2.6 : 2.2} />
                  {count > 0 && (
                    <span className="absolute -top-2 -right-3">
                      <Bubble count={count} />
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
