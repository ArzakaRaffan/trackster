# Trackster Design System

Trackster is a personal-finance tracker web app for Indonesian users. It reads bank notification
emails (BCA and Bank Jago), parses each transaction automatically, tracks the spend against a
**daily** budget, and pushes a Telegram alert when the day goes over. It is opened on a phone,
several times a day, for a few seconds at a time — so the design system is mobile-first, dense, and
built around one question: *berapa yang udah kepakai hari ini?*

**Product surfaces (Next.js 14 App Router)**

| Route | Screen | What it answers |
|---|---|---|
| `app/page.tsx` | Hari Ini | Today's spend vs daily budget, progress bar, transaction list |
| `app/weekly/page.tsx` | Mingguan | 7-day bars, totals, per-source split |
| `app/budget/page.tsx` | Budget | Set/change the daily budget, history |
| `app/settings/page.tsx` | Setting | Email sources, Telegram alerts, account |
| `app/login/page.tsx` | Login | Cookie-based session |
| `components/NavBar.tsx` | NavBar | The four-route bottom navigation |

**Fixed technical context (do not change when consuming this system)**
Next.js 14 App Router + TypeScript · Tailwind CSS core utilities only (no plugins, no custom
compiler) · SWR + `lib/api.ts` for all data · cookie auth via `middleware.ts`. Every number on
screen comes from the REST API — this system never introduces static/mock data into the app.

Primary endpoint the Hari Ini pattern is built against:

```
GET /budget/today →
{ date, budget, totalSpent, remaining, isOverBudget,
  transactions: [{ id, amount, description, source, occurredAt }] }
```

## Sources used to build this system

- `uploads/DESIGN-spotify.md` — the visual reference the user supplied: an extracted spec of
  Spotify's web player (colour ramp, type ladder, radius/shadow scales, component stylings,
  breakpoints). **Every token in `tokens/` traces to a value in that document.**
- The product brief pasted into chat (routes, data shape, tech stack, constraints).
- **Not provided:** the Trackster codebase itself, any Figma file, any logo/brand asset, and the
  proprietary Spotify fonts. See *Gaps & substitutions* below — these are the things to send next.

Trackster is not Spotify and must not look like a Spotify clone: the reference contributes the
*system* (near-black immersion, single functional accent, pill geometry, compact type, heavy
shadows), not Spotify's brand, marks, or product surfaces.

## Gaps & substitutions (please confirm)

1. **Fonts.** SpotifyMixUI / SpotifyMixUITitle (CircularSp) are proprietary and weren't supplied.
   Substituted **Figtree** (Google Fonts) as the nearest geometric sans; `JetBrains Mono` is used
   only for token/spec annotations in the guideline cards, never in the product. Swap the `@import`
   in `tokens/fonts.css` for local `@font-face` rules when you have licensed binaries.
2. **Icons.** No icon set was supplied. Substituted **Lucide 0.427.0** (2px stroke, no fills) from
   CDN. `components/core/Icon.jsx` wraps it; in the Next app use `lucide-react`.
3. **Logo.** No logo or brand mark was supplied, so **none was drawn**. The wordmark is set in type
   (`--font-title`, weight 900, tracking −2px, optional green period). See
   `guidelines/brand-wordmark.card.html`.
4. **Codebase.** The existing components were never read, so the component set here is authored
   from the brief and the reference, not reverse-engineered from your code. If you attach the repo
   the kit can be aligned to your real props and class names.

## Content fundamentals

**Language.** Bahasa Indonesia, casual-but-not-slangy — the register of a friend who is good with
money, not a bank. English loanwords that Indonesians actually use stay English: *budget*, *over
budget*, *alert*, *sinkron*, *transaksi*. Never translate "over budget" to "melebihi anggaran".

**Person.** Address the user as **kamu**, never *Anda* (too formal) and never *saya/kami* for the
app unless it is describing an action it took ("Alert Telegram sudah dikirim"). The app narrates
what it did; it does not chat.

**Casing.** Sentence case everywhere: screen titles (`Hari Ini`, `Mingguan`, `Budget`, `Setting`),
section headers (`Transaksi`, `Per hari`), button labels (`Simpan budget`, `Atur budget`).
UPPERCASE is a *typographic* device only — 12px caption labels (`TERPAKAI HARI INI`) and `caps`
buttons — never a way to shout in copy.

**Numbers.** Always `Rp` + `id-ID` grouping, no space, no decimals: `Rp169.700`. Abbreviate only in
charts and dense tiles: `Rp1,2jt`, `Rp150rb`. Negative/spend amounts carry a leading `−`
(U+2212, not a hyphen). Time is 24-hour `19:05`. Dates are `Rabu, 12 Agustus`.

**Tone examples**

