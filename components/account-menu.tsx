"use client";

import { useRef } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { PlayerRef } from "@/lib/game";
import { FramedAvatar, PlayerTitle } from "./cosmetics";

export function AccountMenu({ viewer }: { viewer: PlayerRef }) {
  const menu = useRef<HTMLDivElement>(null);
  const close = () => menu.current?.hidePopover();
  const links = [
    { href: `/joueur/${viewer.handle}`, label: "Mon profil et mon garage" },
    { href: "/personnaliser", label: "Personnaliser mon profil" },
    { href: "/classement", label: "Classement" },
    { href: "/parametres", label: "Paramètres" },
  ];

  return (
    <>
      <button
        type="button"
        popoverTarget="account-menu"
        aria-haspopup="menu"
        aria-label={`Compte de ${viewer.name}`}
        className="hud-pill gap-2 py-1 pl-1 text-sm transition-[filter] hover:brightness-125 sm:pr-3"
      >
        <FramedAvatar player={viewer} size={32} className="ring-2 ring-accent" />
        <span className="hidden max-w-32 truncate xl:block">{viewer.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="hidden text-muted sm:block">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        ref={menu}
        id="account-menu"
        popover="auto"
        role="menu"
        className="panel fixed inset-auto top-[4.5rem] m-0 w-64 p-1.5 text-sm text-ink shadow-[var(--shadow-lift)]"
        style={{ right: "max(1.25rem, calc((100vw - 72rem) / 2 + 1.5rem))" }}
      >
        <div className="flex items-center gap-3 px-3 pt-2 pb-3">
          <FramedAvatar player={viewer} size={40} />
          <p className="min-w-0">
            <span className="block truncate font-black">{viewer.name}</span>
            {viewer.look?.titleId ? (
              <PlayerTitle look={viewer.look} className="block truncate text-xs" />
            ) : (
              <span className="block truncate text-xs text-muted">@{viewer.handle}</span>
            )}
          </p>
        </div>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            role="menuitem"
            onClick={close}
            className="flex w-full items-center rounded-xl px-3 py-2.5 font-extrabold transition-colors hover:bg-white/10"
          >
            {label}
          </Link>
        ))}
        <div className="mx-3 my-1 h-px bg-white/10" />
        <form action={signOut}>
          <button
            type="submit"
            role="menuitem"
            className="flex w-full items-center rounded-xl px-3 py-2.5 text-left font-extrabold text-danger transition-colors hover:bg-white/10"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </>
  );
}
