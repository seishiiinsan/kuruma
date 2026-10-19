import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // New players take the short tour first (null until the migration runs: straight to the packs).
      const { data } = await supabase.rpc("my_account");
      const onboarded = (data as { onboarded?: boolean } | null)?.onboarded ?? true;
      return NextResponse.redirect(`${origin}${onboarded ? "/boosters" : "/bienvenue"}`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?erreur=callback`);
}
