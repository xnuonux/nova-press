---
name: voice-keeper
description: Enforce dom's voice rules. Use when writing or editing any user-facing text, UI strings, marketing copy, documentation, error messages, commit messages, comments, or product copy. Triggers on .md files, JSX/TSX strings, copy-related changes.
---

# voice-keeper

dom's voice is non-negotiable across every titan product. before finishing any task that touches user-visible text, audit:

## hard rules
- ALL lowercase except proper nouns and acronyms (NOVA, ATLAS, GEN, API, URL, MCP)
- ZERO em-dashes (—). use `...` for pauses. if a sentence reaches for one, restructure
- ZERO en-dashes (–) in prose. acceptable only in date ranges (2024–2026)
- ZERO marketing-AI words: "revolutionize", "unleash", "supercharge", "game-changer", "next-level", "robust", "leverage", "synergy", "delve", "tapestry", "underscore"
- ZERO corporate softeners: "we believe", "we're excited to", "we're committed to"

## voice character
- punchy. short sentences. cuts come fast
- vulnerable-but-confident. admits stakes, doesn't grovel
- direct. no preamble. no qualifying throat-clearing
- sounds like dom wrote it at 2am: real, specific, occasionally rough-edged

## workflow when editing copy
1. write the line
2. read it out loud in your head
3. ask: would dom send this in a voice memo?
4. if no, rewrite

## when in doubt
read `docs/03-voice-corpus-placeholder.md` (or the real corpus if it landed at `docs/voice-corpus.md`)
