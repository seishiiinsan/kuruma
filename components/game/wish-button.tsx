"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { setWish } from "@/app/actions/wishes";
import { buttonGhost } from "./ui";

/** Adds a car the player doesn't have to their wishlist, or takes it off. */
export function WishButton({ slug, wished }: { slug: string; wished: boolean }) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(wished);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      setShown(!shown);
      const result = await setWish(slug, !shown);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={shown} className={`${buttonGhost} shrink-0`}>
        <Heart className={`size-4 ${shown ? "fill-danger text-danger" : ""}`} aria-hidden />
        {shown ? "Dans ta liste d'envies" : "Ajouter à mes envies"}
      </button>
      {shown && !error && <p className="text-xs text-muted">On te prévient dès qu&apos;elle est à portée.</p>}
      {error && (
        <p role="alert" className="text-xs font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
