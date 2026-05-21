# voice corpus · PLACEHOLDER

dom is compiling the voice corpus separately. when ready, it lands as `docs/voice-corpus.md` (gitignored) or as a folder `docs/voice-corpus/` with one sample per file.

until then, voice references come from:
- the voice rule section in `CLAUDE.md`
- `.claude/skills/voice-keeper/SKILL.md`
- the NOVA agent voice notes in `docs/02-design-system.md`

claude code should default to dom's casual, lowercase, em-dash-free register and check with the sub-chat for any user-facing copy.

## corpus shape (when it lands)

each sample as a markdown file with front-matter:
```yaml
---
title: "..."
date: 2026-01-15
medium: "personal newsletter | linkedin | journal | tweet thread | voice memo transcript"
length: 1240
voice-flags: ["meditative", "first-person", "analytical"]
---
```
then the raw text.

target: 10-20 samples ≈ 5-15K words total. more dilutes the signal.

## what nova uses it for
1. embedding via voyage-3-large at 1024d, stored in `voice_embeddings` with HNSW cosine index
2. centroid computation per user, stored on `voice_profiles.centroid`
3. compact view (~120 tokens) handcrafted by computing metrics: avg sentence length, lowercase ratio, em-dash policy, ellipsis density, signature phrases, opener patterns, closer patterns
4. top-3 retrieval per AI invocation, injected as exemplars in the system prompt

## privacy
the corpus is gitignored. it never goes near the model training pipeline. it's only used for in-context retrieval and metric computation server-side.
