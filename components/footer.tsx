import Link from "next/link";
import { Wordmark } from "./nav-bar";

const LEGAL = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/conditions", label: "Conditions" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-bg-deep">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Wordmark className="text-lg text-ink" />
        <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-5 gap-y-1 font-bold">
          {LEGAL.map(({ href, label }) => (
            <Link key={href} href={href} className="underline-offset-4 hover:text-ink hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <span>Jeu en développement · © 2026 Kuruma</span>
      </div>
    </footer>
  );
}
