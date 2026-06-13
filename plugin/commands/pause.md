---
description: Pause Agora flashcards (focus mode) - hide the thinking-spinner / status-line cards during a long or deep-focus task. Resume with /agora:resume.
---

Pause Agora's flashcards. Run exactly this and show the user ONLY its output line:

```!
bun "$HOME/.agora/runtime/pause.mjs" pause 2>/dev/null || node "$HOME/.agora/runtime/pause.mjs" pause 2>/dev/null
```
