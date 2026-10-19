"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/collection", label: "Mes cartes" },
  { href: "/album", label: "Album et séries" },
  { href: "/collection/envies", label: "Envies" },
];

/** Switches between the cards you hold and the album of series to complete. */
export function CollectionTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Collection" className="mb-8 inline-flex rounded-2xl bg-bg-deep p-1 shadow-[inset_0_2px_4px_rgb(0_0_0/0.4)]">
      {TABS.map((tab) => {
        const active = tab.href === "/album" ? pathname.startsWith("/album") : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
              active ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
