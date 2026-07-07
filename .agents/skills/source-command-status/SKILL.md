---
name: "source-command-status"
description: "Print current product state, what's done, what's next"
---

# source-command-status

Use this skill when the user asks to run the migrated source command `status`.

## Command Template

print a status snapshot:

1. current git branch
2. uncommitted file count
3. last 5 commits (one line each)
4. test suite status (`pnpm test --silent`)
5. read `docs/04-roadmap.md` and identify the current week and next milestone
6. flag any blockers from `docs/` or commits labeled WIP or FIXME
