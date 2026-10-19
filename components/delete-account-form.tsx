"use client";

import { useActionState, useId, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/app/actions/auth";

const INITIAL: DeleteAccountState = { error: null };

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, INITIAL);
  const inputId = useId();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn" style={{ "--label": "var(--danger)" } as React.CSSProperties}
      >
        Supprimer mon compte
      </button>
    );
  }

  return (
    <form action={formAction} className="max-w-md">
      <label htmlFor={inputId} className="text-sm">
        Tape <strong className="font-black text-danger">SUPPRIMER</strong> pour
        confirmer. Ton compte, tes cartes et tes échanges seront effacés,
        sans retour possible.
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id={inputId}
          name="confirmation"
          autoComplete="off"
          className="field min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-danger"
        >
          {pending ? "Suppression…" : "Supprimer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn"
        >
          Annuler
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
