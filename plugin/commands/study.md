---
description: Open an Agora flashcard study session (spaced-repetition review) in a NEW terminal window, so studying never mixes with this work chat. macOS Terminal.app.
---

Open the Agora review loop in a NEW Terminal.app window so it stays out of this
work session. Run exactly this command and tell the user ONLY whether it opened
(one short line), nothing else:

```!
osascript -e 'tell application "Terminal" to do script "$HOME/.agora/agora review"' >/dev/null 2>&1 && echo "Opened an Agora study window. Click into it: Enter = reveal, g/m/s = grade/skip, q = quit. This session stays clean." || echo "Could not open a window automatically (grant Terminal automation access, or open a new terminal with Cmd+N and run: agora review)."
```
