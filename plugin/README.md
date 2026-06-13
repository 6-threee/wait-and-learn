# Agora (Claude Code plugin)

Language flashcards in your Claude Code **status line**, with real spaced
repetition. Shows a word, reveals the translation, rotates as you work, and lets
you grade what you see.

This is the terminal companion to the Agora browser extension. It reads
the same deck and runs the same Leitner scheduler, with its own progress stored
in `~/.agora/`.

## Install

Once this repo is pushed to GitHub (or any git host), users run:

```
/plugin marketplace add <your-username>/wait-and-learn   # the repo hosting this marketplace
/plugin install agora@agora
/agora:setup
```

To try it locally without publishing, point at the repo on disk:

```
/plugin marketplace add /path/to/wait-and-learn
/plugin install agora@agora
/agora:setup
```

Then **restart Claude Code**.

## What `setup` does

- Copies the runtime to a stable `~/.agora/runtime/` (the plugin's own
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
  - `/agora:wl got` - you knew it (it shows up less)
  - `/agora:wl missed` - you didn't (it shows up more)

## Decks and languages

- The free plugin ships the Spanish starter deck.
- List your decks or switch language:
  - `/agora:deck` - list your decks (the active one is marked)
  - `/agora:deck french` - switch the active deck
- Each deck keeps its own spaced-repetition progress, so switching never loses
  your place.
- **Extra decks** (more languages) are just files you drop into
  `~/.agora/decks/`. Anything in that folder loads as a deck. Deck files
  are JavaScript and run as code, so only add decks you trust.

## Notes

- Requires **bun or node** on your PATH.
- Progress is separate from the browser extension (a status line can't reach
  Chrome's storage, and vice versa). Same algorithm, two scorecards.
- Uninstalling the plugin leaves `~/.agora/` in place; delete it by hand
  to remove progress, and restore your old status line from the
  `~/.claude/settings.json.wl-backup` if you want.
- Ships the bundled Spanish deck. To change the rotation interval, edit
  `refreshInterval` under `statusLine` in `~/.claude/settings.json`.

## Layout

- `commands/` - the `setup`, `wl`, and `deck` commands
- `setup.js` - the installer (run by the setup command)
- `runtime/` - self-contained copy of the deck, scheduler, and terminal scripts
  (regenerate from source with `./sync.sh`)
