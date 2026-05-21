# claude code handoff · week 1 chunk · editor surface

> first build chunk. claude code reads this and starts. shadow it against the handoff format from the directive packet: context / user story / scope / acceptance / constraints / open questions.

## context
this is week 1 of the four-week nova press build. the goal of this chunk is the editor surface: lunari tokens loaded, plate booting in `/editor/[id]`, autosave working, the AI panel placeholder visible on the right saying "nova is listening" in IBM Plex Serif. no AI calls wired yet. no voice corpus yet. no publishing yet. just the writing room.

if claude code finishes this chunk and the editor opens with plate and types into a blank document with the AI panel placeholder mounted, week 1 is on track.

## user story
dom opens nova locally, signs in (or auto-signs in dev mode), clicks "start a draft" on the library, lands in the editor at `/editor/[uuid]`. the title field reads "untitled" in IBM Plex Serif. he clicks into the canvas, types `the thing nobody says about ai writing tools`, watches the autosave chip move from `saving...` to `saved 3s ago`. the right rail shows the nova glyph and the words `nova is listening` in IBM Plex Serif at 16px, lunari-fg-muted. no AI is wired. nothing happens when he presses tab. the experience: a quiet, beautiful, editor that hasn't yet started talking back.

## scope (in)
- lunari design tokens in `src/styles/tokens.css` and tailwind config
- nova accent `#c9a84c` visible on the landing CTA and the AI panel glyph
- `/` landing page with wordmark + tagline + "start writing" CTA
- `/editor/[id]` route with plate editor mounted in a client component
- plate kits enabled: `BasicBlocksKit`, `BasicMarksKit`, `BlockPlaceholderKit`. nothing else yet
- right rail placeholder component `partner-rail.tsx`
- autosave hook stub (writes to local state for now ... real supabase write lands in T-012 once auth is in)
- `/api/health` returns `{ok:true, product:"nova-press"}`
- `/p/example` renders a placeholder magazine view with IBM Plex Serif 18px body

## scope (out)
- no auth integration yet (deferred to T-006)
- no real supabase writes yet (deferred to T-012)
- no AI calls (week 2)
- no slash menu (week 2)
- no bubble toolbar AI actions (week 2)
- no publishing (week 3)
- no repurpose (week 3)
- no custom fonts beyond next/font/google for IBM Plex Serif + Inter (iosevka comes later)

## acceptance criteria
- [ ] `pnpm install && pnpm dev` runs cleanly from a fresh unzip
- [ ] http://localhost:3000 shows the landing with the nova wordmark in iosevka-fallback mono, tagline in lowercase IBM Plex Serif, single CTA "start writing" with nova-accent fill
- [ ] http://localhost:3000/api/health returns `{"ok":true,"product":"nova-press"}`
- [ ] http://localhost:3000/editor shows a working plate editor that types into a blank document
- [ ] the right rail shows the nova glyph + "nova is listening" in IBM Plex Serif 16px
- [ ] the editor canvas is centered, max-width 720px, IBM Plex Serif 18px body, line-height 1.7
- [ ] http://localhost:3000/p/example shows a magazine reading view with placeholder content rendered in IBM Plex Serif 18px, max-width 65ch, lunari-bg-deep background
- [ ] no eslint or typescript errors

## constraints
- voice rule: every UI string lowercase, no em-dashes, `...` for pauses. error messages too. error boundaries too
- design tokens: never inline a hex. always use the css var or tailwind class that references it
- performance: editor route can ship plate (~500KB gz), reading route MUST NOT import any plate editor client code
- accessibility: focus rings on every interactive element (2px nova-accent ring)

## open questions for dom
1. landing tagline: "the writing studio where AI matches your voice, not the other way around." ok or different?
2. signup flow scope: deferred to T-006 (week 1 later). is that fine, or should the landing CTA route to a temporary dev-only editor without auth?
3. /p/example placeholder content: do you want a real essay from your corpus dropped in, or a generic lorem-substitute?
4. iosevka: ship via `@fontsource/iosevka` in week 1 or defer to polish week 4?
