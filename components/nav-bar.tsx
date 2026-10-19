import { Suspense } from "react";
import Link from "next/link";
import { getNotifications, getViewer } from "@/lib/game";
import { getWallet } from "@/lib/packs-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountMenu } from "./account-menu";
import { CoinChip } from "./game/coins";
import { GameNavLinks, MobileTabBar } from "./game-nav";
import { NotificationMenu } from "./notification-menu";

async function pendingOffers(viewerId: string) {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("to_id", viewerId)
    .eq("status", "pending");
  return count ?? 0;
}

/** The brand: a gold diamond and the lowercase name in the display face. */
export function Wordmark({ className = "text-[1.35rem]" }: { className?: string }) {
  return (
    <span className={`title-drop inline-flex items-center gap-2 font-display leading-none ${className}`}>
      <svg viewBox="0 0 20 20" className="size-[0.9em]" aria-hidden>
        <path d="M10 1 19 10 10 19 1 10Z" fill="#ffcc33" stroke="#d48a00" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 1 19 10H10Z" fill="#fff3b8" opacity="0.8" />
      </svg>
      kuruma
    </span>
  );
}

async function NavActions() {
  const viewer = await getViewer();

  if (viewer) {
    const [wallet, notifications, trades] = await Promise.all([
      getWallet(),
      getNotifications(),
      pendingOffers(viewer.id),
    ]);
    return (
      <div className="flex flex-1 items-center justify-between gap-3">
        <GameNavLinks wallet={wallet} trades={trades} />
        <div className="ml-auto flex items-center gap-2">
          <CoinChip wallet={wallet} />
          <NotificationMenu notifications={notifications} wallet={wallet} />
          <AccountMenu viewer={viewer} />
        </div>
        <MobileTabBar wallet={wallet} trades={trades} />
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <Link href="/classement" className="hidden h-11 items-center rounded-xl px-3 text-sm font-extrabold text-muted transition-colors hover:bg-white/5 hover:text-ink sm:inline-flex">
        Classement
      </Link>
      <Link href="/connexion" className="btn btn-gold btn-sm">
        Jouer gratuitement
      </Link>
    </div>
  );
}

export function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg-deep/90 shadow-[0_10px_30px_-12px_rgb(6_3_30/0.8)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" aria-label="Kuruma, accueil" className="shrink-0 rounded-lg">
          <Wordmark />
        </Link>
        <Suspense fallback={null}>
          <NavActions />
        </Suspense>
      </div>
    </header>
  );
}
