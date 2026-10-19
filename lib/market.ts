/**
 * Player market: any copy can be listed, at the price its owner picks within
 * a band around the car's quote (cote). Rules live in
 * supabase/migrations/*_player_market.sql; these numbers must match it.
 *
 * Anti-inflation:
 * - every sale burns a 10 % fee (at least 1 jeton): jetons leave the economy;
 * - a listing can't go above 3x the quote, nor below half of it (and never
 *   below the shop's buy-back price): no car handed to a friend for nothing;
 * - player sales move the quote only little by little, one sale per
 *   seller-buyer pair, so two accounts trading together can't pump it.
 *
 * The quote (public.market_quote): a base value, blended with the median of
 * player sales over 30 days with weight n / (n + 3), n = seller-buyer pairs
 * (sales reverted by moderation don't count).
 * Base value = rarity's second-hand price
 *   × scarcity   (units built vs. the median of its rarity)^0.35, x0.5 to x4
 *   × exhaustion 1 + 0.6 × (share of the game's copies already out)^3
 *   × demand     1 + 0.15 × ln(1 + wishes), up to x1.6
 *   × offer      1 - 0.04 × listings on sale, down to x0.8
 */

export const MARKET_FEE_RATE = 0.1;
export const MARKET_CEILING = 3;
/** Lowest listing price, as a share of the quote (public.market_quote). */
export const MARKET_FLOOR = 0.5;
export const MARKET_DAYS = 7;
export const MAX_LISTINGS = 20;
export const QUOTE_DAYS = 30;
/** Pairs of sales after which the market weighs as much as the base value. */
export const QUOTE_BLEND_PAIRS = 3;

/** public.market_fee */
export const marketFee = (price: number) => Math.max(1, Math.ceil(price * MARKET_FEE_RATE));

export type Quote = {
  /** Suggested price: the base value blended with player sales. */
  reference: number;
  min: number;
  max: number;
  /** Seller-buyer pairs counted in the last 30 days. */
  sales: number;
  /** Value before any player sale, and what it's made of. */
  base: number;
  tierPrice: number;
  scarcity: number;
  exhaustion: number;
  demand: number;
  offer: number;
  /** Median of the counted sales, null without any. */
  marketMedian: number | null;
};

/** Weight of player sales in the quote. */
export const marketWeight = (pairs: number) => pairs / (pairs + QUOTE_BLEND_PAIRS);

export type HistoryPoint = { day: string; median: number; low: number; high: number; sales: number };
