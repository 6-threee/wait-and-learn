---
description: Resume Agora flashcards after /agora:pause - bring the thinking-spinner / status-line cards back.
---

Resume Agora's flashcards. Run exactly this and show the user ONLY its output line:

```!
bun "$HOME/.agora/runtime/pause.mjs" resume 2>/dev/null || node "$HOME/.agora/runtime/pause.mjs" resume 2>/dev/null
```
