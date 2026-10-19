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
/** During the launch (public.launch_market_until), the market opens after this many boosters. */
export const LAUNCH_MARKET_PACKS = 10;

export type TradeBlock = "account banned" | "account too new" | "discord too new";
export type MarketBlock = TradeBlock | "launch packs";

/** The signed-in player's standing, from public.my_account. */
export type Account = {
  onboarded: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  tradeBlock: TradeBlock | null;
  /** When trading opens up; null for a banned player. */
  tradeFrom: string | null;
  /** The market has its own gate: during the launch, boosters open it early. */
  marketBlock: MarketBlock | null;
  /** End of the launch window; null once it is over. */
  launchUntil: string | null;
  packsOpened: number;
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
    marketBlock: (r.market_block as MarketBlock | null) ?? null,
    launchUntil: (r.launch_until as string | null) ?? null,
    packsOpened: Number(r.packs_opened ?? 0),
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
  // During the launch, the market may already be open while trades still wait.
  const what = account.marketBlock === null || account.marketBlock === "launch packs" ? "les échanges" : "les échanges et le marché";
  const market = account.marketBlock === "launch packs" ? ` ${launchText(account)}` : "";
  return account.tradeBlock === "account too new"
    ? `Pour toi, ${what} ouvrent après ${MIN_ACCOUNT_DAYS} jours de jeu : tu y auras accès${from}.${market}`
    : `Ton compte Discord a moins de ${MIN_DISCORD_DAYS} jours : ${what} s'ouvrent${from}.${market}`;
}

const launchText = (account: Account) => {
  const left = Math.max(LAUNCH_MARKET_PACKS - account.packsOpened, 1);
  return `Pour le lancement, le marché s'ouvre dès ${LAUNCH_MARKET_PACKS} boosters ouverts : encore ${left} booster${left > 1 ? "s" : ""}.`;
};

/** Why the player can't use the market yet, in a sentence; null when they can. */
export function marketBlockText(account: Account | null) {
  if (!account?.marketBlock) return null;
  if (account.marketBlock === "launch packs") return launchText(account);
  return tradeBlockText(account);
}

/** Server errors raised by the trust rules, for the actions' messages. */
export const TRUST_ERRORS: [string, string][] = [
  ["account banned", "Ton compte est suspendu."],
  ["account too new", `Échanges et marché ouvrent après ${MIN_ACCOUNT_DAYS} jours de jeu.`],
  ["discord too new", `Échanges et marché demandent un compte Discord de plus de ${MIN_DISCORD_DAYS} jours.`],
  ["launch packs", `Pour le lancement, le marché s'ouvre dès ${LAUNCH_MARKET_PACKS} boosters ouverts.`],
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
