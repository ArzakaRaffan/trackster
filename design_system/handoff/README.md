# Handoff — applying Trackster to the Next.js app

Order of operations. Step 1 is a prerequisite for everything else.

1. **Tokens first.** Copy `tailwind.config.js` over the app's config (or merge the `theme.extend`
   block). Add the font to `app/layout.tsx`:
   `import { Figtree } from "next/font/google"` → `const ui = Figtree({ subsets: ["latin"], weight: ["400","600","700","800","900"] })`,
   then `<body className={`${ui.className} bg-base text-ink`}>`. Replace with the real
   SpotifyMixUI/CircularSp `@font-face` files when licensed. Install `lucide-react`.
2. **`app/page.tsx` (Hari Ini)** — `app-page.tsx.txt` here is the reference implementation (`.txt` so the design-system compiler skips it — drop the suffix when you copy it in). The SWR call,
   `lib/api.ts` fetcher, response shape, and auth flow are untouched; only markup and classes change.
   This page is the pattern: money hero → progress bar → conditional alert → list → footnote.
3. **`components/NavBar.tsx`** — `NavBar.tsx.txt` here. Bottom bar on mobile, sidebar ≥1024px. Reserve
   `pb-navbar` on every page so content clears it.
4. **Propagate to the other three** using the same skeleton, swapping only the "hero" object:
   - `app/weekly/page.tsx` — hero = 3 stat tiles + the 7-day bar chart (bars are plain divs; no
     chart library). Keep the dashed daily-budget line. Two constraints that bite: the bar columns must
     stretch to the row height (`items-stretch`, track `flex-1 min-h-0`) or percentage bar heights
     collapse to 0; and stat figures in a 3-up row must shrink below `text-title` (rupiah values are
     8–10 characters) — step the size down or drop to 2 tiles per row.
   - `app/budget/page.tsx` — hero = current daily budget + the field, presets as small pills,
     `Simpan budget` as the one green full-width CTA at the bottom.
   - `app/settings/page.tsx` — no hero; stacked cards of `Switch` rows (label + description),
     one destructive `Keluar` button at the end.
   - `app/login/page.tsx` — wordmark + one-line promise, two fields, one green CTA, cookie note.

**Rules that keep it coherent**

- One green primary action per screen. One `text-amount-hero` figure per screen.
- Never hardcode a status colour — derive it: `isOverBudget` → over, `spent/budget >= 0.8` → near,
  else under.
- Every rupiah figure: `tabular-nums`, `Rp` + `id-ID` grouping, `−` prefix for spend.
- Cards: `rounded-comfortable bg-surface p-4` (hero `rounded-medium p-5`). No borders. Shadows only
  on floating things.
- Fields: `shadow-field`, `focus:shadow-field-focus`, error `shadow-field-error`. No `border-*`.
- Hit targets ≥44px; list rows `min-h-[56px]`.
- Loading: shape-matching skeletons on first load only — let SWR keep showing stale data on
  revalidate.

**Core-utility-only constraint.** Everything above uses stock Tailwind utilities plus the config's
named tokens. The three arbitrary values used on purpose (`bg-base/[0.86]`, `hover:bg-white/[0.07]`,
`shadow-[inset_0_0_0_1px_#f3727f]`) are core-syntax opacity/arbitrary values, not plugins.
