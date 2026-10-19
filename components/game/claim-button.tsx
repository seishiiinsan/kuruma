"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { claimSeries } from "@/app/actions/series";
import { buttonPrimary } from "./ui";

export function ClaimButton({ seriesId, packs }: { seriesId: string; packs: number }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (message?.ok) {
    return (
      <p role="status" className="text-sm font-semibold">
        {message.text}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await claimSeries(seriesId);
            setMessage(
              result.ok
                ? { ok: true, text: `+${result.packs} pack${result.packs > 1 ? "s" : ""} bonus ajouté${result.packs > 1 ? "s" : ""}.` }
                : { ok: false, text: result.error },
            );
          })
        }
        className={buttonPrimary}
      >
        <Gift className="size-4" aria-hidden />
        {pending ? "Réclamation…" : `Réclamer ${packs} pack${packs > 1 ? "s" : ""}`}
      </button>
      {message && (
        <p role="alert" className="text-sm font-bold text-danger">
          {message.text}
        </p>
      )}
    </div>
  );
}
