# Wait & Learn: Flashcards while Claude thinks

A Chrome (MV3) browser extension that fills the dead time while **Claude.ai** is
generating a response with a single, glanceable language flashcard. Tap to reveal
the translation, mark "Got it" or "Missed", and a lightweight spaced-repetition
scheduler decides what to show next.

It only runs on `https://claude.ai/*`. It never sends a network request, has no
account or server, and stores all progress locally in `chrome.storage.local`.

## How to load it (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the project folder: `/Users/jonathanluis/Desktop/wait-and-learn`.

The extension loads with Chrome's default puzzle-piece icon (no branding in v1).
After loading, refresh any open claude.ai tab so the content script attaches.

## How to use it

Just chat on `claude.ai`. When Claude starts generating a response, a small
flashcard fades in at the bottom-right corner of the page.

1. Read the front (the foreign word) while Claude thinks.
2. Tap the card to reveal the translation (and an example sentence if the card
   has one).
3. Tap **Got it** or **Missed**. Your answer feeds the spaced-repetition
   scheduler, which decides when you next see that card.

If you do not answer before Claude finishes, the card quietly fades away and is
marked as "seen" so it is not immediately shown again. If you are mid-answer
(the card is revealed and waiting), it stays put so you do not lose the rep.

If the card never appears, nothing is broken. The extension fails silent by
design (see the design notes below) and never interferes with Claude.

## Dev hotkey: Ctrl+Shift+L

Detection of the "Claude is generating" signal depends on Claude's live DOM,
which can change. The detector ships with a CONFIG block of **best-guess**
candidate selectors that must be confirmed against the real page.

Press **Ctrl+Shift+L** on any claude.ai tab to:

1. Force-show a flashcard immediately, so you can test the reveal/answer flow
   and the scheduler without waiting for a real generation.
2. Print a `console.table` of every candidate selector and its current
   match-state (selector, whether it matched, and how many elements it matched).

To confirm or adjust detection:

1. Open the browser console (Cmd+Opt+J) on a claude.ai tab.
2. Send a prompt so Claude is actively generating.
3. Press **Ctrl+Shift+L** and read the `console.table`. The selector that shows
   `matched: true` only while Claude is generating is the correct one.
4. If none of the bundled selectors match the live "stop generating" control,
   edit `CONFIG.GENERATING_SELECTORS` at the top of `src/detector.js` to the
   selector you confirmed, then reload the extension.

This lets every other part of the extension be tested even before the live
selectors are confirmed.

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
