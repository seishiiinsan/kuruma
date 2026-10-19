---
name: Kuruma
description: A car-culture trading card game on a deep indigo table; every car culture, one collection.
colors:
  bg: "#1d1656"
  bg-deep: "#120c3c"
  surface: "#2b2380"
  surface-hi: "#372e9a"
  surface-lo: "#211a68"
  ink: "#ffffff"
  muted: "#bdb6ee"
  line: "#4a40aa"
  accent: "#ffcc33"
  accent-hover: "#ffd95e"
  accent-edge: "#d48a00"
  accent-ink: "#3b1f00"
  blue: "#3d8bff"
  blue-edge: "#1d5bd0"
  green: "#2fd27a"
  green-edge: "#149a52"
  green-ink: "#03341a"
  danger: "#ff4d6d"
  danger-edge: "#c21f45"
  tier-common: "#a9b1cf"
  tier-rare: "#4fb0ff"
  tier-epic: "#c77dff"
  tier-legendary: "#ffbf2e"
  card-face: "#ffffff"
  card-ink: "#1a1442"
  card-muted: "#5e5a86"
  card-line: "#e3e0f3"
typography:
  display:
    fontFamily: "Russo One, sans-serif"
    fontSize: "clamp(2rem, 6.2vw, 4.75rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "0"
  headline:
    fontFamily: "Russo One, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0"
  title:
    fontFamily: "Russo One, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Nunito, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Nunito, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 800
    lineHeight: 1.25
  label:
    fontFamily: "Nunito, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  card-window: "7px"
  card-inner: "10px"
  card: "14px"
  btn-sm: "12px"
  btn: "14px"
  field: "14px"
  sunken: "16px"
  btn-lg: "18px"
  panel: "20px"
  pill: "9999px"
spacing:
  btn-x: "20px"
  btn-y: "10px"
  field-x: "16px"
  panel-pad: "20px"
  page-x-mobile: "20px"
  page-x: "24px"
  header-height: "64px"
  tabbar-height: "68px"
components:
  button-primary:
    backgroundColor: "#ffbf1f"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.btn}"
    padding: "10px 20px"
    height: "44px"
  button-primary-large:
    backgroundColor: "#ffbf1f"
    textColor: "{colors.accent-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.btn-lg}"
    padding: "14px 28px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "10px 20px"
    height: "44px"
  button-claim:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.btn}"
    padding: "10px 20px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "10px 20px"
    height: "44px"
  button-neutral:
    backgroundColor: "{colors.surface-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn}"
    padding: "10px 20px"
    height: "44px"
  button-small:
    rounded: "{rounded.btn-sm}"
    padding: "6px 14px"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  panel-sunken:
    backgroundColor: "{colors.surface-lo}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sunken}"
  hud-pill:
    backgroundColor: "{colors.bg-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px 0 6px"
    height: "38px"
  field:
    backgroundColor: "{colors.bg-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 16px"
    height: "44px"
  count-bubble:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "20px"
  trading-card:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.card}"
---

# Design System: Kuruma

## Overview

**Creative North Star: "The Game Table"**

Kuruma is a mobile-standard collectible card game played straight, at the craft bar of Pokémon TCG Pocket and Marvel Snap. The player always knows it is a game, never a dashboard. Everything sits on a deep saturated indigo table: soft violet light pools and a faint diamond lattice fixed to the viewport like a play mat, raised indigo panels with a lit top edge, sunken slots and HUD pills pressed into the table. Gold is the action and the money: the primary button, the jetons, the active tab, the focus ring.

Controls are chunky and physical. Every button has a darker edge under its face and presses down on tap. Titles are set in Russo One, white, with a dark drop like a game HUD; everything read is Nunito, heavy where it is a control or a number. The cards are the one light thing on the table: white printed objects with a tier-coloured frame, a real car photo, stat chips and rarity diamonds, foil on legendaries. Boosters share one printed template and change only their colour, car and theme, one colour per car culture.

