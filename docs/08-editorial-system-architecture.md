# nova press · the mythos · editorial system architecture

> the definitive, buildable architecture for the complete standalone nova press. voice held to house rules (lowercase, no em-dashes). everything is additive on nova's own `v0.x` track, atlas four-policy RLS on `auth.uid()=user_id`, reusing `public.tg_set_updated_at()`. the vision is `docs/07-mythos-vision.md`. produced from a three-architect design panel + an open-source + prior-art research sweep, fused.

the whole thing is **five additive migrations and a stack of jsonb-seam conventions** on top of what already ships. the editor (`plate-shell.tsx`), the renderer (`piece-body.tsx` + `piece-blocks.ts`), and the provider boundary (`provider.ts`) are extended, never rewritten.

---

## the migration ladder

| migration                   | adds                                                                         | phase     |
| --------------------------- | ---------------------------------------------------------------------------- | --------- |
| `v0_7_0_np_works.sql`       | `np_works` + `np_nodes` + `np_links` + additive `np_pieces` columns          | 0 (built) |
| `v0_8_0_np_editorial.sql`   | `editorial_stage` + `np_editorial_passes` (the perfection loop)              | 2         |
| `v0_9_0_np_bible.sql`       | `np_bible_entity` + `np_text_anchor` + `np_bible_fact` + `np_bible_relation` | 4         |
| `v0_10_0_np_continuity.sql` | `np_continuity_scan` + `np_continuity_flag`                                  | 4         |
| `v0_11_0_np_voices.sql`     | `np_voices` + `np_voice_snapshots.voice_id`                                  | 5         |

specialized forms (conlang, encyclopaedia, poetry) add **zero migrations**: they are record-leaves, code registries, block types, and lens engines.

---

## 1 · the unified Work / structure-tree model + the form registry

the spine is a universal `np_nodes` tree. a leaf carries one of four payloads, discriminated by which slot is filled (`shapeOf` in `src/types/works.ts`):

- **prose / verse** ... `piece_id` to `np_pieces` (the existing editor, untouched).
- **record** ... `record` jsonb (a lexeme, an infobox, a character sheet), GIN-indexed.
- **work_ref** ... `child_work_id` to `np_works` (a series volume).
- **container** ... none of the above (a part, a folder).

a node holding both a `piece_id` and a non-empty `record` is exactly an encyclopaedia article: infobox plus prose (`record_prose`).

**the resolution that makes this work:** typed records live in the node's `record` jsonb, validated in the app against the registry's `recordSchema`, not in per-form tables. so conlang, encyclopaedia, and poetry need **zero dedicated tables**. the structure spine stays **plain-uuid** (the `np_subscriber.piece_id` convention): `work_id`, `parent_id`, `piece_id` are not FK constraints, so `pg_dump --table='np_*'` captures the whole graph and the standalone exit ramp stays clean, and reorder / renest is app-managed anyway. (the one place we use real intra-nova FK cascades is the bible, section 3, where dangling edges would corrupt the one thing the module protects.)

**the form registry** (`src/lib/forms/registry.ts`) is the only place form knowledge lives. a `FormProfile` (`src/lib/forms/types.ts`) sets: the tree (`rootType` + `levels` of `{nodeType, allowedChildTypes}` + `maxDepth`), the leaf (`prose | verse | record | record_prose` + `pieceKind` + an optional `recordSchema`), the advisory `constraints` (craft lenses, not db checks), the `exports`, and an optional `skeleton` scaffolded at creation. adding a form is one object literal. phase 0 ships fifteen profiles across all five families (prose, poem, reference, collection, script). every form maps onto the one tree:

- **haiku / sonnet** = one verse leaf + a constraint lens (5-7-5; 14 lines, a volta, iambic pentameter).
- **essay / newsletter / article** = today's standalone piece, optionally wrapped in a one-leaf Work.
- **novel** = manuscript, part, chapter, scene.
- **series / silmarillion** = a Work-of-Works (`parent_work_id`) or deep nesting.
- **encyclopaedia** = category, article (`record_prose`).
- **conlang** = language, {lexicon, lexeme (record)} + {grammar, chapter (prose)}.

