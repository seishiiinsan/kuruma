import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/game";

async function ToProfile(): Promise<null> {
  const viewer = await getViewer();
  redirect(viewer ? `/joueur/${viewer.handle}` : "/connexion");
}

/** Stable link to the signed-in player's own profile. */
export default function MePage() {
  return (
    <Suspense fallback={null}>
      <ToProfile />
    </Suspense>
  );
}
