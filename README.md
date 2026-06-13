# Agora — flashcards while Claude thinks

*Agora* ("now" in Portuguese) turns the seconds you spend waiting on Claude into
language practice. The main product is a **Claude Code plugin**: your vocabulary
shows in Claude Code's thinking spinner while it works, backed by real spaced
repetition. Free, no account, nothing leaves your machine. Five languages
bundled (Spanish, French, German, Italian, Portuguese), 250 words each.

## Install (Claude Code plugin)

```sh
claude plugin marketplace add 6-threee/agora
claude plugin install agora@agora
```

Then **restart Claude Code** so the commands load, and run:

```
/agora:setup spinner
```

Restart once more, and your vocabulary shows up in Claude Code's thinking
spinner while it works. (Needs `bun` or `node` on your PATH; the spinner needs
Claude Code 2.1.143+. Prefer an always-visible card instead? Use `/agora:setup`
for status-line mode.)

### Commands

- `/agora:setup spinner` — flashcards in the thinking spinner bar
- `/agora:deck <language>` — switch language (spanish · french · german · italian · portuguese)
- `/agora:study` — pop a spaced-repetition review session into its own terminal (recall → reveal → grade)
- `/agora:pause` / `/agora:resume` — hide/show the cards during deep focus

### Support

Agora is free and always will be. If it helps you, pay what you want (including
nothing): **https://myaibiz.gumroad.com/l/keyulq**

---

## Browser extension (claude.ai)

There is also a Chrome (MV3) extension that shows the same flashcards on
**claude.ai** in the browser. It only runs on `https://claude.ai/*`, never sends
a network request, has no account or server, and stores progress locally in
`chrome.storage.local`.

## How to load it (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `wait-and-learn` folder you cloned.

After loading, refresh any open claude.ai tab so the content script attaches.

## How to use it

Just chat on `claude.ai`. When Claude starts generating a response, a small
flashcard fades in at the bottom-right corner of the page.

1. Read the front (the foreign word) while Claude thinks.
2. Tap the card to reveal the translation (and an example sentence if the card
   has one).
3. Tap **Got it** or **Missed**. Your answer feeds the spaced-repetition
   scheduler, which decides when you next see that card.

While Claude keeps generating, answering one card brings up the next, so a long
"think" becomes a short flashcard run. If you do not answer before Claude
finishes, the card quietly fades away and is marked as "seen" so it is not
immediately shown again. If you are mid-answer (the card is revealed and
waiting), it stays put so you do not lose the rep.

**Pronunciation:** each card has a speaker button (🔊) that says the word using
your computer's built-in voices (macOS ships Spanish, French, and others). By
default the word is also spoken automatically when a card appears; turn that off
on the options page. No account or API key, nothing leaves your device.

If the card never appears, nothing is broken. The extension fails silent by
design (see the design notes below) and never interferes with Claude.

## Dev hotkey: Ctrl+Shift+L (or Cmd+Shift+L on Mac)

Detection of the "Claude is generating" signal depends on Claude's live DOM,
which can change. The detector ships with a CONFIG block of **best-guess**
candidate selectors that must be confirmed against the real page.

Press **Ctrl+Shift+L** (or **Cmd+Shift+L** on macOS) on any claude.ai tab to:

1. Force-show a flashcard immediately, so you can test the reveal/answer flow
   and the scheduler without waiting for a real generation.
2. Print a `console.table` of every candidate selector and its current
   match-state (selector, whether it matched, and how many elements it matched).

To confirm or adjust detection:

1. Open the browser console (Cmd+Opt+J) on a claude.ai tab.
2. Send a prompt so Claude is actively generating.
3. Press **Ctrl+Shift+L** (or **Cmd+Shift+L**) and read the `console.table`. The selector that shows
   `matched: true` only while Claude is generating is the correct one.
4. If none of the bundled selectors match the live "stop generating" control,
   edit `CONFIG.GENERATING_SELECTORS` at the top of `src/detector.js` to the
   selector you confirmed, then reload the extension.

This lets every other part of the extension be tested even before the live
selectors are confirmed.

## Terminal (Claude Code) status line

