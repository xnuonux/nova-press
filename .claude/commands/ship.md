---
description: Run the plan-test-implement-review-commit loop for the current task
---

run the ship-discipline workflow for the task: $ARGUMENTS

1. read `CLAUDE.md` and `docs/00-product-spec.md` if not already in context
2. write a plan in chat covering files, data shape, test cases, risks
3. wait for explicit go-ahead
4. write the failing test first
5. write the minimal implementation
6. self-review the diff against the spec and voice rules
7. propose a conventional commit message
8. commit only after explicit approval
