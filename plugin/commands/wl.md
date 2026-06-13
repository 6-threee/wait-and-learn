---
description: Grade the flashcard currently shown in the Wait & Learn status line.
argument-hint: got | missed
---

The Wait & Learn grader for the current flashcard (`got` = knew it, `missed` =
didn't) ran automatically; its one-line result is below. Show the user ONLY that
line, verbatim, with no commentary. If it is empty or reports no current card or
a missing runtime, relay that and suggest running `/wait-and-learn:setup` first.

```!
bun "$HOME/.wait-and-learn/runtime/grade.mjs" "$ARGUMENTS" 2>/dev/null || node "$HOME/.wait-and-learn/runtime/grade.mjs" "$ARGUMENTS" 2>/dev/null
```