The density is mobile-first: a sticky HUD header, a five-tab bottom bar on phones with the Boosters button raised in the middle, big claimable moments for every reward. The system replaces an airy white SaaS layout and refuses to drift back to it. Site copy is French.

**Key Characteristics:**
- Deep indigo ground with violet light pools and a 44px diamond lattice, fixed.
- Raised panels (lit top edge, soft drop) and sunken slots (inner shadow) as the two surface states.
- Chunky 3D buttons in five faces (gold, blue, green, danger, neutral indigo) with a solid bottom edge that presses on :active.
- Russo One titles with a dark drop; Nunito 800–900 for controls and numbers.
- Cards are white physical objects with tier frames; legendaries carry an iridescent holo film.
- One shared booster template, one accent per pack.

## Colors

A saturated night palette: indigo ground and surfaces, a single warm gold for action and currency, three functional button colours, and four tier colours reserved for rarity.

### Primary
- **Jeton Gold** (accent): the primary action, the jeton currency, the active tab underline and icon, the selected pack price chip, text selection and the 3px focus ring. Its gold button face runs a gradient from a light top to a deeper face, sitting on **Burnt Gold Edge** (accent-edge). Text on gold is always **Cocoa Ink** (accent-ink), never white.
- **Gold Glow** (accent-hover): lighter gold for hover tints and highlights.

### Secondary
- **Arcade Blue** (blue, edge blue-edge): the secondary 3D button for non-primary actions.
- **Claim Green** (green, edge green-edge, ink green-ink): claim buttons and the green gauge; rewards ready to collect. Text on green is the dark green ink.
- **Alert Coral** (danger, edge danger-edge): destructive buttons and the count bubble on tabs and cards.

### Tertiary (rarity)
- **Common Steel** (tier-common), **Rare Sky** (tier-rare), **Epic Violet** (tier-epic), **Legendary Gold** (tier-legendary): rarity diamonds, tier frames and anything that names a tier. Each card frame is a 145° three-stop gradient of its tier hue.

### Neutral
- **Table Indigo** (bg): the page ground under the light pools.
- **Deep Table** (bg-deep): the html backdrop, header and tab bar (at 90–95% with blur), HUD pills, fields, gauge tracks.
- **Panel Indigo** (surface) with **Lit Indigo** (surface-hi) at its top: raised panels and the neutral button face.
- **Slot Indigo** (surface-lo): sunken slots, empty states, skeletons, select menus.
- **White** (ink): all text and titles on the table.
- **Lavender Mist** (muted): secondary text, descriptions, inactive tabs.
- **Rule Indigo** (line): decorative strokes such as the empty-state diamond; dividers on the table are white at 10%.
- **Card White / Card Ink / Card Muted / Card Line** (card-*): the printed card only.

Pack accents (lib/packs.ts) are a separate palette of fourteen culture colours used only on booster art and the selected pack's glow; they are not UI colours.

### Named Rules
**The Gold Means Go Rule.** Gold is the screen's main action and the currency, nothing else. One gold button per view; secondary actions go blue or neutral.

**The Dark Ink On Bright Faces Rule.** Gold and green faces carry dark ink (accent-ink, green-ink); only blue, danger and indigo faces carry white.

**The Tier Colours Are Rarity Rule.** The four tier hues appear only where a rarity is being stated.

## Typography

**Display Font:** Russo One (sans-serif fallback), one weight, loaded via next/font as --font-russo
**Body Font:** Nunito (sans-serif fallback), variable weight, --font-nunito

**Character:** Russo One is the squared, sporty game-title voice; Nunito's rounded heavy weights make controls and numbers feel friendly and toy-like. Together they read as a mobile game, not a product site.

