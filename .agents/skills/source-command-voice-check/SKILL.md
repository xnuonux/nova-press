---
name: "source-command-voice-check"
description: "Audit current changes for voice drift"
---

# source-command-voice-check

Use this skill when the user asks to run the migrated source command `voice-check`.

## Command Template

audit all uncommitted changes for voice violations:

1. run `git diff` to see what changed
2. scan for em-dashes (—), en-dashes (–), AI marketing words, corporate softeners
3. scan for capital-case starts that should be lowercase
4. scan for preamble or apology language ("I think", "I'd suggest", "perhaps")
5. produce a report with `file:line` and the suggested rewrite
6. on approval, apply the rewrites
