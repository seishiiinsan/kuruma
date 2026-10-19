"use client";

import { useState, useTransition } from "react";
import { Warehouse } from "lucide-react";
import { saveGarage } from "@/app/actions/garage";
import { buttonGhost } from "./ui";

const SLOTS = 6;

/** Puts this card in the garage, or takes it out. */
export function ShowcaseButton({
  copyId,
  garage,
  shownCopyId,
}: {
  copyId: string;
  garage: string[];
  shownCopyId: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const full = garage.length >= SLOTS;

  function toggle() {
    setError(null);
    const next = shownCopyId ? garage.filter((id) => id !== shownCopyId) : [...garage, copyId];
    start(async () => {
      const result = await saveGarage(next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={pending || (!shownCopyId && full)}
        className={`${buttonGhost} shrink-0`}
      >
        <Warehouse className="size-4" aria-hidden />
        {shownCopyId ? "Retirer du garage" : "Exposer au garage"}
      </button>
      {!shownCopyId && full && (
        <p className="text-xs text-muted">Garage plein (6 cartes). Retires-en une depuis ton profil.</p>
      )}
      {error && (
        <p role="alert" className="text-xs font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