| Situation | Write | Don't write |
|---|---|---|
| Over budget | "Kamu Rp19.700 di atas budget. Alert Telegram terkirim 19:05." | "Waspada!! Pengeluaran Anda melebihi anggaran! 😱" |
| Empty list | "Belum ada transaksi. Begitu ada email notifikasi dari BCA atau Jago, transaksinya muncul di sini otomatis." | "Tidak ada data." |
| Budget saved | "Budget tersimpan. Berlaku mulai hari ini." | "Sukses! Data berhasil disimpan." |
| Login footer | "Session disimpan di cookie. Kamu tetap login di HP ini." | "Kami menjaga keamanan data Anda." |

**No emoji.** Not in the UI, not in Telegram alerts, not in empty states. Status is carried by
colour, a `Badge`, and a Lucide glyph. No exclamation marks except where a human would genuinely
use one (almost never). No blame ("kamu boros"), no praise theatre ("keren!") — just the number and
what it means.

**Labels are short.** Nav labels one word (`Hari Ini` is the exception). Buttons are verb + object
(`Simpan budget`, `Atur budget`). Captions ≤ 4 words.

## Visual foundations

**The idea.** Near-black immersion, one functional green, pill-and-circle geometry, compact type,
heavy shadows. In Spotify the album art supplies the colour; in Trackster **the money supplies the
colour** — the only chromatic events on a screen are the budget status (green/orange/red), the bank
source tags (blue/orange), and the single green primary action.

**Colour.** Four-step near-black ramp: page `#121212` → card `#181818` → interactive `#1f1f1f` →
hover/alt `#252525`. Text is white for what matters and `#b3b3b3` for everything else; `#7c7c7c` is
the dead-label floor. Green `#1ed760` is *functional only*: primary CTA, active nav dot, on-state,
under-budget. Status triad: under `#1ed760`, near (≥80% spent) `#ffa42b`, over `#f3727f`. Source
hues are reserved: BCA `#539df5`, Jago `#ffa42b` — never reuse them for status. Max two background
shades per screen. No gradients in the product UI (the one radial backdrop in the UI kit is stage
dressing, not app chrome).

**Type.** Figtree (SpotifyMixUI stand-in). Compact 10–24px ladder — 24/700 title, 18/600 section,
16 body (700 for names, 400 for meta), 14 labels/buttons, 12 captions, 10.5 badges, 10 micro. Two
Trackster-only extensions above the reference range: `--text-amount` 40px and
`--text-amount-hero` 56px, weight 800, tracking −1.5px, used **once per screen** for the money
headline; without them a finance app has no focal point. Hierarchy comes from weight (700 vs 400),
not from size proliferation. All figures `font-variant-numeric: tabular-nums`. Line-heights stay
tight (1.0–1.3); only 12px body copy relaxes to 1.5.

**Spacing & layout.** 8px base with the reference's odd micro steps kept verbatim (1,2,3,5,6,10,14,
15). Mobile gutter 16px, card gap 12px, in-card gap 12–20px, card padding 16–20px, list-row
min-height 56px with 10px/12px padding. Dark compression: content is dense, the darkness does the
spacing work — no giant hero whitespace. Fixed elements: sticky blurred `TopBar` at the top, fixed
blurred `NavBar` at the bottom (`--navbar-safe` reserves the space, including
`env(safe-area-inset-bottom)`), and one green FAB bottom-right on Hari Ini. ≥1024px the bottom bar
becomes a 240px sidebar and content caps at 720px — Trackster never stretches a phone layout across
a desktop.

**Radii.** 2px tags, 4px small elements, 6px list rows, 8px cards, 10px hero card, 20px sheets,
9999px small pills, 500px large pills, 50% circles. Cards are borderless; a square-cornered button
is out of the system.

**Cards.** Filled `#181818`, 8px (10px for the hero), no border, no shadow at rest. Elevation is a
shade step, not a shadow: hover lightens to `#252525`. Shadows appear only when something floats —
`rgba(0,0,0,.3) 0 8px 8px` for menus/dropdowns, `rgba(0,0,0,.5) 0 8px 24px` for sheets/dialogs.
Heavy on purpose: subtle shadows are invisible on near-black. Fields never show a raw border —
they use the inset ring `rgb(18,18,18) 0 1px 0, rgb(124,124,124) 0 0 0 1px inset`, which turns
green on focus and red when invalid. Hairline outlines (`#fff` at 10%) are reserved for empty
states.

**Transparency & blur.** Exactly two places: the sticky `TopBar` (`rgba(18,18,18,.86)`) and the
bottom `NavBar` (`rgba(18,18,18,.92)`), both with a 12px backdrop blur, so content scrolls under
them without a hard edge. No glass cards, no frosted panels.