The browser card needs a web page, so it cannot run in Claude Code in the
terminal. The terminal version is a **status-line** flashcard instead, in Claude
Code's bottom bar. It reads the **same deck** and runs the **same Leitner
scheduler** as the browser (with its own state under `~/.agora/`,
separate from the browser's storage).

What it does:

- **Recall rhythm:** it shows the word alone first (`📘 ES el perro · ?`), then
  reveals the translation on the next refresh (`📘 ES el perro → the dog`), then
  moves on. That recreates the "try to recall, then check" moment of a flashcard
  in a bar that cannot be clicked.
- **Memory:** it tracks exposure per word and (via the shared scheduler) shows
  the words you have seen least, and the words you have missed, more often. State
  persists across sessions and restarts.
- **Grading (`wl got` / `wl missed`):** the one bit of interactivity a status
  line cannot do itself. Grade the word currently on screen and it feeds real
  spaced repetition: `got` promotes it (you see it less), `missed` drops it to
  box 1 (you see it more). The stored state always matches the displayed card, so
  you grade exactly what you see.

### Enable it

Add this to `~/.claude/settings.json` (replaces the default bottom bar):

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.bun/bin/bun ~/Desktop/wait-and-learn/terminal/statusline.mjs",
    "refreshInterval": 3
  }
}
```

`refreshInterval` (seconds, min 1) is what makes it rotate while you wait. By
default Claude Code only re-runs the status line at turn boundaries; a value of
`3` re-runs it every 3 seconds so the card advances during a long "think". Raise
it to slow down, remove it to change only per turn.

### Set up the `wl` grading command

`terminal/wl` is a wrapper around `terminal/grade.mjs`. Add an alias so you can
just type `wl got`:

```sh
echo "alias wl='$HOME/Desktop/wait-and-learn/terminal/wl'" >> ~/.zshrc
source ~/.zshrc
```

Then, while a word is on screen: `wl got` if you knew it, `wl missed` if you did
not. It prints a one-line confirmation and the status line moves to a fresh card.

### Notes

- Everything is fail-silent: on any error the status line prints nothing rather
  than break your bar.
- The rhythm state is global (not per-session) so the `wl` command can target the
  shown card. If you run several Claude Code sessions at once they share one
  rhythm; the SRS progress is shared too (one learner), which is what you want.
- It uses the bundled Spanish deck. Switching decks is a browser-side feature for
  now.

### Sharing it with others

The `terminal/` setup above is the hand-wired version for this machine. To
distribute the terminal version to other people, there is a Claude Code **plugin**
in `plugin/` (installed from the marketplace at `.claude-plugin/marketplace.json`).
It bundles a self-contained runtime and ships a `/agora:setup` command
that copies the runtime to `~/.agora/runtime/` and wires the status line
into the user's settings (keeping any existing one). See `plugin/README.md`.

## Importing a deck

Open the extension's options page (right-click the extension icon → **Options**,
or via `chrome://extensions` → **Details** → **Extension options**). There you
can:

- Pick the active deck (bundled starter or any deck you have imported).
- Import a deck by pasting its JSON into the textarea **or** choosing a `.json`
  file. Validation feedback appears inline; nothing is stored if the deck is
  malformed.
- View simple stats for the active deck (total cards, due now, count per box).
- Reset progress for the active deck (with a confirm).

Deck JSON shape:

```json
{
  "id": "imported:my-deck",
  "name": "My Deck",
  "lang": "es",
  "cards": [
    { "id": "es-0001", "front": "el perro", "back": "the dog", "example": "El perro corre en el parque." }
  ]
}
```

Each card needs a non-empty `front` and `back`. `id` is auto-assigned if missing
and `example` is optional. Imported decks are given an id of
`imported:<slug-of-name>`.

## Design notes (fail-silent + CSP)

- **Fail silent, always.** If the detector's selectors do not match, the card
  simply never appears and Claude is left completely untouched. Storage errors
  are logged to the console and the extension continues with in-memory state
  rather than throwing into the page. Inside an iframe the detector no-ops
  (top-frame only).
- **Constructable stylesheet, not an injected `<style>`.** The card UI lives in
  a Shadow DOM, and its CSS is applied with a constructable stylesheet
  (`new CSSStyleSheet()` + `replaceSync` + `adoptedStyleSheets`). That avoids
  claude.ai's `style-src` Content Security Policy, which can block an injected
  `<style>` text node.
- **Bundled deck as a JS global, not fetched JSON.** The starter deck ships as
  `decks/spanish-starter.js`, which assigns the deck object to
  `WL.__bundledDeck`. Loading it as a script (instead of fetching a `.json`
  file) avoids needing `web_accessible_resources` and avoids any
  `connect-src` CSP concern on claude.ai.
- The only Claude-specific, fragile code is `src/detector.js`. Everything else
  (scheduler, deck store, card UI) is site-agnostic, so a Claude UI change is a
  one-file fix.

After loading on claude.ai, confirm there are **no CSP errors** in the console.
The constructable stylesheet and JS-global bundled deck are designed to avoid
them.

## Running the tests

The spaced-repetition scheduler is pure logic and is unit-tested with Bun (the
only JS runtime on this machine):

```sh
bun test
```

This runs `test/scheduler.test.js`, covering `newState`, `pickNext` (due
ordering, unseen-as-due, none-due fallback, empty → null, determinism),
`answer` (promote/demote, box clamp at 5, due-time math), and `markSeen`. DOM
detection is not unit-tested (it depends on Claude's live markup); it is
isolated in the detector and verified manually with the dev hotkey.
