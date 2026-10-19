"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function markNotificationsRead() {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("mark_notifications_read");
}

export async function markNotificationRead(id: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("mark_notification_read", { p_id: id });
}