**helpers (no FK cascade to lean on):** one ordered `with recursive tree ... order by sort_path` fetch feeds the binder, restitched client-side exactly like `groupBodyBlocks`; subtree word-count rollup bubbles leaf deltas up the `parent_id` chain in the autosave action; subtree delete is a recursive-CTE delete in a transaction, then null the freed pieces' `node_id` / `work_id`.

**how it extends the existing seams:** a prose / verse leaf opens **`plate-shell.tsx` verbatim** on `node.pieceId` (ghost text, bubble toolbar, slash menu, blur-rise, the partner rail all just work, because a leaf is a piece). `coercePlateValue` (total-over-garbage) means record-leaf editors and new block types degrade safely. voice extraction goes work-scoped for free (`listPieceTextsForUser` filtered by `np_pieces.work_id`). repurpose extends to work level.

**api surface** (new `src/lib/db/works.ts` + `nodes.ts` + `links.ts`, mirroring `pieces.ts`): `createWork(formProfile)` (seeds the skeleton), `getWorkTree(workId)` (the CTE), `createNode / moveNode / renestNode` (app-validated vs `canNest`), `promotePieceToWork(pieceId)` (wraps a standalone piece in a one-leaf Work ... the zero-friction on-ramp), `resolveLinks` + `backlinks`. routes: `/work/[id]` (the binder) beside the untouched `/library`; work-level publish reuses the service-role read at `/w/[slug]`.

---

## 2 · the editorial brain ... sidekick + author + the perfection loop

