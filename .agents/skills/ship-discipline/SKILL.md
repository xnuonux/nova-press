---
name: ship-discipline
description: Plan before code, write tests first, review before commit. Use when implementing any feature, fixing any non-trivial bug, refactoring any module, or building anything that ships to users. Pairs with the /ship slash command.
---

# ship-discipline

the move that separates a chaos demo from a shipped product is the discipline of the loop.

## the loop (always)

1. **PLAN** ... before touching code, write the plan in chat: what files, what data shape, what test, what risk. show it to dom or sub-chat before moving
2. **TEST FIRST** ... write the failing test before the implementation. if you can't write the test, the spec is unclear, go back to step 1
3. **MINIMAL IMPLEMENTATION** ... write the smallest code that makes the test pass. no flourishes
4. **REVIEW** ... read the diff yourself. would dom approve? does it match the spec? are there leaks (console.logs, TODOs, dead code, commented-out blocks)?
5. **COMMIT** ... conventional commit message. lowercase. no em-dashes. body explains WHY not what

## when to skip the loop

- one-line typo fix
- pure config bump
- documentation-only change

everything else uses `/ship`.

## the planning trap

if a task takes more than 30 minutes of planning, the scope is wrong. break it down. escalate.

## the test trap

if a test takes longer to write than the feature, the architecture is wrong. don't ship the test. talk to the sub-chat.

## the review trap

if a diff is longer than 400 lines, break it into multiple commits. Codex is bad at reviewing long diffs and so are humans.
