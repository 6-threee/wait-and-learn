# Wait & Learn (Claude Code plugin)

Language flashcards in your Claude Code **status line**, with real spaced
repetition. Shows a word, reveals the translation, rotates as you work, and lets
you grade what you see.

This is the terminal companion to the Wait & Learn browser extension. It reads
the same deck and runs the same Leitner scheduler, with its own progress stored
in `~/.wait-and-learn/`.

## Install

Once this repo is pushed to GitHub (or any git host), users run:

```
/plugin marketplace add <your-username>/wait-and-learn   # the repo hosting this marketplace
/plugin install wait-and-learn@wait-and-learn
/wait-and-learn:setup
```

To try it locally without publishing, point at the repo on disk:

```
/plugin marketplace add /Users/jonathanluis/Desktop/wait-and-learn
/plugin install wait-and-learn@wait-and-learn
/wait-and-learn:setup
```

Then **restart Claude Code**.

## What `setup` does

- Copies the runtime to a stable `~/.wait-and-learn/runtime/` (the plugin's own
  install path is ephemeral and changes on update, so the status line can't point
  at it).
- Configures `statusLine` in `~/.claude/settings.json`, **backing it up first**.
- **Combined mode:** if you already have a status line, it is kept and the
  flashcard is appended, so you don't lose your context/cost/git readout.
- Uses whichever runtime ran setup (bun or node).

## Use

- A flashcard rotates in your status line: `📘 ES el perro · ?` then
  `📘 ES el perro → the dog`, every few seconds.
- Grade the word on screen:
  - `/wait-and-learn:wl got` - you knew it (it shows up less)
  - `/wait-and-learn:wl missed` - you didn't (it shows up more)

## Notes

- Requires **bun or node** on your PATH.
- Progress is separate from the browser extension (a status line can't reach
  Chrome's storage, and vice versa). Same algorithm, two scorecards.
- Uninstalling the plugin leaves `~/.wait-and-learn/` in place; delete it by hand
  to remove progress, and restore your old status line from the
  `~/.claude/settings.json.wl-backup` if you want.
- Ships the bundled Spanish deck. To change the rotation interval, edit
  `refreshInterval` under `statusLine` in `~/.claude/settings.json`.

## Layout

- `commands/` - the `/wait-and-learn:setup` and `/wait-and-learn:wl` commands
- `setup.js` - the installer (run by the setup command)
- `runtime/` - self-contained copy of the deck, scheduler, and terminal scripts
  (regenerate from source with `./sync.sh`)
