# nova press

> the writing studio for serious creators. written by the one who built it,
> 2026-07-05, the night the ladder closed.

## what it is

nova press is a place where writing is treated as craft and the finished
thing is treated as an artifact. one surface holds the whole life of a work:
the first sentence typed into a quiet page, the structure it grows into, the
editing passes that tighten it, the world it has to stay consistent with,
and the moment it leaves ... as a public page that reads like a magazine, as
an epub, as a word file, or as a typeset pdf with running heads and folios
that would not embarrass a print shop.

every other tool makes you choose. the ai writing apps auto-complete you out
of your own voice until everything sounds like the same beige assistant. the
databases-with-editors treat prose as rows. the manuscript tools stop at the
manuscript. nova's wedge is the refusal to choose: **word-by-word voice
fidelity, a magazine-grade reading experience, and the whole
import-to-artifact pipeline in one place.**

the deepest rule, the one every feature was tested against: **the ai mirrors
the writer, it never overwrites them.** nova learns how you write ... your
sentence rhythm, your vocabulary, your openings, the phrases you'd never use
... and everything it generates is anchored to that. it whispers one
sentence, not three paragraphs. it flags, it never fixes without being
asked. it knows when to shut up so you can flow.

## who it's for

- **the novelist** ... a binder that scales from a short story to a trilogy
  (acts, chapters, scenes on one tree), a corkboard with synopses and word
  targets, per-scene word counts rolling up live, a world bible the prose is
  checked against, and at the end: a real book, typeset.
- **the poet** ... verse as a first-class block that keeps its line breaks
  everywhere (editor, reading view, epub, print), scansion and rhyme lenses
  that read a poem against ITS OWN established form and stay silent on free
  verse, and a coin command that writes one line in the poem's measure.
- **the worldbuilder** ... a codex of characters, places, factions, and
  lore; a continuity scan that catches a misspelled name or an unintroduced
  recurring character; series that share one bible across volumes; an
  encyclopaedia form with infoboxes, cross-references, and citations; a
  conlang form whose word-coiner literally cannot break your phonology.
- **the essayist and newsletter writer** ... a clean drafting page, a
  published view that loads fast and looks expensive, subscriber capture, a
  newsletter blast, and a repurpose engine that turns one piece into a
  thread or a post without losing the voice.
- **anyone shipping on a rhythm** ... publish now, or "later ..." at a
  chosen hour while you sleep; every export leaves a receipt.

it is NOT for teams (no comments, no multi-cursor, v1 is a room for one),
and it is not a content farm ... nova will not write your book for you. it
will help you write yours.

## how it works, room by room

### the page

the editor is plate (slate) with the classics done right: tab indents,
smart quotes curl as you type with a direction rule that knows an apostrophe
from an opening quote, emoji and a slash menu, a selection toolbar, and a
blur-rise on the words as they land. focus mode drops the chrome; typewriter
mode keeps your line centered. the voice rule is enforced at the keyboard:
there is no em-dash autoformat, pauses are "..." and stay that way.
autosave is the only version control v1 needs, and every save rolls word
counts up the binder tree.

### the partner

nova the muse lives in a rail beside the page and in the whisper layer on
it. **ghost text** streams exactly one sentence at a natural pause, in your
voice, tab to accept, any edit to dismiss ... a pure dom overlay, so it can
never corrupt the document. the **slash commands** summon the author:
`/expand` a beat, `/draft this beat`, `/outline`, `/coin` a verse line ...
each stops at one paragraph (or one line) by hard construction, never
running past what you asked. the **partner rail** is a streaming
conversation for sparring ... hand nova a line, get one riposte, in-world
when the work has a bible. every model boundary is rate-limited, defended
by a parser, and degrades to silence rather than crashing the page.

### the voice

voice is data, not vibes. nova extracts a profile from your actual prose
(library-wide or trained on one work): average sentence length and its
variance, register, vocabulary signature, opening and closing patterns,
avoided phrases, punctuation habits. that profile is the anchor for
everything generated. a work can then hold a **cast**: named delta voices
("the detective", "the ferryman") that overlay the narrator SPARSELY ...
only the fields they set diverge, and a drift gate sheds overrides until
the writer's own hand still shows through. describe a voice in plain
language and nova drafts the overlay; the meter shows how far it pushes
from you.

