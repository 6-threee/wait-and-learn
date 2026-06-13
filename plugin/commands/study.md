---
description: Open an Agora flashcard study session (spaced-repetition review) in a NEW terminal window, so studying never mixes with this work chat. macOS Terminal.app.
---

The command below ALREADY RAN automatically and opened the study window. Do NOT
run it again. Show the user ONLY one short line based on its output (whether the
window opened), nothing else.

```!
osascript -e 'tell application "Terminal" to do script "$HOME/.agora/agora review"' >/dev/null 2>&1 && echo "Opened an Agora study window. Click into it: Enter = reveal, g/m/s = grade/skip, q = quit. This session stays clean." || echo "Could not open a window automatically (grant Terminal automation access, or open a new terminal and run: agora study)."
```
