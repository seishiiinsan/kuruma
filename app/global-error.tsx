"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";
import "./kuruma.css";

// Last resort when the root layout itself fails: it renders its own document,
// so it brings the stylesheet and falls back to system fonts.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "global-boundary");
  }, [error]);

  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center px-5 py-16 text-center font-sans text-ink">
        <title>Kuruma — Panne sèche</title>
        <h1 className="title-drop text-[2rem] leading-[1.05] font-black sm:text-[2.75rem]">
          Panne sèche
        </h1>
        <p className="mt-3 max-w-md text-pretty text-muted">
          Kuruma n&apos;a pas pu démarrer. Tes cartes et tes jetons ne bougent
          pas : réessaie dans un instant.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn btn-gold btn-lg">
            Réessayer
          </button>
          {/* A plain link forces a full reload, which a broken layout needs. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn btn-lg">
            Retour au jeu
          </a>
        </div>
      </body>
    </html>
  );
}
