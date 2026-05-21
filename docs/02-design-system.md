# nova press · design system

## color tokens

### lunari base (shared across titans)
```
--lunari-bg-deep:     #0a0a0f   canvas
--lunari-bg-surface:  #14141c   cards, panels
--lunari-bg-elevated: #1c1c26   modals, popovers
--lunari-fg-primary:  #f5f5f0   body text
--lunari-fg-muted:    #8e8e98   secondary text
--lunari-fg-subtle:   #5e5e68   placeholder, disabled
--lunari-border:      #2a2a36   hairlines, dividers
```

### nova accent
```
--nova-accent:        #c9a84c   golden hour ... CTAs, accents, drop caps, focus rings
--nova-accent-soft:   #c9a84c at 12%   hover surfaces, subtle highlights
```

never inline a hex. always use the css variable via tailwind class or var().

## typography

### fonts
- **body** (reading view, editor canvas): IBM Plex Serif → `var(--font-serif)`
- **UI** (chrome, buttons, labels): Inter → `var(--font-sans)`
- **code** (code blocks, monospace numerics): Iosevka → `var(--font-mono)` (currently falls back to system mono until `@fontsource/iosevka` is added)
- **display** (reading view article titles, drop caps, future ceremonial): PP Editorial New ... deferred to post-v1 polish, falls back to IBM Plex Serif Bold today

### scale
```
text-xs     12px   metadata, captions
text-sm     14px   UI labels, helper text
text-base   16px   default UI body
text-prose  18px   editor + reading default
text-lg     20px   small heading, lead paragraph
text-xl     24px   h3 in app
text-2xl    32px   h2 in app, reading h2
text-3xl    40px   reading h2 alt
text-4xl    56px   reading h1
text-display 72px  rare hero moments
```

### line-height
- prose: 1.7 - 1.75
- UI: 1.4 - 1.5
- display: 1.05 - 1.1

### numerics
all metadata (word count, reading time, dates, status counters) use `font-variant-numeric: tabular-nums;` so digits don't jitter when they change.

## spacing rhythm
4px base. all spacing is from the set: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. never arbitrary pixels in tailwind classes.

## motion
- ease-out-quart: `cubic-bezier(0.25, 1, 0.5, 1)` ... state changes 150-200ms
- ease-out-expo: `cubic-bezier(0.16, 1, 0.3, 1)` ... entrances 200-280ms
- always provide `prefers-reduced-motion` fallback that snaps to end state
- never animate the editor canvas itself (text needs to land where typed)

## shadows
two-layer, warm-tinted:
```
shadow-sm: 0 1px 2px hsla(20, 20%, 5%, 0.4)
shadow-md: 0 1px 2px hsla(20, 20%, 5%, 0.4), 0 8px 24px -8px hsla(20, 20%, 5%, 0.6)
```
no flat grey shadows.

## texture
3% opacity SVG noise overlay on lunari-bg-deep gives paper feel without performance hit. enabled on editor canvas and reading view body backgrounds.

## focus states
2px nova-accent ring, 2px lunari-bg-deep offset. always visible, never `outline: none` without a replacement.

## reading view rules (immutable)
- max-width 65ch for body
- single column, NO sidebars
- centered, generous vertical margins
- IBM Plex Serif 18px desktop, 16px mobile, line-height 1.7
- drop caps optional, fire only on first paragraph if > 240 chars and no leading h2
- print stylesheet ships from day one

## agent voice (UI-side)
NOVA's voice in app strings: golden hour, the muse, emotionally fluent, knows when to shut up so the writer can flow. all within the universal voice rules (lowercase, no em-dashes, `...` for pauses, dom-voice character).

## what NEVER to do
- inline color hex values (always token)
- use the default tailwind grey scale (use lunari fg/border tokens)
- add a new font without sub-chat approval
- break the 4px rhythm
- ship a route without dark-mode default
- show a spinner (always skeleton or progress)
