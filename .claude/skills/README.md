# skills

claude code reads each skill's frontmatter and decides when to load the body.

## universal (shared across all lunari titans)
- **voice-keeper** ... fires on copy, markdown, UI strings, error messages. enforces lowercase + no em-dashes + dom voice
- **lunari-design-tokens** ... fires on UI work. enforces lunari color tokens, the 4px rhythm, fonts, shadcn-first
- **ship-discipline** ... fires on non-trivial implementation. plan → test → implement → review → commit loop

## nova-specific
- **voice-mirror** ... fires on AI partner work. enforces voice-matched suggestions, single-sentence default, voice-keeper audit before user-visible output
- **plate-editor** ... fires on editor work. plate plugin patterns, slash menu architecture, typewriter mode, focus mode, AI panel mount point
- **reading-view** ... fires on the published piece view. magazine typography rules: 65ch max width, 1.7 line height, IBM Plex Serif 18px body, drop caps optional, no sidebars, generous vertical rhythm

## adding a new skill
create `<name>/SKILL.md` with frontmatter:
```yaml
---
name: <name>
description: <what it does, when it fires, what file patterns trigger it>
---
```
then the body in markdown. keep each skill tight ... if it grows past one screen, split it.
