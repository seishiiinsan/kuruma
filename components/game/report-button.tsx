"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Flag, X } from "lucide-react";
import { reportPlayer, type ModerationResult } from "@/app/actions/moderation";
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation";

/** "Signaler" on a public profile: a reason, a few words, sent to the moderators. */
export function ReportButton({ playerId, playerName }: { playerId: string; playerName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason>("multi_comptes");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<ModerationResult | null>(null);
  const [pending, start] = useTransition();
  const titleId = useId();
  const detailsId = useId();

  function send(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await reportPlayer(playerId, reason, details.trim());
      setResult(outcome);
      if (outcome.ok) setDetails("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          dialog.current?.showModal();
        }}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        <Flag className="size-3.5" aria-hidden />
        Signaler
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-bg p-0 text-ink shadow-[var(--shadow-lift)] ring-1 ring-white/10 backdrop:bg-bg-deep/70 backdrop:backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <form onSubmit={send} className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="title-drop font-display text-xl">
              Signaler {playerName}
            </h2>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => dialog.current?.close()}
              className="btn size-10 shrink-0 p-0"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {result?.ok ? (
            <p role="status" className="text-pretty text-muted">
              {result.message}
            </p>
          ) : (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-2 text-sm font-bold">Motif</legend>
                {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([id, label]) => (
                  <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5">
                    <input
                      type="radio"
                      name="reason"
                      value={id}
                      checked={reason === id}
                      onChange={() => setReason(id)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor={detailsId} className="text-sm font-bold">
                  Détails <span className="font-normal text-muted">(facultatif)</span>
                </label>
                <textarea
                  id={detailsId}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Ce que tu as vu : échanges, comptes liés…"
                  className="field mt-1.5 resize-none"
                />
              </div>
              {result && !result.ok && (
                <p role="alert" className="text-sm font-bold text-danger">
                  {result.error}
                </p>
              )}
              <button type="submit" disabled={pending} className="btn btn-danger">
                {pending ? "Envoi…" : "Envoyer le signalement"}
              </button>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
