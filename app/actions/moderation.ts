"use server";

import { refresh } from "next/cache";
import type { ReportReason } from "@/lib/moderation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ModerationResult = { ok: true; message: string } | { ok: false; error: string };

const ERRORS: [string, string][] = [
  ["not allowed", "Réservé à la modération."],
  ["not authenticated", "Connecte-toi d'abord."],
  ["cannot report yourself", "Tu ne peux pas te signaler toi-même."],
  ["already reported", "Tu as déjà signalé ce joueur : la modération regarde."],
  ["too many reports", "5 signalements par jour au plus. Réessaie demain."],
  ["unknown", "Joueur ou motif inconnu."],
  ["cannot ban yourself", "Tu ne peux pas te bannir toi-même."],
  ["trade not accepted", "Cet échange n'est pas conclu (ou déjà annulé)."],
  ["sale not found", "Vente introuvable ou déjà annulée."],
  ["cards moved on", "Une des cartes a changé de main depuis : annulation impossible."],
  ["not enough coins", "Solde insuffisant pour ce retrait."],
  ["amount out of range", "Montant invalide (entre -100 000 et 100 000, hors 0)."],
  ["report not open", "Ce signalement est déjà traité."],
];

const explain = (message: string) =>
  ERRORS.find(([needle]) => message.includes(needle))?.[1] ?? "L'opération a échoué. Réessaie.";

async function run(call: PromiseLike<{ error: { message: string } | null }>, message: string): Promise<ModerationResult> {
  const { error } = await call;
  if (error) return { ok: false, error: explain(error.message) };
  refresh();
  return { ok: true, message };
}

export async function reportPlayer(targetId: string, reason: ReportReason, details: string) {
  const supabase = await createSupabaseServerClient();
  return run(
    supabase.rpc("report_player", { p_target: targetId, p_reason: reason, p_details: details.slice(0, 500) || null }),
    "Merci : la modération va regarder.",
  );
}

/* ---------- Admin (each function checks public.admins itself) ---------- */

export async function banPlayer(userId: string, days: number | null, reason: string) {
  const supabase = await createSupabaseServerClient();
  return run(
    supabase.rpc("admin_ban", { p_user: userId, p_days: days, p_reason: reason || null }),
    days ? `Banni ${days} jour${days > 1 ? "s" : ""}.` : "Banni définitivement.",
  );
}

export async function unbanPlayer(userId: string) {
  const supabase = await createSupabaseServerClient();
  return run(supabase.rpc("admin_unban", { p_user: userId }), "Ban levé.");
}

export async function adjustCoins(userId: string, amount: number, note: string) {
  const supabase = await createSupabaseServerClient();
  return run(
    supabase.rpc("admin_adjust_coins", { p_user: userId, p_amount: Math.trunc(amount), p_note: note || null }),
    "Solde corrigé.",
  );
}

export async function revertTrade(tradeId: string, note: string) {
  const supabase = await createSupabaseServerClient();
  return run(supabase.rpc("admin_revert_trade", { p_trade: tradeId, p_note: note || null }), "Échange annulé.");
}

export async function revertSale(saleId: number, note: string) {
  const supabase = await createSupabaseServerClient();
  return run(supabase.rpc("admin_revert_sale", { p_sale: saleId, p_note: note || null }), "Vente annulée.");
}

export async function resolveReport(reportId: string, status: "resolved" | "dismissed", note: string) {
  const supabase = await createSupabaseServerClient();
  return run(
    supabase.rpc("admin_resolve_report", { p_id: reportId, p_status: status, p_note: note || null }),
    status === "resolved" ? "Signalement traité." : "Signalement classé.",
  );
}
