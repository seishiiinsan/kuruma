"use client";

import { useState, useTransition } from "react";
import {
  adjustCoins,
  banPlayer,
  resolveReport,
  revertSale,
  revertTrade,
  unbanPlayer,
  type ModerationResult,
} from "@/app/actions/moderation";

function useAction() {
  const [result, setResult] = useState<ModerationResult | null>(null);
  const [pending, start] = useTransition();
  const run = (call: () => Promise<ModerationResult>) => start(async () => setResult(await call()));
  const feedback = result && (
    <p role={result.ok ? "status" : "alert"} className={`text-xs font-bold ${result.ok ? "text-green" : "text-danger"}`}>
      {result.ok ? result.message : result.error}
    </p>
  );
  return { run, pending, feedback };
}

export function BanForm({ userId, banned }: { userId: string; banned: boolean }) {
  const { run, pending, feedback } = useAction();
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");

  if (banned) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => unbanPlayer(userId))} className="btn btn-sm">
          Lever le ban
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const label = days === "" ? "définitivement" : `${days} jours`;
        if (!confirm(`Bannir ce joueur ${label} ? Il sera déconnecté, ses offres et annonces retirées.`)) return;
        run(() => banPlayer(userId, days === "" ? null : Number(days), reason));
      }}
    >
      <div className="flex flex-wrap gap-2">
        <select value={days} onChange={(e) => setDays(e.target.value)} className="field w-auto" aria-label="Durée">
          <option value="1">1 jour</option>
          <option value="7">7 jours</option>
          <option value="30">30 jours</option>
          <option value="">Définitif</option>
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif (visible dans le journal)"
          className="field min-w-0 flex-1"
          aria-label="Motif"
        />
        <button type="submit" disabled={pending} className="btn btn-danger btn-sm">
          Bannir
        </button>
      </div>
      {feedback}
    </form>
  );
}

export function CoinsForm({ userId }: { userId: string }) {
  const { run, pending, feedback } = useAction();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const n = Number(amount);
        if (!Number.isInteger(n) || n === 0) return;
        run(() => adjustCoins(userId, n, note));
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="+500 ou -200"
          className="field w-32"
          aria-label="Jetons"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Raison"
          className="field min-w-0 flex-1"
          aria-label="Raison"
        />
        <button type="submit" disabled={pending} className="btn btn-sm">
          Corriger le solde
        </button>
      </div>
      {feedback}
    </form>
  );
}

export function RevertButton({ kind, id }: { kind: "trade" | "sale"; id: string | number }) {
  const { run, pending, feedback } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const note = prompt(kind === "trade" ? "Annuler cet échange. Raison ?" : "Annuler cette vente. Raison ?");
          if (note === null) return;
          run(() => (kind === "trade" ? revertTrade(String(id), note) : revertSale(Number(id), note)));
        }}
        className="btn btn-sm"
      >
        Annuler
      </button>
      {feedback}
    </div>
  );
}

export function ResolveReport({ id }: { id: string }) {
  const { run, pending, feedback } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Suite donnée"
          className="field min-w-0 flex-1"
          aria-label="Suite donnée"
        />
        <button type="button" disabled={pending} onClick={() => run(() => resolveReport(id, "resolved", note))} className="btn btn-green btn-sm">
          Traité
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => resolveReport(id, "dismissed", note))} className="btn btn-sm">
          Classer
        </button>
      </div>
      {feedback}
    </div>
  );
}
