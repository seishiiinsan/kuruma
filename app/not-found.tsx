import Link from "next/link";
import { CardBack } from "@/components/reveal-card";

export default function NotFound() {
  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:py-24">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="-rotate-6" aria-hidden>
          <CardBack className="w-32" />
        </div>
        <h1 className="title-drop mt-10 font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
          Carte introuvable
        </h1>
        <p className="mt-3 text-pretty text-muted">
          Cette page n&apos;existe pas, ou plus. Retourne au jeu pour ouvrir tes packs.
        </p>
        <Link href="/" className="btn btn-gold btn-lg mt-8">
          Retour au jeu
        </Link>
      </div>
    </section>
  );
}
