"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import type { Standing } from "@/lib/game";
import { Avatar } from "../avatar";
import { EmptyState, formatScore } from "./ui";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function PlayerPicker({ players }: { players: Standing[] }) {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const visible = players.filter((p) => !q || normalize(`${p.name} ${p.handle}`).includes(q));

  if (players.length === 0) {
    return (
      <EmptyState title="Aucun autre collectionneur n'a encore de carte.">
        Invite tes amis : dès qu&apos;ils auront ouvert un pack, vous pourrez échanger.
      </EmptyState>
    );
  }

  return (
    <div className="max-w-2xl">
      <label className="relative mb-4 block">
        <span className="sr-only">Rechercher un joueur</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un joueur"
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
          <li className="px-4 py-8 text-center text-sm text-muted">Aucun joueur ne correspond.</li>
        )}
      </ul>
    </div>
  );
}
