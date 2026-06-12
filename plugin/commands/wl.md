---
description: Grade the flashcard currently shown in the Wait & Learn status line.
argument-hint: got | missed
---

The user is grading the language flashcard currently shown in their Claude Code
status line. `got` = they knew it (show it less); `missed` = they didn't (show it
more). It feeds the same spaced-repetition state the status line reads.

Run exactly this and show ONLY its one-line output (try bun, fall back to node):

```bash
bun "$HOME/.wait-and-learn/runtime/grade.mjs" $ARGUMENTS 2>/dev/null || node "$HOME/.wait-and-learn/runtime/grade.mjs" $ARGUMENTS
```

Do not add commentary. If the output says no current card or the runtime is
missing, relay that and suggest running `/wait-and-learn:setup` first.
