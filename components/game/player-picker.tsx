"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Trophy } from "lucide-react";
import type { PlayerRef, Standing } from "@/lib/game";
import { Avatar } from "../avatar";
import { FriendButton } from "./friend-button";
import { EmptyState, buttonGhost, formatScore } from "./ui";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function PlayerPicker({ players }: { players: Standing[] }) {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const visible = players.filter((p) => !q || normalize(`${p.name} ${p.handle}`).includes(q));

  if (players.length === 0) {
    return (
      <EmptyState
        title="Tu n'as pas encore d'amis sur Kuruma."
        action={
          <Link href="/classement" className={buttonGhost}>
            <Trophy className="size-4" aria-hidden />
            Trouver des joueurs au classement
          </Link>
        }
      >
        Ajoute des amis depuis leur profil : ils apparaîtront ici. Tu peux aussi proposer un échange à n&apos;importe
        quel joueur depuis son profil.
      </EmptyState>
    );
  }

  return (
    <div className="max-w-2xl">
      <label className="relative mb-4 block">
        <span className="sr-only">Rechercher un ami</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un ami"
          className="field pl-10"
        />
      </label>
      <ul className="divide-y divide-white/10 overflow-hidden panel">
        {visible.map((player) => (
          <li key={player.id}>
            <Link
              href={`/echanges/nouveau?avec=${player.handle}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/10"
            >
              <Avatar player={player} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{player.name}</span>
                <span className="block text-sm text-muted tabular-nums">
                  {formatScore(player.distinctCards)} voitures · {formatScore(player.copies)} exemplaires
                </span>
              </span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">Aucun ami ne correspond.</li>
        )}
      </ul>
    </div>
  );
}

/** Friend requests waiting for an answer, above the friends list. */
export function FriendRequests({ players }: { players: PlayerRef[] }) {
  if (players.length === 0) return null;
  return (
    <section className="mb-8 max-w-2xl">
      <h2 className="title-drop font-display text-lg">Demandes d&apos;ami</h2>
      <ul className="mt-3 divide-y divide-white/10 overflow-hidden panel">
        {players.map((player) => (
          <li key={player.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link href={`/joueur/${player.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar player={player} size={40} />
              <span className="truncate font-extrabold">{player.name}</span>
            </Link>
            <FriendButton playerId={player.id} playerName={player.name} status="received" />
          </li>
        ))}
      </ul>
    </section>
  );
}
