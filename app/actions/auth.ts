"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signInWithDiscord() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
      scopes: "identify email",
    },
  });

  if (error || !data.url) {
    redirect("/connexion?erreur=discord");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type DeleteAccountState = { error: string | null };

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  if (formData.get("confirmation") !== "SUPPRIMER") {
    return { error: "Tape SUPPRIMER pour confirmer." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return { error: "La suppression a échoué. Réessaie plus tard." };
  }
  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