### the shape

a **work** is a tree ... the universal np_nodes spine holds every form the
registry knows: novel, short story, prose, essay, haiku, sonnet,
encyclopaedia, conlang, series-of-books. containers are acts and chapters;
leaves are pieces that open in the same editor as everything else. the
binder shows the tree with corkboard cards (synopsis, live subtree count,
a word target with a quiet golden meter). a piece can be promoted into a
work; a work can sit inside a series and share the parent's bible. forms
that need records ride the same tree: a lexeme is a record-leaf, an
encyclopaedia article is a record WITH prose.

### the editorial brain

the craft has a ladder: drafting, developmental, line, copy, proof,
typeset, exported. each rung runs **lenses** ... deterministic ones
(mechanical slips, sentence length against YOUR OWN baseline, voice drift)
and one model lens (structure). every finding is a **descriptive mirror,
never a verdict**: "this sentence runs 41 words against your usual 14," not
"shorten this." you accept or dismiss each flag; the gate to the next rung
opens only when the pass is current and triaged. you can fall back down the
ladder for free ... a copy-edit that reveals a structural hole should.

### the world bible and the continuity rail

the codex holds the nouns of your world ... six kinds, with aliases and
facts. the continuity scan reads the prose against it: a deterministic pass
catches name drift ("Marrik" three chapters after "marik") and recurring
strangers the bible doesn't know; a model pass looks for contradiction and
timeline slips, and degrades to nothing without a model. flags triage like
editorial findings, a dismissed concern never re-raises, and an
"unintroduced" flag offers to draft its own codex entry. when nova writes a
beat, it retrieves only the cast the beat actually mentions ... the bible
grounds the generation without drowning the prompt.

### the way out

publishing is one button, or one scheduled hour. a piece lives at
`/p/[slug]`, a whole work at `/w/[slug]` with a contents page ... both
magazine-grade, both gated so a draft can never leak. the worker sweep
publishes due pieces on the minute and walks back anything that can no
longer ship. exports: markdown, docx (piece or work), epub with breadcrumb
chapters, and the flagship ... **the typesetter**, which sets the whole
work into a print pdf on pagedjs and headless chromium: half title, title
page, copyright, a contents whose numbers match the printed folios, running
heads from the live chapter title, justified prose with soft hyphens and
widow guards, curled quotes, verse held intact, real ibm plex serif
embedded. imports: markdown, docx, and a zipped scrivener project whose
binder becomes a real work with its prose intact. every export writes a
quiet receipt the panel shows as "lately: pdf · jul 5".

### the ground it stands on

nova lives in eternities' shared lunari substrate ... one database, one
auth, one voice-profile table with strict column ownership. every nova
table wears `np_`, is owner-scoped by RLS, and the whole product can be
lifted out with one pg_dump if it ever needs to stand alone. it shares the
company's model keys, so integration day is a merge, not a migration.

## the principles, since they explain every decision

1. **the voice is the load-bearing wall.** everything generated is anchored
   to the writer's measured voice; overlays are drift-gated; the ai stops
   at one sentence unless asked.
2. **mirrors, never verdicts.** the editorial system describes what is,
   in your own terms, and lets you decide.
3. **the deterministic spine first.** every feature has a pure, exact,
   hard-tested core; the model proposes within those rails and a
   deterministic fallback guarantees an answer with no model at all.
4. **degrade, never crash.** a failed read is an empty list, a missing
   chromium is a friendly 503, a failed receipt never fails the export.
   the writer's words are never hostage to plumbing.
5. **the artifact should feel expensive.** the reading view, the epub, the
   typeset page ... the finished thing is the point of all of it.

## by the numbers

twelve migrations (v0_1_0 through v0_12_0, all live). seven phases, built
spine-first and adversarially reviewed fire by fire. 801 tests green. one
voice rule, never broken: no em-dashes, ever ... pauses are "..." and the
sentence breathes.

nova press: golden hour for the words. the muse that knows when to shut up.
