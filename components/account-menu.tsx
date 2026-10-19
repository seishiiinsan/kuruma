"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Palette, Settings, ShieldCheck, Trophy, Users, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import type { PlayerRef } from "@/lib/game";
import { FramedAvatar, PlayerTitle } from "./cosmetics";

type MenuLink = { href: string; label: string; icon: LucideIcon; count?: number };

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-extrabold transition-colors hover:bg-white/10 focus-visible:bg-white/10";

/**
 * The avatar menu: the player's own profile on top, then who they play with,
 * then the account itself. Ranking sits here because the phone tab bar has no room for it.
 */
export function AccountMenu({
  viewer,
  friendRequests = 0,
  admin = false,
}: {
  viewer: PlayerRef;
  friendRequests?: number;
  admin?: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const close = () => menu.current?.hidePopover();
  const profileHref = `/joueur/${viewer.handle}`;

  const groups: { label: string; links: MenuLink[] }[] = [
    {
      label: "Communauté",
      links: [
        { href: "/echanges/nouveau", label: "Mes amis", icon: Users, count: friendRequests },
        { href: "/classement", label: "Classement", icon: Trophy },
      ],
    },
    {
      label: "Compte",
      links: [
        { href: "/parametres", label: "Paramètres", icon: Settings },
        ...(admin ? [{ href: "/admin", label: "Modération", icon: ShieldCheck }] : []),
      ],
    },
  ];

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <>
      <button
        type="button"
        popoverTarget="account-menu"
        aria-haspopup="menu"
        aria-label={friendRequests > 0 ? `Compte de ${viewer.name}, ${friendRequests} demandes d'ami` : `Compte de ${viewer.name}`}
        className="hud-pill relative gap-2 py-1 pl-1 text-sm transition-[filter] hover:brightness-125 sm:pr-3"
      >
        <FramedAvatar player={viewer} size={32} className="ring-2 ring-accent" />
        <span className="hidden max-w-32 truncate xl:block">{viewer.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="hidden text-muted sm:block">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {friendRequests > 0 && (
          <span aria-hidden className="absolute -top-0.5 left-6 size-3 rounded-full bg-danger ring-2 ring-bg-deep" />
        )}
      </button>

      <div
        ref={menu}
        id="account-menu"
        popover="auto"
        role="menu"
        aria-label="Mon compte"
        className="panel fixed inset-auto top-[4.5rem] m-0 w-72 p-1.5 text-sm text-ink shadow-[var(--shadow-lift)]"
        style={{ right: "max(1.25rem, calc((100vw - 72rem) / 2 + 1.5rem))" }}
      >
        {/* Me: the profile card leads to the profile, customising sits right under it. */}
        <Link
          href={profileHref}
          role="menuitem"
          onClick={close}
          aria-current={current(profileHref)}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10 focus-visible:bg-white/10"
        >
          <FramedAvatar player={viewer} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black">{viewer.name}</span>
            {viewer.look?.titleId ? (
              <PlayerTitle look={viewer.look} className="block truncate text-xs" />
            ) : (
              <span className="block truncate text-xs text-muted">@{viewer.handle}</span>
            )}
            <span className="mt-0.5 block text-xs font-extrabold text-accent">Voir mon profil et mon garage</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <Link
          href="/personnaliser"
          role="menuitem"
          onClick={close}
          aria-current={current("/personnaliser")}
          className={`${itemClass} aria-[current=page]:text-accent`}
        >
          <Palette className="size-[1.1rem] text-muted" strokeWidth={2.4} aria-hidden />
          Personnaliser mon profil
        </Link>

        {groups.map((group) => (
          <div key={group.label} role="group" aria-labelledby={`account-menu-${group.label}`}>
            <div className="mx-3 my-1.5 h-px bg-white/10" />
            <p id={`account-menu-${group.label}`} className="px-3 pt-1 pb-1 text-[0.7rem] font-extrabold tracking-wider text-muted uppercase">
              {group.label}
            </p>
            {group.links.map(({ href, label, icon: Icon, count = 0 }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={close}
                aria-current={current(href)}
                aria-label={count > 0 ? `${label}, ${count} demandes en attente` : undefined}
                className={`${itemClass} aria-[current=page]:text-accent`}
              >
                <Icon className="size-[1.1rem] text-muted" strokeWidth={2.4} aria-hidden />
                <span className="flex-1">{label}</span>
                {count > 0 && (
                  <span aria-hidden className="bubble">
                    {count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}

        <div className="mx-3 my-1.5 h-px bg-white/10" />
        <form action={signOut}>
          <button type="submit" role="menuitem" className={`${itemClass} text-left text-danger`}>
            <LogOut className="size-[1.1rem]" strokeWidth={2.4} aria-hidden />
            Se déconnecter
          </button>
        </form>
      </div>
    </>
  );
}