**the craft axis** (`v0_8_0`): `np_pieces.editorial_stage` (drafting, developmental, line, copy, proof, typeset, exported) + `np_editorial_passes` (a stage's `findings` jsonb + `source_edited_at`, the staleness watermark). forward gated, backward free, staleness automatic (a pass is stale iff `last_edited_at > source_edited_at`, the `np_repurpose_outputs` watermark). a work's stage = `min` over its pieces, derived on read (you cannot ship the book until every chapter clears proof). the transition log is a trimmed jsonb seam on `metadata.editorial.history`. while here, **fix the `PieceStatus` drift** (`src/types/index.ts` lists `editing` / `unpublished` the DB CHECK rejects) ... that "editing" state actually belongs on the new craft axis.

**the lens layer** is the unifying abstraction: form constraints, continuity flags, and the existing x-ray are all instances of one shape ... `type Lens = (input) => Finding[]`, where a `Finding` is descriptive-first, lowercase, voice-keeper'd, scoped to a block / range / piece, severity `note | flag`, never `error`. **deterministic lenses are the spine** (exact, free, unit-testable like `voice-stats.ts`): mechanical (double spaces, straight quotes, heading jumps, broken links), readability against the writer's OWN voice baseline (never a generic grade), voice-drift (`extractVoiceStats(span)` diffed against the resolved voice's snapshot), meter / rhyme / form-shape. **model lenses degrade to `[]`** and defend the soul in the parse, not the prompt (validated enums, range-checked indices, the message derived from endpoints): structure (`xray.ts` promoted as-is), continuity, fact-check, the volta.

**the ai author** extends the config map beside `COMMAND_CONFIG`, never overloads it: `AUTHOR_CONFIG: Record<AuthorTask, ...>` for `outline | expand | continue_long | chapter | entry | coin | verse`. `prompts/author-prompt.ts` keeps `buildPartnerPrompt`'s exact block order (identity + voice rules + resolved compact voice + forbidden preamble + exemplars + task) plus one constraint block (the form spec / the bible facts for the POV character / verbatim sources / the phonotactic grammar / the beats). the **repair loop** generalizes `runPartnerCommand`'s cooler-retry: a metrical fault or an illegal cluster caught by a _deterministic_ checker triggers a regenerate-only-the-bad-line, N tries, then best-with-a-flag. the constraint is defended in code, never trusted from the model. **every author generation self-audits its output with the voice-drift lens before returning** ... a drifting rewrite triggers the cooler retry. this makes "preserve the user's voice signature" actually enforceable. it is the hollow-voice antidote, mechanized.

**routes** (reusing the auth-gate + rate-limit + cap + provider-boundary skeleton): `POST /api/ai/author`, `POST /api/ai/editor/lens`, `POST /api/ai/editor/pass`. `/api/ai/xray` folds in as the `structure` lens.

**the rag seam, honest:** `entry` / `continuity` take `sources: string[]` from the client today (paste + cross-referenced nodes + retrieval-by-mention from the text anchors). when the designed-but-unbuilt `np_voice_corpus_*` embedding triad ships, it swaps client sources for retrieved sources into the _same_ slot. correctness never depended on vectors.

**ui** (beside `plate-shell.tsx`): a slim ladder stepper (the current stage lit in `--nova-accent`, a staleness dot on a downstream stage behind the watermark); a right-rail pass panel (accept / dismiss / jump per finding, the gate button disabled until every finding is triaged); live deterministic findings in the left margin via the proven `xray-spine` overlay (snapshot, self-dismiss on `beforeinput`, never a plate decoration ... it dodges the normalization trap); `expand from here` / `draft this beat` in the slash menu; a scaffold view (an outline piece where each beat streams a section into the manuscript).

---

## 3 · the world bible + continuity + specialized forms

**the deliberate divergence (owned):** the bible graph uses **real intra-nova FKs with `ON DELETE CASCADE`** between np* tables (entity, fact, anchor, relation). this is the one place the plain-uuid convention is broken on purpose ... these are not cross-product FKs (the substrate permits intra-nova FKs), `pg_dump --table='np*\*'` still captures both ends, and dangling graph edges silently corrupt continuity-checking, which is the entire point. integrity wins where integrity is the product.

**`v0_9_0_np_bible.sql`:** `np_bible_entity` (canonical_name + `aka[]` + `attributes` cache + a `canonical_node_id` bridge to the tree, trigram-indexed), `np_text_anchor` (the inverted index: `{piece, block, char range, exact quote}` that re-locks on edit, `entity_id` null = an unresolved mention), `np_bible_fact` (atomic checkable assertions: predicate + value + a story-time `valid_from / valid_until` window so a fact can legitimately CHANGE, + `source_anchor_id`), `np_bible_relation` (entity to entity edges for graph traversal). requires `pg_trgm` (check `list_extensions` first).

**`v0_10_0_np_continuity.sql`:** `np_continuity_scan` (the resumable two-phase job cloning `np_newsletter_dispatch`: a `body_hash` per piece skips unchanged chapters, a `scan_token` gives resumability with no TOCTOU) + `np_continuity_flag` (severity `info | warn`, never `error`; the `message` DERIVED from the two facts, never model prose; `computed_against_hash / _edited_at` for staleness on read).

**continuity is two layers, and the split is the whole trick** (it mirrors `extractVoiceProfile`: deterministic stats carry the load, the model degrades to deterministic-only, never a 500):

- **layer 1, deterministic, never wrong:** _fact collision_ (a pure self-join on `(entity_id, predicate)` with overlapping valid-time and different values, both canon, message built in code from the two `(value, anchor)` pairs), _timeline violation_ (a mention before birth / after death), _undefined entity_ (a mention left unresolved), _name variant_ (a surface that trigram-matches a name but is not an exact alias ... the nazgûl / nazgul drift, the conlang romanization drift), _orphan fact_ (an anchor quote that no longer rematches).
- **layer 2, model, xray-shaped, only on changed text:** returns strict json referencing _existing fact ids only_; the hardened parser drops any conflict not pointing at two real facts plus a valid anchor, then writes the message from those facts. the model proposes the semantic contradiction sql cannot see; nova validates and phrases it.

**the canonical loop:** author writes "luna's eyes were brown" -> autosave settles -> an incremental piece scan enqueues (body_hash gate) -> the model extracts `{entity:'luna', predicate:'eye_color', value:'brown', quote}` -> resolve "luna" exact-then-trigram -> a deterministic compare finds `{blue, book1ch2, canon}` overlapping valid-time -> write a `contradiction`, message derived: "eye_color: blue (book 1, ch.2) vs brown (here)" -> surfaces in the in-editor continuity rail (a pure-DOM overlay off the "brown" anchor) and the work's flags inbox -> author resolves four ways: fix the text, declare a retcon (the windows no longer overlap, the checker goes quiet), add a conditional qualifier, or dismiss. scope `work` = a resumable full bible-build; scope `series` = every book against the shared bible.

**the ai author stays consistent via retrieval-by-mention** (no embeddings needed for correctness): the author route gains a bible slot ... for entities mentioned near the cursor (a join over `np_text_anchor` by block proximity), pull their active facts into the prompt. ask for the next paragraph about luna and it already knows her eyes are blue.

**specialized forms, all zero-migration:**

- **conlang** (`form_profile='conlang'`): a lexeme is a record-leaf (`{headword, ipa, romanization, partOfSpeech, etymology, senses[]}`), and optionally a `np_bible_entity(entity_type='lexeme')` so the continuity checker covers the language (undefined word, misspelled word) for free. phonology and grammar live as a **code registry keyed by `np_works.settings`**: phoneme inventory, syllable template `(C)V(C)`, forbidden clusters, stress rule, grapheme map, affix paradigms. **the word-coiner OBEYS the rules because the constraint lives in code, not the prompt** ... a deterministic generator builds candidate syllables from the inventory (pure, unit-testable); the model only glosses them. a coined word cannot emit an illegal cluster. cognates are `np_links(relation='cognate_of')`.
- **encyclopaedia**: an article = a `record_prose` node. `[[xref]]` = a new inline plate node `type:'xref'` (one more case in `renderInline`, which already special-cases `'a'`), rendering a link AND writing a `np_links` row. backlinks = the link-target query. citations become footnotes / sidenotes using the **exact `groupBodyBlocks` restitch** (markers in flow, definitions gathered at the end; wide screens float them as sidenotes, print drops them to footnotes via the existing `@media print` block). the A-Z index is a generated back-matter query.
- **poetry**: the cheapest module. lineation = new plate block types `verse_line` grouped into `stanza` via the **same flat-block restitch as `ul_li` / `ol_li`** (`groupBodyBlocks` gains one branch). scansion = a deterministic engine (syllabify + a cmudict-style stress table + a rules fallback). rhyme = a phonetic rhyme-key readout. fixed forms = a code registry (these `FormConstraint`s already live in `src/lib/forms/registry.ts`). the form checker is the continuity checker for poems (`flag_kind='form_violation'`, descriptive: "line 3 has 6 syllables, haiku wants 5"). these engines double as the author's `verse` / `coin` repair-loop verifiers.

**multi-voice at scale** (`v0_11_0`): `np_voices { kind: author|narrator|character|persona, base_voice_id?, overrides }` + `np_voice_snapshots.voice_id`. `getWriterVoice` generalizes to `resolveVoice`: null = the author base (the live `voice_profiles` row, unchanged); an extracted voice = its latest snapshot; **a delta voice = a base + folded overrides** (gollum = a register shift off the narrator, no corpus needed). every prompt builder takes the same `{voiceCompactView, exemplars}` shape unchanged. per-span selection: a narrator default on the piece + a plate inline `voiceId` tag on a dialogue span; the author route threads `speakerVoiceId`, the voice-drift lens audits that span against THAT character's snapshot. "gandalf is drifting toward gollum's register" ... zero new storage, the longitudinal snapshot is the drift baseline.

---

## 4 · the import / export + typography spine

**slate json is the single source of truth.** two universal hubs, never N×M converters: an **HTML hub** (plate `serializeHtml` out, the html-deserialize plugin + `@platejs/docx` in) for docx / epub / pdf; a **markdown hub** (`@platejs/markdown`, bidirectional) for md / gdocs / txt.

- **in:** docx -> `mammoth` -> clean html -> plate deserialize -> slate; paste-from-word -> `@platejs/docx`; md / txt -> `@platejs/markdown`; gdoc -> drive api export-to-docx -> mammoth; scriv -> `fast-xml-parser` (binder) + `rtf-parser` (per-doc), isolated and deferred (highest risk). a scrivener import is lossless precisely because the structure model can hold its tree.
- **out:** slate -> `serializeHtml` -> { `pagedjs` + `puppeteer` = print-pdf · `@lesjoursfr/html-to-epub` = epub · `@turbodocx/html-to-docx` = quick docx } · slate -> `docx` builder = high-fidelity docx · slate -> `@platejs/markdown` = md / txt.

**the typeset stage IS the magazine view, paginated.** the flagship export feeds the same `/p/[slug]` reading-view html + print stylesheet to **paged.js** (real pagination, running headers, widows / orphans, page-break control) rendered to pdf by headless **puppeteer** (`@sparticuz/chromium` on serverless). so the pdf is the magazine view ... vellum-grade with zero second tool. footnotes / TOC / front-and-back matter are additive render cases on the proven "one block type = one render case + one plugin" seam.

**typography pass, export html only** (never the live buffer): `retext-smartypants` with **`dashes:false`** (smartypants emits em-dashes by default; the voice rule forbids them, so disable and post-strip) + `hyphen` (soft hyphens) + a small `&nbsp;`-before-last-word widow pass. the canonical slate json and the editor stay clean.

---

## 5 · the lift list (MIT / Apache / BSD / ISC only, all routed through slate json)

install in this order, ranked by value-per-effort. no GPL anywhere.

1. `@platejs/markdown` (MIT) ... md both ways + plaintext + the gdocs-md path. ship first.
2. `mammoth` (BSD-2) + `@platejs/docx` (MIT) ... docx import.
3. `docx` (MIT) ... high-fidelity docx export. `@turbodocx/html-to-docx` (MIT) as the quick v1.
4. `pagedjs` (MIT) + `puppeteer` (Apache-2.0) + `@sparticuz/chromium` ... the flagship typeset pdf.
5. `@lesjoursfr/html-to-epub` (MIT), or `epub-gen-memory` (MIT) for serverless.
6. `retext-smartypants` (MIT, `dashes:false`) + `hyphen` (ISC) ... export typography.
7. `googleapis` (MIT) ... google docs via drive export-to-docx.
8. `fast-xml-parser` (MIT) + `rtf-parser` (ISC) ... scrivener, isolated, last (rtf-parser is stale, high risk, not v1).

the runtime engines that are **pure code, not packages** (unit-tested like `voice-stats.ts`): the syllabifier / scansion table, the rhyme-key extractor, the phonotactic syllable generator, the meter checker. **avoid:** `html-docx-js` (dead), original `html-to-docx` (stale), `epub-gen` (disk writes), `hypher` (stale), any LibreOffice / unoconv subprocess (heavy, copyleft).

---

## 6 · the build roadmap

each phase ships and leaves nova fully working. the loop tightens stage by stage: structure, then editing, then authoring, then consistency, then form depth, then typeset.

- **phase 0 ... the keystone (this branch).** `v0_7_0_np_works.sql`; `src/types/works.ts`; `src/lib/forms/registry.ts` + `constraints.ts`; then `src/lib/db/works.ts` + `nodes.ts` + `links.ts`; the import/export keystone (`@platejs/markdown`, `POST /api/import` + `/api/export`); the binder rail at `/work/[id]`. ship gate: a writer wraps a standalone piece in a Work, sees it in the binder, imports a markdown file, exports it back. every existing flow still works.
- **phase 1 ... prose works.** the novel / series binder + corkboard + chapter word-targets + subtree rollup; work-scoped voice extraction; work-level reading at `/w/[slug]`; docx + epub out.
- **phase 2 ... the editorial brain.** `v0_8_0`; the `Finding` / `Lens` layer (deterministic first, then promote `xray.ts`); the state machine + the ladder + the pass panel.
- **phase 3 ... the ai author + poetry.** `AUTHOR_CONFIG`, `src/lib/ai/author.ts`, `prompts/author-prompt.ts`, `POST /api/ai/author`, the scaffold; poetry lands with zero migration (the verse blocks + the scansion lenses + the repair loop). haiku to sonnet alive.
- **phase 4 ... world bible + continuity + series.** `v0_9_0` + `v0_10_0`; the deterministic continuity layer then the model layer; the codex + the continuity rail + the flags inbox; retrieval-by-mention; series as a Work-of-Works. the silmarillion becomes tractable.
- **phase 5 ... reference forms + multi-voice.** conlang (the constrained coiner + the lexicon + the phonology registry) and encyclopaedia (infobox + xref + citations + the A-Z index), zero migration; `v0_11_0` (the voice registry + delta-voices + per-span tagging + drift-gated generation).
- **phase 6 ... the typeset flagship + cleanup.** the typeset stage on paged.js + puppeteer; front and back matter; the typography pass; and the orthogonal fix the inventory flagged: finish the scheduled-publish worker (the `pg-boss` dep + the partial index exist, no worker runs). scrivener import lands here last.
