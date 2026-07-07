---
name: lunari-design-tokens
description: Reference the lunari design system. Use when building UI components, styling pages, picking colors, picking type, deciding spacing, or any frontend visual work. Triggers on .tsx, .jsx, .css, tailwind config edits.
---

# lunari-design-tokens

every titan inherits the lunari design soul (mining section 13). product accent overrides one variable; everything else is shared.

## color tokens (tailwind.config.ts already configured)

- `--lunari-bg-deep`: #0a0a0f (canvas)
- `--lunari-bg-surface`: #14141c (cards, panels)
- `--lunari-bg-elevated`: #1c1c26 (modals, popovers)
- `--lunari-fg-primary`: #f5f5f0 (body text)
- `--lunari-fg-muted`: #8e8e98 (secondary text)
- `--lunari-fg-subtle`: #5e5e68 (placeholder, disabled)
- `--lunari-border`: #2a2a36
- `--nova-accent`: #c9a84c (golden hour)
- `--nova-accent-soft`: #c9a84c at 12% opacity for hover surfaces

## typography

- body: IBM Plex Serif (`--font-serif`)
- UI: Inter (`--font-sans`)
- code: Iosevka (`--font-mono`) ... currently falls back to system mono; add @fontsource/iosevka when ready
- nova reading view: 18px body desktop, 16px mobile, line-height 1.7

## spacing rhythm

- 4px base unit. all spacing is 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- never use arbitrary pixel values in tailwind
- prose max-width: 65ch (reading view) or 720px (editor canvas)

## component baseline

- shadcn/ui as the primitive layer
- variants live in `src/components/ui/`
- product-specific compositions in `src/components/editor/`, `src/components/reading/`
- always check shadcn first before building from scratch

## what NEVER to do

- never inline color hex values (always token via css var)
- never use the default tailwind grey scale (use lunari fg/border tokens)
- never add a new font without sub-chat approval
- never break the 4px rhythm