### Hierarchy
- **Display** (Russo One 400, clamp(2rem, 6.2vw, 4.75rem), 1.02): the landing headline only, centred, second line in gold.
- **Headline** (Russo One 400, 2rem mobile to 2.75rem, 1.05): page titles (PageHeader, 404). Landing section titles use 1.875rem to 2.6rem at 1.1.
- **Title** (Russo One 400, 1.25rem to 1.5rem): section titles, step titles, large button labels (btn-lg at 1.125rem), balance numbers.
- **Body** (Nunito 400–600, 1rem; descriptions max-w-xl, about 36rem): reading text, set in muted.
- **Body Strong** (Nunito 800–900, 0.8125rem to 0.9375rem): buttons, tabs, chips, pills, stats. Numbers use tabular figures.
- **Label** (Nunito 900, 0.75rem, uppercase, tracking-wider, muted): data group captions only, such as table headers, odds blocks and the give/receive columns of a trade.

### Named Rules
**The Drop Shadow Title Rule.** Every Russo One title on the table carries the title drop (a 3px dark shadow straight down). Body text never does.

**The One Weight Rule.** Russo One ships one weight with font-synthesis off; never request bold or tracking on it.

## Layout

Content sits in a centred column up to 72rem (max-w-6xl) with 20px side padding on phones and 24px from sm. Reading blocks narrow to max-w-xl or max-w-2xl. The sticky header is 64px tall on Deep Table at 90% with backdrop blur and a white/10 bottom rule. Below 1024px the game uses a fixed five-tab bottom bar (68px plus safe area), and the body reserves that height; desktop shows tabs in the header instead. Page headers stack on phones and put the action on the right from sm. The booster screen collapses to a sticky bottom action bar on phones. Panels pad 16–24px; gaps step in Tailwind's 4px scale, mostly 8, 12 and 16px.

## Elevation & Depth

Depth is literal and physical: the table is the floor, panels are raised trays, slots are pressed in, buttons stand on an edge, cards and packs float above everything. Shadows are dark indigo (rgb 6 3 30), never neutral grey.

### Shadow Vocabulary
- **Panel** (`inset 0 1px 0 rgb(255 255 255 / 0.1), 0 12px 28px -14px rgb(6 3 30 / 0.75)`): raised panels, with a top-lit gradient and a 6% white hairline.
- **Sunken** (`inset 0 2px 6px rgb(6 3 30 / 0.45)`): slots, empty states, HUD pills and fields (with a 1px white/8 lip below).
- **Button edge** (`inset 0 2px 0 rgb(255 255 255 / 0.32), 0 4px 0 var(--edge), 0 10px 18px -6px rgb(6 3 30 / 0.6)`): the 3D button; on :active it drops 3px and the edge shrinks to 1px.
- **Card** (`0 14px 28px -12px rgb(6 3 30 / 0.7), 0 2px 6px rgb(6 3 30 / 0.35)`): every card face and back.
- **Lift** (`0 26px 44px -16px rgb(6 3 30 / 0.8), 0 4px 10px rgb(6 3 30 / 0.4)`): cards picked up or hovered high.
- **Title drop** (`0 3px 0 rgb(10 6 40 / 0.55)`, text-shadow): display titles.

### Named Rules
**The Pressed Edge Rule.** The solid bottom edge under a button is its own darker colour, directly beneath (no sideways offset), and it collapses when pressed. It belongs to buttons, count bubbles and the raised Boosters tab only.

**The Raised Or Sunken Rule.** A surface on the table is either raised (panel) or pressed in (sunken). There are no flat bordered boxes.

## Shapes

Soft, generous rounding everywhere: panels 20px, sunken slots 16px, buttons and fields 14px (18px large, 12px small), pills and bubbles fully round. Cards are 5:7 with a 14px outer frame, a 5px frame band, a 10px inner face and a 7px photo window at 10:9. The diamond is the brand shape: wordmark mark, jeton stamp, rarity pips, the empty-state glyph and the 44px background lattice.

## Components

