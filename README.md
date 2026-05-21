# nova press · lunari titan

the writing studio where AI matches your voice, not the other way around.

## first boot

```sh
# 1. install
pnpm install

# 2. copy env
cp .env.example .env.local
# (fill in keys from railway/lunari env)

# 3. dev
pnpm dev
```

open http://localhost:3000

## verify the scaffold

- http://localhost:3000 ... landing with nova wordmark + golden hour CTA
- http://localhost:3000/editor ... writing room with plate-shell stub + partner rail
- http://localhost:3000/p/example ... magazine reading view in IBM Plex Serif
- http://localhost:3000/api/health ... returns `{"ok":true,"product":"nova-press"}`

## claude code

```sh
# from this directory
claude

# install superpowers (one-time, global)
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# verify skills loaded
/skills

# kick off
/status
```

## what this is

nova press is the AI writing studio for serious creators. word-by-word voice fidelity, magazine-grade reading view, multi-platform distribution as a first-class output. the editor breathes, the AI partner is invisible until called, the published piece feels like print.

## structure

- `src/` ... product code
- `docs/` ... spec, architecture, roadmap, voice
- `.claude/` ... claude code instructions, hooks, skills, commands
- `CLAUDE.md` ... the project brain

## scripts

- `pnpm dev` ... dev server
- `pnpm build` ... production build
- `pnpm test` ... test suite
- `pnpm lint` ... eslint
- `pnpm format` ... prettier write
- `pnpm typecheck` ... tsc --noEmit

## next steps

read `docs/05-claude-code-handoff.md` for the first build chunk (week 1 · editor surface).

then run `/status` in claude code to see the current week, the next milestone, and any blockers.

## the rules (immutable)

- lowercase, no em-dashes, `...` for pauses, dom-voice always
- never push to main
- never commit `.env`, `.claude/settings.local.json`, `docs/voice-corpus.md`
- never bypass the voice-keeper skill warnings
- magazine reading view loads in under 200ms or it doesn't ship
