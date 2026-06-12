---
description: Install the Wait & Learn flashcard status line (copies the runtime to a stable location and wires it into your Claude Code settings, keeping any existing status line).
---

Set up the Wait & Learn language-flashcard status line for this user.

Run exactly this command and show the user its full output. Try bun first, fall
back to node:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/setup.mjs" 2>/dev/null || node "${CLAUDE_PLUGIN_ROOT}/setup.mjs"
```

The script copies the runtime to `~/.wait-and-learn/runtime/`, backs up the
user's `~/.claude/settings.json`, and configures the `statusLine` (preserving any
existing one in combined mode). Do not edit any files yourself; the script does
everything.

After it runs, tell the user briefly: restart Claude Code to see the status line,
and grade the word currently on screen with `/wait-and-learn:wl got` (knew it) or
`/wait-and-learn:wl missed` (didn't).
