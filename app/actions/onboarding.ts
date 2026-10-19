"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Ends the first-launch tour, for good, and drops the player at the packs. */
export async function finishOnboarding() {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("finish_onboarding");
  redirect("/boosters");
}
