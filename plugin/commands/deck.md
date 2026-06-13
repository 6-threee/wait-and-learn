---
description: List your Agora decks or switch the active language (Pro unlocks more).
argument-hint: [language or deck name]
---

Your decks (or the result of switching) is below. Show the user ONLY that output,
verbatim, with no commentary. If it says no decks found, suggest running
`/agora:setup` first.

```!
bun "$HOME/.agora/runtime/deck.mjs" "$ARGUMENTS" 2>/dev/null || node "$HOME/.agora/runtime/deck.mjs" "$ARGUMENTS" 2>/dev/null
```
