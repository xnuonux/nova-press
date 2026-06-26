# nova press · the mythos · vision

> the north star. last updated 2026-06-26. the complete standalone nova press: a full editorial system + an ai-driven author, for every form of writing. the architecture that builds it is `docs/08-editorial-system-architecture.md`.

## the one idea

every written thing is a tree of typed units under a form.

a haiku, a sonnet, an essay, a newsletter, a novel, a trilogy, the silmarillion, an encyclopaedia, a dictionary of a language that does not exist yet ... they are all the same shape. a `Work` (the project) over a tree of nodes (the structure), whose leaves carry one of four things: a prose or verse body (today's editor, untouched), a typed record (a dictionary word, an infobox, a character sheet), a sub-work (a volume in a series), or nothing (a folder that just holds shape).

the database stores a universal tree. a typescript form registry is the only thing that knows what a sonnet is. adding a villanelle, a recipe, a screenplay is one object literal ... never a migration. that is the whole trick, and it is the thing none of the prior art owns: scrivener has the tree but only for prose, polyglot has typed records but no manuscript, vellum typesets but does not let you write, sudowrite drafts but in a hollow average voice. nova fuses form, format, and voice into one substrate, so a writer never re-tools to change shape.

## what it serves

the same room, for all of it:

- **articles, essays, newsletters** ... today's nova, now optionally part of something bigger.
- **stories, novellas, novels** ... manuscript, parts, chapters, scenes, with a binder you can shuffle and word targets that breathe.
- **series, trilogies, mythos** ... a work of works, one shared bible, continuity that holds from book one to book seven. the lord of the rings, the silmarillion, harry potter ... tractable.
- **encyclopaedias** ... categories of cross-referenced articles, infobox plus prose, citations that become footnotes.
- **constructed languages** ... a lexicon and a grammar, where the word-coiner obeys your phonotactics because the rule lives in code, not in a prompt. a dictionary of a new language, end to end.
- **poetry** ... haiku, sonnet, villanelle, sestina, ghazal, epic. fixed forms with the meter and the rhyme checked, free verse where the lenses stay quiet.

## the two brains

both under your hand at all times, never the wheel.

- **the editorial sidekick** ... a lens layer that reads the way the x-ray already reads: descriptive first, a mirror never a verdict. deterministic where it can be (meter, rhyme, syllable count, name-variant drift, voice-drift stats), model-backed only where it must be (structure, continuity, fact-check, the volta). it produces findings. it never blocks. you gate.
- **the ai author** ... the generative voice. outline to prose, continue from here, a chapter from beats, an entry from sources, a word coined to rule, a line in a fixed form with the meter right. it writes AS you, through the same measured-voice slots the partner and ghost already fill, and it self-checks its own output for voice drift before it returns. nova's author gets more you the more you write, never more average. that is the antidote to the hollow-voice trap.

## the perfection loop (the umbrella)

a piece carries two axes. the publication axis you already have (draft, published, scheduled, archived) and a new craft axis: drafting, developmental, line, copy, proof, typeset, exported. forward is human-gated ... a stage's lens pass must be triaged before you climb. backward is always free, a kick-back that marks the downstream passes stale. the one automatic thing is staleness on read: revise chapter three and its line, copy, and proof passes visibly go stale, the same watermark the repurpose engine already uses. the loop is made legible. the x-ray's soul ... mirror, never verdict ... becomes a ladder you climb.

## the spine

slate json is the single source of truth. everything imports into it and exports out of it: word, google docs, markdown, scrivener in; docx, epub, print-grade pdf, latex out, through two hubs (html and markdown), never a tangle of one-off converters. the magazine `/p/[slug]` reading view is the web export already; the typeset stage extends it with real pagination into a vellum-grade pdf and epub, with zero second tool. where good permissive open-source exists, we lift it and give it the lunari treatment instead of hand-rolling it.

## the defensible center

a competitor can copy a corkboard or a story bible in a quarter. none of them can copy this: the ai sounds like you, across every form and every surface, because nova has the measured-voice substrate and the one-tree form model under it. voice fidelity times one form model times one lifecycle. that is the wedge.

## how it gets built

it is not a rewrite. it is five additive migrations and a stack of jsonb-seam conventions on top of what already ships. the editor, the renderer, and the provider boundary are extended, never replaced ... a prose leaf opens the existing plate editor verbatim, the x-ray becomes the structure lens, the command config grows an author config beside it. the road is staged so every step ships and leaves nova fully working:

0. **the keystone** ... the Work model, the node tree, the form registry, the import/export spine. (this is what phase 0 builds: the foundation everything hangs off.)
1. **prose works** ... the novel binder, the corkboard, work-scoped voice, docx and epub out.
2. **the editorial brain** ... the perfection loop made physical, the lens layer, the ladder.
3. **the ai author + poetry** ... outline-to-prose, the scaffold, the verse forms with live scansion.
4. **the world bible + continuity** ... the story graph, the contradiction checker, series at scale.
5. **the reference forms + multi-voice** ... the conlang coiner, the encyclopaedia, per-character voices.
6. **the typeset flagship** ... pagination, front and back matter, the print-grade export.

the room becomes the house.
