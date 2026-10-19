/**
 * Trust rules against multiple accounts: cards and jetons only reach another
 * player once an account has proven itself a little. Rules live in
 * supabase/migrations/*_trust_and_moderation.sql; these numbers must match it.
 */

/** Days a Kuruma account waits before trading or using the market. */
export const MIN_ACCOUNT_DAYS = 3;
/** Minimum age of the Discord account behind it. */
export const MIN_DISCORD_DAYS = 30;
/** Trades proposed, trades concluded and market purchases, per 24 h. */
export const TRADES_PER_DAY = 10;
export const MARKET_BUYS_PER_DAY = 10;
/** Trades, and market sales, between the same two players over 7 days. */
export const PAIR_PER_WEEK = 3;
/** Under this age, the two sides of a trade stay within MAX_TRADE_RATIO at the quote. */
export const YOUNG_ACCOUNT_DAYS = 30;
export const MAX_TRADE_RATIO = 3;

export type TradeBlock = "account banned" | "account too new" | "discord too new";

/** The signed-in player's standing, from public.my_account. */
export type Account = {
  onboarded: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  tradeBlock: TradeBlock | null;
  /** When trading opens up; null for a banned player. */
  tradeFrom: string | null;
  young: boolean;
  proposedToday: number;
  tradedToday: number;
  boughtToday: number;
  admin: boolean;
};

export function toAccount(raw: unknown): Account | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    onboarded: Boolean(r.onboarded),
    bannedUntil: (r.banned_until as string | null) ?? null,
    banReason: (r.ban_reason as string | null) ?? null,
    tradeBlock: (r.trade_block as TradeBlock | null) ?? null,
    tradeFrom: (r.trade_from as string | null) ?? null,
    young: Boolean(r.young),
    proposedToday: Number(r.proposed_today ?? 0),
    tradedToday: Number(r.traded_today ?? 0),
    boughtToday: Number(r.bought_today ?? 0),
    admin: Boolean(r.admin),
  };
}

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Why the player can't trade yet, in a sentence; null when they can. */
export function tradeBlockText(account: Account | null) {
  if (!account?.tradeBlock) return null;
  if (account.tradeBlock === "account banned") return "Ton compte est suspendu : échanges et marché sont fermés.";
  const from = account.tradeFrom ? ` à partir du ${day.format(new Date(account.tradeFrom))}` : "";
  return account.tradeBlock === "account too new"
    ? `Les échanges et le marché ouvrent après ${MIN_ACCOUNT_DAYS} jours de jeu : tu y auras accès${from}.`
    : `Ton compte Discord a moins de ${MIN_DISCORD_DAYS} jours : échanges et marché s'ouvrent${from}.`;
}

/** Server errors raised by the trust rules, for the actions' messages. */
export const TRUST_ERRORS: [string, string][] = [
  ["account banned", "Ton compte est suspendu."],
  ["account too new", `Échanges et marché ouvrent après ${MIN_ACCOUNT_DAYS} jours de jeu.`],
  ["discord too new", `Échanges et marché demandent un compte Discord de plus de ${MIN_DISCORD_DAYS} jours.`],
  ["partner cannot trade", "Ce joueur ne peut pas encore échanger (compte trop récent ou suspendu)."],
  ["daily trade limit", `Limite atteinte : ${TRADES_PER_DAY} échanges par 24 h. Reviens demain.`],
  ["daily market limit", `Limite atteinte : ${MARKET_BUYS_PER_DAY} achats au marché par 24 h. Reviens demain.`],
  ["pair limit", `Vous avez déjà conclu ${PAIR_PER_WEEK} affaires ensemble cette semaine. Reviens dans quelques jours.`],
  [
    "unbalanced trade",
    `Échange trop déséquilibré : pendant les ${YOUNG_ACCOUNT_DAYS} premiers jours d'un compte, les deux côtés doivent rester à moins de ${MAX_TRADE_RATIO}× l'un de l'autre à la cote.`,
  ],
];

export const explainTrust = (message: string) =>
  TRUST_ERRORS.find(([needle]) => message.includes(needle))?.[1] ?? null;
