import Link from "next/link";
import type { PlayerRef } from "@/lib/game";
import { FramedAvatar } from "../cosmetics";
import { ShowMore } from "./show-more";

/** Friends shown before the "show more" button. */
const FIRST_FRIENDS = 12;

/** A player's friends as chips, the ones the viewer shares first and ringed. */
export function FriendList({ friends, mutual }: { friends: PlayerRef[]; mutual: Set<string> }) {
  const sorted = friends.toSorted((a, b) => Number(mutual.has(b.id)) - Number(mutual.has(a.id)));
  const list = (players: PlayerRef[]) => (
    <ul className="flex flex-wrap gap-2">
      {players.map((friend) => {
        const shared = mutual.has(friend.id);
        return (
          <li key={friend.id}>
            <Link
              href={`/joueur/${friend.handle}`}
              className={`inline-flex max-w-[16rem] items-center gap-2 rounded-full bg-surface-lo py-1 pr-3.5 pl-1 text-sm font-extrabold transition-colors hover:bg-surface-hi ${
                shared ? "ring-2 ring-accent ring-inset" : ""
              }`}
            >
              <FramedAvatar player={friend} size={32} />
              <span className="truncate">{friend.name}</span>
              {shared && <span className="sr-only">(ami en commun)</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {list(sorted.slice(0, FIRST_FRIENDS))}
      {sorted.length > FIRST_FRIENDS && (
        <ShowMore label={`Voir ${sorted.length - FIRST_FRIENDS} amis de plus`}>
          <div className="mt-2">{list(sorted.slice(FIRST_FRIENDS))}</div>
        </ShowMore>
      )}
    </>
  );
}
