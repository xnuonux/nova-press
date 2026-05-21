---
name: plate-editor
description: Reference for plate editor architecture in nova. Use when building or modifying the editor surface, plate plugins, slash menu, bubble toolbar, ghost text, focus mode, typewriter mode, or the AI panel mount point. Triggers on src/app/editor/, src/components/editor/, plate plugin files.
---

# plate-editor

plate is the editor spine. it's slate underneath with a plugin system. nova rides on plate's AIKit, SlashKit, and a curated set of basic plugins. before adding anything custom, check if plate already ships it.

## plugin composition (ordered, from `src/components/editor/plate-shell.tsx`)
1. `BasicBlocksKit` ... heading, paragraph, blockquote, hr
2. `BasicMarksKit` ... bold, italic, code, strike, underline
3. `LinkKit`
4. `ListKit` + `IndentKit`
5. `CodeBlockKit` ... shiki dual-theme
6. `MathKit` ... katex
7. `MediaKit` ... image, video, caption
8. `TableKit`
9. `CalloutKit`
10. `TocKit`
11. `FootnoteKit` ... sidenotes on desktop
12. `AutoformatKit` ... smart quotes ON, em-dash autoformat OFF (voice rule)
13. `SlashKit`
14. `AIKit` ... AIChatPlugin + AIPlugin + CopilotPlugin
15. `CursorOverlayKit`
16. `BlockMenuKit` + `BlockSelectionKit`
17. `FloatingToolbarKit`
18. `MarkdownKit`
19. `BlockPlaceholderKit`
20. `ExitBreakKit`

## the AI panel mount point
the AI panel lives at `src/components/editor/partner-rail.tsx`. it slides in from the right at width 320px. the plate AIChatPlugin's `chatOptions.api` points to `/api/ai/command` which streams via vercel ai sdk 5 SSE.

panel header: nova glyph + "nova" label + status dot
panel body: chat messages alternating user/nova styles
panel footer: textarea composer, cmd+enter sends, escape closes

## slash menu architecture
slash items grouped:
- **write with me**: continue, expand, rewrite, shorten
- **brainstorm**: headlines, hooks, closings, ideas
- **check**: voice-check, fact-flag
- **blocks**: heading 1-3, quote, list, ordered list, todo, code, callout, table, image, divider, footnote
- **embed**: math, youtube, tweet, mention

each item: icon 16px, label inter 13/16, kbd hint right-aligned iosevka 11/14 lunari-fg-subtle.

## bubble toolbar on selection
plate's `FloatingToolbarKit`. items: bold, italic, code, link, divider, then AI actions: improve, shorten, expand, rewrite, voice-check. width animates 200ms on action reveal.

## focus mode (cmd+.)
- hides left rail, right rail, top chrome
- narrows canvas to 680px
- dims all paragraphs NOT in active selection to opacity 0.35
- transitions 220ms ease-out-quart
- exits on any rail tap or cmd+. again

## typewriter mode (cmd+;)
- keeps active line at 42% viewport height
- implemented via `scroll-margin` on the focused block + scroll-into-view on caret move
- exits on cmd+; again

## autosave UX
- 1500ms debounce on content change
- POST to `/api/revisions` with `{piece_id, content_json, created_by: 'autosave'}`
- chip in bottom utility row: `saving... → saved 3s ago → saved 1m ago`
- chip opacity 0.4 → 1 on state change (160ms)

## when this skill fires
- editing `src/components/editor/*`
- editing `src/app/editor/[id]/page.tsx`
- adding or removing plate kits
- wiring slash menu items or bubble toolbar
- touching the AI panel UI

## stop-on conditions
- adding a plate plugin without checking the kit catalog first
- writing custom slate code when a plate plugin exists for it
- enabling em-dash autoformat in AutoformatKit (voice rule violation)
- ghost text producing more than one sentence
