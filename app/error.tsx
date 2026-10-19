"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CardBack } from "@/components/reveal-card";
import { reportClientError } from "@/lib/report-error";

// Catches any failure under the root layout (a Supabase call, a render bug):
// the nav and footer stay, only the page area is replaced.
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "boundary");
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:py-24">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="rotate-6" aria-hidden>
          <CardBack className="w-32" />
        </div>
        <h1 className="title-drop mt-10 font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
          Panne sèche
        </h1>
        <p className="mt-3 text-pretty text-muted">
          Quelque chose a calé de notre côté. Tes cartes et tes jetons ne
          bougent pas : réessaie dans un instant.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn btn-gold btn-lg">
            Réessayer
          </button>
          <Link href="/" className="btn btn-lg">
            Retour au jeu
          </Link>
        </div>
        {digest && <p className="mt-6 text-xs text-muted/70">Code : {digest}</p>}
      </div>
    </section>
  );
}
