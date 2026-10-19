# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are car enthusiasts and collectors — people who enjoy collecting and trading, not necessarily racing-game players. They may be devoted to one car culture (JDM, muscle, euro exotics, kei cars, youngtimers...) or simply love cars broadly. They sign in with Discord and play right away: free packs, a numbered collection, trades and a public garage.

## Product Purpose

Kuruma is a web trading card game (TCG) built around car collecting — collect, trade, and curate a "garage" of car cards, in the spirit of Pokémon-style collectible card games, but for cars. It exists to give car culture a collecting/trading game of its own instead of borrowing a racing-game frame.

The game is playable: Discord sign-in, free timed packs, a catalogue of real cars, numbered copies, trades between players, a public garage, a leaderboard, achievements and a shop paid in jetons. The landing page's job is to get visitors to sign in and open their first packs.

## Positioning

Not a racing game, not locked to one car scene. The mechanism a competitor couldn't casually copy: a TCG whose collection spans every car culture at once (JDM, muscle, euro exotics, kei cars, youngtimers, and beyond) rather than specializing in one.

## Operating Context

- Backend: Supabase project `kuruma` (id `guxlhalhyxhbxihofdeh`), schema in `supabase/migrations/`, applied with the Supabase CLI (`supabase db push`).
- Catalogue: real cars from Wikidata/Wikipedia/Wikimedia Commons, built by `scripts/cars/` into `data/cards.json` (app) and a generated cards migration (database).
- Rarity follows real-world scarcity: a car can't have more copies in the game than units built (`cards.supply`); every copy is numbered.
- Score: each distinct car counts once, weighted by rarity; duplicates are for trading. Claimed series add their points.
- Series (album): generated per brand (split by era past 24 cars) and theme; cars built under 5 000 units never belong to a series so every series stays completable. Completing one gives bonus packs (outside the 10-pack cap) once.
- The old waitlist (`waitlist_signups`) is kept in the database; its UI is gone.
- Site copy is in French.

## Capabilities and Constraints

- Stack: Next.js 16 (App Router, Turbopack default, async request APIs), React 19, Tailwind CSS v4, TypeScript, `motion` for animation, `@supabase/supabase-js`.
- Auth: Discord only. Profiles (name, avatar, garage, collection) are public.
- Business model (user, 2026-10-19): 100% free-to-play, no real money of any kind (no paid packs for money, no ads). Packs come from free timed refills, gameplay, and jetons.
- Economy (user, 2026-10-19): "jetons" are a soft currency earned only in game (tiered achievements, a daily bonus with a 7-day streak, selling duplicates back to the shop) and spent only in game (extra free-type packs, jeton-only premium packs, a daily/weekly shop window of new cards, second-hand copies resold by players). Prices and rewards live in `lib/economy.ts` and `lib/packs.ts`, mirrored in the `*_economy.sql` migration. Balance rule: reselling a pack's cards returns ~24 % of its price, so buying packs to resell always loses.
- Card imagery is real photos from Wikimedia Commons, credited (author + licence) on each card page.

## Brand Commitments

- Name: "Kuruma" (Japanese for "car"). No other binding naming/voice constraints established yet.
- Standing visual preference (user, 2026-10-19, confirmed in the redesign the same day): the mobile TCG game standard, played straight — it must read as a game, never as a SaaS/B2B dashboard. Craft bar: Pokémon TCG Pocket and Marvel Snap (game HUD, chunky 3D buttons, pack opening, holo shine). All boosters share one art direction (one template, one colour per car culture).

## Evidence on Hand

- No testimonials, press, case studies, or real user data exist; none should be fabricated.

## Product Principles

- The game is a collecting/trading experience first — never frame it as a racing or driving game.
- No single car culture is privileged over another; the pitch is breadth across scenes.
- Real data only: no invented players, numbers or cards anywhere in the product.
