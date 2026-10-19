import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * A session-less client for public data (profiles, copies, garages), for
 * routes that must not read cookies: the sitemap and share images, which are
 * cached and served the same to everyone.
 */
export const supabasePublic = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