### Buttons
Chunky, glossy and tactile; they feel like they can be pushed.
- **Shape:** 14px radius (btn), 18px (btn-lg), 12px (btn-sm); min heights 44 / 56 / 36px.
- **Primary (gold):** gradient #ffe066 to #ffbf1f over the Burnt Gold Edge, Cocoa Ink label, Nunito 900 at 15px. btn-lg switches the label to Russo One 18px.
- **Secondary (blue), Claim (green), Danger (coral), Neutral (indigo):** same build, different face, top and edge. Discord sign-in uses the same button with Discord blurple faces.
- **Hover / Focus / Active:** hover brightens 8%; focus is the global 3px gold outline at 3px offset; active presses down 3px over 120ms on the exponential ease-out. Disabled is a dull indigo face with a lavender label.

### Chips and Pills
- **HUD pill:** Deep Table, fully round, 38px tall, sunken shadow, gold jeton icon then a tabular number; links brighten on hover.
- **Fact chip:** white/8 fill, white/10 ring, gold icon, Nunito 800.
- **Count bubble:** coral, 20px, white 11px number, a 2px coral edge and a 2px Deep Table ring; gold for available packs.

### Cards / Containers
- **Panel:** 20px radius, Lit Indigo to Panel Indigo gradient (38%), Panel shadow, padding 16–24px.
- **Sunken slot:** 16px radius, Slot Indigo, Sunken shadow; also the empty state (diamond glyph, Russo One title, muted line, one action) and the skeleton.

### Inputs / Fields
- **Style:** Deep Table, 14px radius, 44px, Nunito 700 at 15px, sunken inner shadow, gold caret, placeholder #9890d6.
- **Focus:** a 3px gold ring replaces the lip.

### Navigation
- **Header:** wordmark (gold diamond plus lowercase "kuruma" in Russo One with drop), five tabs, then jetons pill, bell, avatar. Tabs are 44px Nunito 800, muted at rest, white on white/10 when active with a gold icon and a 3px gold underline at the header's bottom edge.
- **Mobile tab bar:** five columns on Deep Table at 95% with blur; active tab white with gold icon. Boosters sits in the middle as a raised 64px gold disc on its own edge, ringed in Deep Table, pulsing a gold ring when packs are waiting.

### Trading Card (signature)
White face on a tier frame, a two-line name in Nunito 900, the photo window, brand line, stat chips (culture, year, power) on card-line, and a footer with rarity diamonds and the copy serial. Sizes scale with container units. Interactive cards tilt on a spring (up to 9° and 11°) with a pointer glare; legendaries add an iridescent multiply film that drifts at rest. Missing cards are 45% opacity and greyscale. The card back is a gold frame around an indigo lattice with a white wheel, a gold diamond and the wordmark.

### Booster and Opening (signature)
Boosters are the shared printed art (public/booster) shown as WebGL foil packs using the art's alpha, or as images with a coloured drop-shadow glow when selected. Opening is full screen: tear, then cards turn one by one with the rarest last, on springs and exponential ease-out, with reduced motion honoured.

### Gauge
Fully round 12px track on Deep Table, sunken; glossy gold fill (green variant for claims) that grows over 600ms.

## Do's and Don'ts

### Do:
- **Do** put every surface on the indigo table as raised panel or sunken slot, with indigo-tinted shadows.
- **Do** make the screen's main action the gold 3D button, and keep it to one per view.
- **Do** set titles in Russo One with the title drop, and everything read in Nunito.
- **Do** keep cards white with their tier frame; rarity is told by frame colour and diamonds.
- **Do** draw new boosters from the shared template, changing only colour, car, theme line and perk, and keep the colour in sync with lib/packs.ts.
- **Do** use springs and the exponential ease-out (cubic-bezier(0.22, 1, 0.36, 1)) and respect reduced motion.

### Don't:
- **Don't** return to light, airy white SaaS surfaces; white belongs to the cards.
- **Don't** put white text on gold or green faces.
- **Don't** use tier colours for anything but rarity, or pack accents outside booster art.
- **Don't** bold or track Russo One, or use it for paragraphs.
- **Don't** put small uppercase labels above titles; the uppercase label is for data captions only.
