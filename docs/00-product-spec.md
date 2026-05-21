# nova press · product spec (v1)

> the AI writing studio where every output sounds like the user wrote it, and every published piece feels like print magazine quality

## the wedge
1. **voice fidelity** ... nova mirrors the user's recent essays in word choice, rhythm, em-dash policy, sentence cadence. trained per-user on a voice corpus
2. **multi-platform distribution native** ... one source piece compiles into newsletter, twitter thread, linkedin post, all voice-matched
3. **magazine-grade reading view** ... `/p/[slug]` feels like opening a print magazine. typography is the product
4. **sparring partner posture** ... AI never auto-completes more than one sentence unless asked. detects flow state and goes silent

## the four screens

### 1. home (writer's library)
left rail with `pieces / nova chat / settings`. center is a record table of all pieces: title, excerpt, word count, status pill, updated, repurpose-targets indicator. top-right "new piece" CTA. empty state: lowercase, vulnerable, no exclamation marks.

### 2. editor (writing room)
- top bar: title inline-editable, status pill, focus mode toggle, typewriter toggle, preview, publish/schedule
- left rail (collapsible, open default): heading outline, word count, reading time, last-saved
- center canvas: plate editor, max 720px, IBM Plex Serif 18/30, single column
- right rail (collapsible, closed default): AI partner tab + metadata tab
- floating bubble toolbar on selection
- slash menu on `/`
- focus mode hides chrome and dims to active paragraph at 60% opacity
- typewriter mode keeps active line vertically centered
- autosave every 1500ms debounced

### 3. reading view (published artifact)
`nova.lunari.pro/p/[slug]` ... no auth gate, no app chrome
- minimal header: publication name top-left, "all pieces" top-right
- masthead: title in display face, byline + date + reading time, hairline divider
- body: prose-lg, IBM Plex Serif, 65ch max, centered, generous margins
- footer: share row, subscriber capture, prev/next, rss
- print stylesheet that prints clean
- OG image auto-generated via `next/og`
- dark mode toggle, honors system pref

### 4. settings
publication identity, domain (subdomain only in v1), distribution defaults, voice corpus (upload + profile preview + retrain), subscribers (export only v1), integrations placeholders

## the AI partner behaviors

### voice-mirror mechanism
voice corpus → embed (voyage-3-large 1024d) → centroid → compact view (~120 tokens) → injected in every system prompt. retrieval: top-3 chunks by cosine to current paragraph, k=3.

### sparring posture
- ghost text capped at one sentence (server stopSequences + client regex truncate)
- forbidden preamble list enforced ("great", "sure", "absolutely", "here's a", "i'd be happy to")
- push-back option always one click: "say it differently", "wrong angle"
- never sycophantic ("great point" is banned)

### flow-state detection
WPM rolling 30s + deletion rate + pause distribution + scroll behavior.
flow = WPM > 35 AND del < 0.15 AND max_pause < 6s sustained 12s.
in flow: right rail collapses, ghost text suppressed 8s after suggestion, drift toasts suppressed, autosave chip mutes.
exits on typing stop > 20s, paragraph delete, manual rail open, cmd+j.

### slash menu (writing partner)
`/continue` `/rewrite` `/improve` `/shorten` `/expand` `/voice-check` `/headline` `/hook` `/closing` `/brainstorm` plus structural commands (`/heading`, `/quote`, `/code`, `/math`, `/image`, `/embed`).

### nova chat surface
cmd+shift+n or muse glyph. opens as right-side drawer over editor. tools: `start_press_session`, `propose_outline`, `expand_section`, `voice_check`, `rewrite_in_voice`, `headline_options`, `hook_options`, `closing_options`, `repurpose_to_platform`, `draft_to_editor`. scoped per-piece by default with global toggle.

## the multi-platform repurpose engine

source piece = plate JSON + derived markdown. compilers are pure functions per platform in `src/lib/repurpose/compilers/`. each exports `compile(source, voice_profile, platform_config) → compiled_output`. results stored in `compiled_outputs` table.

### platform configs
- **newsletter cut**: full piece preserved, optional editor-frame, mobile-first email markup, preview text auto-derived
- **twitter thread**: 240-char chunks, custom hook tweet, no orphan dependent clauses, final tweet carries link, voice-matched
- **linkedin post**: 1200-1800 chars, paragraph-broken, opener earns the scroll, 2 hashtags max if user opts in

### voice fidelity in compression
compilers preserve signature phrases when they fit. lowercase ratio, em-dash policy, ellipsis preference are prompt constraints, not post-process styling.

### preview + edit flow
repurpose surface renders all three previews side-by-side. each output independently editable post-compile. regeneration full or per-segment. native posting via oauth (deferred to post-v1) or copy-to-clipboard.

## definition of shipped (v1)
- editor that feels expensive
- AI partner mirroring user voice
- slash menu commands working
- reading view at `/p/[slug]` looks like print magazine
- publishing lifecycle: draft → scheduled → published with pg-boss
- multi-platform repurpose engine: source → newsletter / twitter / linkedin
- nova chat surface as drawer
- subscriber capture (basic, no delivery in v1)

## open questions
1. custom domains in v1 or deferred to launch? affects routing + DNS in week 1
2. multiplayer scaffolding now (y.js, MIT) or punt entirely?
3. subscriber depth: export-only v1 vs basic delivery via resend webhook
4. nova chat scope: per-piece (default) or per-user globally
5. voice corpus minimum: cold-start neutral house voice OK, or require N samples before AI partner unlocks
6. content moderation: filter nova outputs at all, or trust the upstream model
