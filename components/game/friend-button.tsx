"use client";

import { useState, useTransition } from "react";
import { Check, Clock, UserCheck, UserPlus, X } from "lucide-react";
import { addFriend, removeFriend } from "@/app/actions/friends";
import type { Friendship } from "@/lib/friends";
import { buttonClaim, buttonGhost, buttonInk } from "./ui";

/** Friend request on a profile: ask, answer a request, or leave a friendship. */
export function FriendButton({
  playerId,
  playerName,
  status: initial,
}: {
  playerId: string;
  playerName: string;
  status: Friendship;
}) {
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(next: Friendship, action: () => Promise<{ ok: boolean; error?: string }>) {
    const previous = status;
    setStatus(next);
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) {
        setStatus(previous);
        setError(result.error ?? null);
      }
    });
  }

  const add = () => run(status === "received" ? "friends" : "sent", () => addFriend(playerId));
  const remove = () => run("none", () => removeFriend(playerId));

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {status === "none" && (
        <button type="button" disabled={pending} onClick={add} className={buttonInk}>
          <UserPlus className="size-4" aria-hidden />
          Ajouter en ami
        </button>
      )}
      {status === "sent" && (
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className={buttonGhost}
          aria-label={`Annuler la demande d'ami envoyée à ${playerName}`}
        >
          <Clock className="size-4" aria-hidden />
          Demande envoyée
        </button>
      )}
      {status === "received" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={add} className={buttonClaim}>
            <Check className="size-4" aria-hidden />
            Accepter
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className={buttonGhost}
            aria-label={`Refuser la demande d'ami de ${playerName}`}
          >
            <X className="size-4" aria-hidden />
            Refuser
          </button>
        </div>
      )}
      {status === "friends" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Retirer ${playerName} de tes amis ?`)) remove();
          }}
          className={buttonGhost}
          aria-label={`${playerName} est ton ami. Retirer de tes amis`}
        >
          <UserCheck className="size-4 text-green" aria-hidden />
          Ami
        </button>
      )}
      {status === "received" && <p className="text-xs text-muted">{playerName} veut devenir ton ami.</p>}
      {status === "sent" && <p className="text-xs text-muted">Clique pour annuler.</p>}
      {error && <p className="text-xs font-bold text-danger">{error}</p>}
    </div>
  );
}