**Motion.** Fast and unsentimental. 120ms press, 200ms hover/colour, 320ms for progress-bar fills
and sheet entrances. `--ease-standard` `cubic-bezier(.3,0,.4,1)` for state changes,
`--ease-out` `cubic-bezier(.16,1,.3,1)` for things that travel. No bounce, no spring, no attention
loops; the only continuous animation in the system is the loading shimmer.

**States.** Hover: filled green/light surfaces brighten (`filter: brightness(1.08)`), dark surfaces
lighten to `#252525`, list rows take a 7% white wash, ghost icons go from `#b3b3b3` to white.
Press: `scale(.97)` on pills, `scale(.94)` on circles — no colour change. Focus: the green inset
ring on fields. Disabled: 40% opacity, no colour swap. Active nav: white + 700 + a 4px green dot.

**Imagery.** There is none, and that is the rule — no photography, no illustration, no stickers, no
hand-drawn marks. A transaction's "art" is a monogram circle on `#1f1f1f`. If imagery is ever
introduced it must be cool-toned and near-monochrome so it doesn't compete with the status colours.

## Iconography

- **Set:** Lucide 0.427.0 — outline only, 2px stroke, round caps, `currentColor`. Substituted
  because no icon assets were provided; flag if your app already ships something else.
- **Sizes:** 16px inline with text, 20px default, 22–26px nav and hero controls. Never below 14px.
- **Delivery:** CDN UMD in these HTML kits (`unpkg.com/lucide@0.427.0/dist/umd/lucide.min.js`),
  `lucide-react` in the Next app. `components/core/Icon.jsx` is the wrapper (`<Icon name="wallet" />`).
- **Colour:** icons inherit text colour. They only take a status colour when they *are* the status
  (`triangle-alert` in an over-budget `Alert`). Never a decorative accent icon.
- **The working set:** `sun` (Hari Ini), `bar-chart-3` (Mingguan), `wallet` (Budget), `settings`
  (Setting), `plus` (add transaction), `bell`, `refresh-cw` (sync), `mail` (email source), `send`
  (Telegram), `search`, `triangle-alert`, `gauge`, `inbox` (empty), `calendar`, `check`, `log-out`,
  `chevron-right`, `lock`.
- **No emoji, no unicode glyphs as icons.** Two deliberate exceptions inside components: the `▾`
  select chevron and the `▲/▼` delta arrows in `StatTile`, both typographic rather than iconic. The
  `✕` dismiss in `Alert` is likewise a glyph, not an icon.
- **No icon font, no sprite sheet, no hand-drawn SVG** — if a glyph is missing from Lucide, ship
  text instead of inventing one.

## Components

Authored from scratch (no component library was supplied), grouped by concern. Every component is
inline-styled off the CSS custom properties, imports React only, and has a sibling `.d.ts` +
`.prompt.md`.

**`components/core/`** — `Button`, `IconButton`, `Icon`, `Card`, `Badge`, `Input`, `Select`, `Switch`
**`components/data/`** — `AmountDisplay`, `BudgetProgress`, `TransactionRow`, `SourceTag`, `StatTile`, `DayBarChart`
**`components/navigation/`** — `NavBar`, `TopBar`, `SectionHeader`
**`components/feedback/`** — `Alert`, `EmptyState`, `Skeleton`

*Intentional additions* (no counterpart in the reference doc, added because Trackster needs them):
`Icon` (wrapper for the substituted glyph set), `AmountDisplay`, `BudgetProgress`, `TransactionRow`,
`SourceTag`, `StatTile`, `DayBarChart` — the money-and-budget vocabulary the product is made of.

## Index

| Path | What it is |
|---|---|
| `styles.css` | Global entry — `@import` list only |
| `tokens/colors.css` | Ramp, brand, status, source, border tokens |
| `tokens/typography.css` | Font stacks, size/weight/tracking scale |
| `tokens/spacing.css` | Spacing scale + layout constants |
| `tokens/radius.css` | Radius scale (2 → 500px, 50%) |
| `tokens/elevation.css` | Shadows, inset rings, blur, motion |
| `tokens/fonts.css` | Webfont imports + substitution notice |
| `tokens/base.css` | Body reset, link colours, shimmer keyframes |
| `components/…` | 20 components (see above), each with `.d.ts`, `.prompt.md`, one card HTML |
| `guidelines/*.card.html` | 18 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `ui_kits/trackster-app/` | Click-through recreation of all five app screens (`index.html`) |
| `templates/trackster-screen/` | Starting template for a new Trackster screen |
| `handoff/tailwind.config.js` | The tokens expressed as Tailwind theme values |
| `handoff/app-page.tsx.txt` | Reference redesign of `app/page.tsx` (SWR wiring untouched) |
| `handoff/NavBar.tsx.txt` | Reference redesign of `components/NavBar.tsx` |
| `handoff/README.md` | How to apply the system to the Next.js app, page by page |
| `SKILL.md` | Agent Skills entry point |
| `thumbnail.html` | Homepage tile |
