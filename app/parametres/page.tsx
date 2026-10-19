import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getViewer } from "@/lib/game";
import { formatMonthYear } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { DiscordIcon } from "@/components/discord-button";
import { PageHeader, Panel, buttonGhost } from "@/components/game/ui";

export const metadata: Metadata = { title: "Paramètres — Kuruma" };

async function ConnectedAccount() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  return (
    <>
      <div className="flex items-center gap-4 p-5">
        <Avatar player={viewer} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-black">{viewer.name}</p>
          <p className="truncate text-sm text-muted">
            {viewer.email ?? "Aucun email transmis par Discord"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5865f2] px-3 py-1 text-xs font-extrabold text-white">
          <DiscordIcon className="size-3.5" />
          Discord
        </span>
      </div>
      <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Profil public :{" "}
          <Link href={`/joueur/${viewer.handle}`} className="font-semibold text-ink underline-offset-4 hover:underline">
            kuruma/joueur/{viewer.handle}
          </Link>
          <span className="block">Collectionneur depuis {formatMonthYear(viewer.memberSince)}.</span>
        </p>
        <form action={signOut}>
          <button type="submit" className={buttonGhost}>
            Se déconnecter
          </button>
        </form>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="title-drop font-display text-lg sm:text-xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <PageHeader title="Paramètres" />

      <Section
        title="Compte"
        description="Ton nom et ton avatar viennent de Discord et se mettent à jour à chaque connexion."
      >
        <Panel>
          <Suspense fallback={<div className="h-36" />}>
            <ConnectedAccount />
          </Suspense>
        </Panel>
      </Section>

      <Section
        title="Mes données"
        description="Télécharge tout ce que Kuruma garde sur toi : profil, cartes, jetons, échanges, ventes et notifications, dans un fichier JSON."
      >
        {/* A plain link: the route answers with a file, not a page. */}
        <a href="/parametres/export" download className={buttonGhost}>
          <Download className="size-4" aria-hidden />
          Exporter mes données
        </a>
      </Section>

      <Section
        title="Supprimer mon compte"
        description="Efface ton compte, ton profil, tes cartes et tes échanges. Tes exemplaires numérotés disparaissent du jeu."
      >
        <DeleteAccountForm />
      </Section>
    </div>
  );
}
