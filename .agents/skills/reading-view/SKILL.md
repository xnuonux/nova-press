---
name: reading-view
description: Reference for nova's magazine-grade published piece view at /p/[slug]. Use when building or modifying the reading view, typography for published pieces, drop caps, sidenotes, the share row, the subscribe block, OG image generation, or the print stylesheet. Triggers on src/app/p/, src/components/reading/.
---

# reading-view

the published piece is the artifact. it has to feel like print. magazine-grade or it doesn't ship.

## typography (immutable)

- max-width: 65ch (~640px) for body
- body: IBM Plex Serif, 18px desktop, 16px mobile, line-height 1.7
- h1: PP Editorial New (when wired) or IBM Plex Serif Bold, 48-56px, line-height 1.05, top 0 bottom 24
- h2: 32px, line-height 1.15, top 56 bottom 16
- h3: 22px italic, top 40 bottom 12
- lead paragraph: 22px ink-dim, line-height 1.6
- blockquote: italic 22px with 3px nova-accent left rule, 32px indent
- caption: Inter 12px, tabular-nums, lunari-fg-muted
- footnote: Inter 13px

## layout

- centered single column. NO sidebars in v1
- vertical rhythm: 96px top padding, 128px bottom
- nav: minimal. wordmark top-left, share row right. nothing else above the fold
- subscribe block appears at ~70% scroll, single email input, single button

## drop caps (optional)

fires only on first paragraph if:

- paragraph length > 240 chars
- piece has no leading h2
- user setting `drop_caps_enabled` is true (default true)

implementation: `::first-letter` with `initial-letter: 3 2` fallback to float.

## sidenotes (footnotes on desktop)

- desktop ≥ 1024px: render in right margin column (260px), Inter 13/20
- below 1024px: collapse to numbered superscript, tap to reveal inline
- never in v1 reading view feature scope but reserve the margin

## code blocks

- shiki dual-theme: `min-light` for light mode, `nord` for dark
- font: var(--font-mono), 14px, line-height 1.6
- background: lunari-bg-elevated, border lunari-border, radius 6px, padding 16/20

## math

- katex server-rendered, no client js
- block math centered, inline math baseline-aligned

## images

- max-width: 1080px (full-bleed allowed)
- caption: Inter 14/22 italic, centered, lunari-fg-muted
- always include alt text or fail validation

## share row

- copy link, twitter/X, linkedin, threads
- icons 18px, lunari-fg-muted → nova-accent on hover, 160ms transition
- copy link writes to clipboard, fires "copied." toast

## subscribe block

- copy: "if this hit, leave your email."
- input: full width on mobile, max 360px on desktop
- button: nova-accent fill, lunari-bg-deep text, label "subscribe"
- double opt-in via resend after submit

## OG image

- 1200 × 630
- lunari-bg-deep background with nova-accent rule top
- title in IBM Plex Serif, auto-fit up to 96px
- byline + reading time bottom-left, nova wordmark bottom-right
- generated via `@vercel/og` (next/og) on demand, cached 7 days

## print stylesheet

`src/components/reading/print.css`:

- full body width on print
- black ink on white
- hides nav, share row, subscribe block, sidenotes (expand inline)
- page-break-inside: avoid on blockquote, figure, code block

## performance budget

- TTFB on `/p/[slug]`: 200ms (edge cache, RSC, no client js in the critical path)
- LCP: ≤ 1500ms
- CLS: ≤ 0.05 (fonts preloaded, image dimensions declared)
- editor bundle MUST NOT ship to this route. use plate's static rendering API (`<PlateStatic>` when on `platejs`, or a manual serializer if still on legacy `@udecode/plate`)

## when this skill fires

- editing `src/app/p/[slug]/page.tsx`
- editing `src/components/reading/*`
- working on OG image generation
- touching the published-piece typography
- the print stylesheet

## stop-on conditions

- importing the plate editor client component into this route
- inlining hex values instead of using lunari tokens
- adding chrome (sidebar, breadcrumb trail, in-app nav) to the published view
- shipping a font weight not already loaded
