# Wait & Learn — Flashcards while Claude thinks

**Date:** 2026-06-11
**Status:** Approved design, ready to build
**Owner:** Jonathan

## One-line

A Chrome (MV3) browser extension that fills the dead time while **Claude.ai** is generating a
response with a single, glanceable language flashcard. Tap to reveal the translation, mark
"got it" or "missed", and a lightweight spaced-repetition scheduler decides what to show next.

## Goals

- Turn idle "Claude is thinking" seconds into spaced-repetition vocabulary practice.
- Personal tool first (just Jonathan's browser), but architected so it can be published or
  extended to other AI sites (ChatGPT, Gemini) later without a rewrite.
- **Never break or interfere with Claude.ai.** If detection fails, the card simply does not
  appear. Fail silent, always.

## Non-goals (v1, YAGNI)

- No accounts, no server, no sync, no payments.
- No audio/TTS, no conjugation drills, no sentence construction. One card type: tap-to-reveal.
- No icons/branding polish (Chrome's default puzzle icon is fine for unpacked personal use).
- Only Claude.ai. Other sites are a future detector module, not v1 scope.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Form factor | Chrome MV3 extension, load-unpacked | Personal use, full control of the page |
| Target site | `claude.ai` only | Where Jonathan waits daily |
| Detection | **Approach A** — watch for the "generating" signal (stop button) | Most semantic, stable signal; isolated so a Claude UI change is a one-file fix |
| Placement | Floating card, fixed bottom-right corner | Robust (no dependence on Claude's internal layout), glanceable |
| Card type | Tap-to-reveal flashcard | Active recall in even a 2-second wait |
| Scheduling | Leitner-box spaced repetition, local | Proven retention; tiny algorithm |
| Content | Language-agnostic JSON deck | Drop in any language's word list |
| Storage | `chrome.storage.local` | No server; per-card SRS state persists locally |
| Build tooling | None (vanilla JS, no bundler) | Simplest to load unpacked and iterate |
| Test runtime | `bun test` | Bun is the only JS runtime on this machine |
| Isolation | Card UI rendered in **Shadow DOM** | Claude's CSS and ours never collide |

## Architecture

A single content script bundle injected only on `https://claude.ai/*`. All modules attach to one
global namespace `window.WL` (no bundler; manifest loads files in order). No background service
worker needed in v1 — content scripts can use `chrome.storage` directly.

```
claude.ai page
  └─ content script (isolated world)
       WL.Scheduler  (pure SRS logic — also unit-tested in Bun)
       WL.DeckStore  (load decks, persist SRS state via chrome.storage.local)
       WL.Detector   (THE only Claude-specific piece: emits generationStart/End)
       WL.Card       (Shadow-DOM floating card UI)
       content.js    (wiring: Detector → Scheduler/DeckStore → Card)

options/ (separate page) — pick deck, import a word list, view stats, reset progress
decks/spanish-starter.json — bundled starter deck (language-agnostic schema)
```

**Module boundaries:** Scheduler is pure (no DOM, no storage) and the only unit-tested unit.
DeckStore owns all persistence. Detector owns all Claude-specific fragility. Card owns all DOM
rendering. content.js is the only file that knows about all four. This keeps the fragile part
(Detector) and the testable part (Scheduler) fully isolated.

## Module contracts (single source of truth)

All content-script modules attach to `window.WL`. Manifest load order:
`scheduler.js, deck.js, detector.js, card.js, content.js`.

Each `src/*.js` module begins with:
```js
var WL = (typeof window !== "undefined") ? (window.WL = window.WL || {}) : {};
```
and modules that are unit-tested also end with:
```js
if (typeof module !== "undefined" && module.exports) module.exports = WL.<Module>;
```

### WL.Scheduler  (pure; Node/Bun-requireable)
Leitner boxes 1–5. Intervals by box (ms):
`{1: 60_000, 2: 600_000, 3: 3_600_000, 4: 86_400_000, 5: 345_600_000}`
(1 min, 10 min, 1 h, 1 day, 4 days).

- `WL.Scheduler.INTERVALS` — `{1..5: ms}` map (exported for tests).
- `WL.Scheduler.newState(now)` → `{ box: 1, dueAt: now, seen: 0, lastSeen: 0 }`.
- `WL.Scheduler.pickNext(entries, now)` — `entries: [{ id, state }]` where `state` may be
  `undefined` (unseen → treated as due, `dueAt = 0`, `lastSeen = 0`).
  Returns the chosen `id`, or `null` if `entries` is empty.
  Selection: among entries with `dueAt <= now` (due), pick the one sorted by `dueAt` asc,
  then `box` asc, then `lastSeen` asc. If **none** are due, fall back to the
  least-recently-seen (smallest `lastSeen`, unseen first). Deterministic — no randomness.
- `WL.Scheduler.answer(state, gotIt, now)` → new state.
  `gotIt` → `box = min(box + 1, 5)`; else `box = 1`.
  `dueAt = now + INTERVALS[newBox]`; `seen = seen + 1`; `lastSeen = now`.
- `WL.Scheduler.markSeen(state, now)` → new state with `lastSeen = now`, **no box/dueAt change**,
  `seen` unchanged. Used when a card was shown but the wait ended before the user answered, so it
  is not immediately re-picked. Accepts `undefined` state (creates a fresh one first).
- Pure: never mutates inputs; returns new objects.

### WL.DeckStore  (async; chrome.storage.local + fetch of bundled decks)
Storage keys: `wl.activeDeck` (deck id string), `wl.decks` (object `id→deck` for imported decks),
`wl.srs.<deckId>` (object `cardId→state`). Bundled deck id: `bundled:spanish-starter`.

- `await WL.DeckStore.init()` — resolve active deck (default `bundled:spanish-starter`), load its
  cards and SRS map into memory.
- `WL.DeckStore.getActiveDeck()` → `{ id, name, lang, cards: [{id, front, back, example?}] }` | null.
- `WL.DeckStore.getEntries()` → `[{ id, card, state }]` merging active deck cards with stored SRS
  states (`state` undefined for unseen). This is the array passed to `Scheduler.pickNext` (mapped to
  `{id, state}`).
- `WL.DeckStore.getCard(cardId)` → card object | undefined.
- `WL.DeckStore.getState(cardId)` → state | undefined.
- `await WL.DeckStore.saveState(cardId, state)` — persist one card's state under `wl.srs.<deckId>`.
- `await WL.DeckStore.listDecks()` → `[{ id, name, lang, count }]` (bundled + imported).
- `await WL.DeckStore.setActiveDeck(deckId)`.
- `await WL.DeckStore.importDeck(deckObj)` — validate schema (see below); on success store under
  `wl.decks.<id>` and return `{ ok: true, id }`; on failure `{ ok: false, error }`.
- `await WL.DeckStore.resetProgress(deckId)` — clear `wl.srs.<deckId>`.

Deck schema:
```json
{
  "id": "bundled:spanish-starter",
  "name": "Spanish — Starter 40",
  "lang": "es",
  "cards": [
    { "id": "es-0001", "front": "el perro", "back": "the dog", "example": "El perro corre en el parque." }
  ]
}
```
Import validation: `name` (string), `lang` (string), `cards` (non-empty array; each card needs a
non-empty `front` and `back`; `id` auto-assigned if missing as `imp-<index>`; `example` optional).
Imported decks get id `imported:<slug-of-name>`.

### WL.Detector  (Approach A — the only Claude-specific code)
Emits generation start/end. Defensive: a CONFIG block of candidate selectors at the top of the
file, documented as the thing to update if Claude.ai changes.

- `WL.Detector.start({ onStart, onEnd })` — begin observing; call `onStart()` on the false→true
  transition of "is generating", `onEnd()` on true→false.
- `WL.Detector.stop()`.
- `WL.Detector.isGenerating()` → boolean (current evaluation; also used by the dev hotkey/tests).
- Implementation:
  - `CONFIG.GENERATING_SELECTORS` — array of CSS selectors; if **any** matches a visible element,
    a generation is in progress. Primary guess: a stop control —
    `'button[aria-label*="Stop" i]'`, `'button[aria-label*="stop response" i]'`,
    `'[data-testid*="stop" i]'`. Secondary fallback guess: a thinking indicator. Each entry
    commented `// VERIFY on live claude.ai`.
  - A `MutationObserver` on `document.body` (`childList` + `subtree`), throttled (re-evaluate at
    most every ~150 ms via rAF/timestamp guard), recomputes `isGenerating()`.
  - Debounce transitions: fire `onStart` after the signal is true for ~150 ms; fire `onEnd` after
    it is false for ~400 ms (rides out brief DOM gaps between thinking and streaming).
  - Top-frame only (`window.top === window`).
- Honest note in code + README: these selectors are best-guess and **must be confirmed on live
  Claude.ai**; the dev hotkey lets every other part be tested without correct selectors.

### WL.Card  (Shadow-DOM floating UI)
- `WL.Card.show(card, { onAnswer })` — `card: { front, back, example?, lang? }`. Render the FRONT
  state and fade in (bottom-right fixed). `onAnswer(gotIt: boolean)` fires when the user taps
  "Got it" / "Missed".
- `WL.Card.isVisible()` → boolean.
- `WL.Card.isAwaitingAnswer()` → boolean (revealed and waiting for an answer; content.js uses this
  to avoid auto-dismissing a card mid-rep).
- `WL.Card.dismiss()` — fade out and remove from view (no answer recorded).
- One host `<div>` appended to `document.body` once, with `attachShadow({mode:'open'})`; reused.
  All CSS lives inside the shadow root (string injected into a `<style>`). Card states: FRONT
  (front text + language tag + "tap to reveal") → REVEALED (back + optional example + two buttons).
  Clicking the front (or the reveal affordance) transitions FRONT→REVEALED. Only one card at a time.

### content.js  (wiring; no exports)
1. `await WL.DeckStore.init()`.
2. `WL.Detector.start({ onStart, onEnd })`.
3. `onStart`: if `WL.Card.isVisible()` → do nothing (don't stack). Else pick a card:
   `id = WL.Scheduler.pickNext(entries, now())` from `DeckStore.getEntries()`; if `null`, do nothing.
   Remember the shown card id. `WL.Card.show(card, { onAnswer })`.
4. `onEnd`: if `WL.Card.isAwaitingAnswer()` → leave the card (don't lose the rep). Else if a card is
   visible and unanswered → `markSeen` the shown card (`DeckStore.saveState`) and `WL.Card.dismiss()`.
5. `onAnswer(gotIt)`: `state = Scheduler.answer(prevState, gotIt, now())`; `DeckStore.saveState`;
   `WL.Card.dismiss()`.
6. Dev hotkey **Ctrl+Shift+L**: force-pick and show a card (test UI + SRS without a real
   generation). Logs which detector selector (if any) currently matches, to help confirm selectors.
7. `now()` helper wraps `Date.now()` (one place, easy to stub).

### Options page (`options/`)
`options.html` + `options.js` + `options.css`. Uses `WL.DeckStore` (load deck.js + scheduler.js on
the page too). Features: active-deck dropdown (bundled + imported); import a deck (paste JSON in a
textarea **or** choose a `.json` file) with inline validation feedback; simple stats for the active
deck (total cards, due now, count per box); "Reset progress" button with a confirm.

## Data flow

```
user sends message → Detector.onStart
   → content: pick due card (Scheduler.pickNext over DeckStore.getEntries)
   → Card.show(front)
        user taps → Card reveal (back + example)
            user taps Got it / Missed → Scheduler.answer → DeckStore.saveState → Card.dismiss
Claude finishes → Detector.onEnd
   → if awaiting answer: keep card
   → else if shown & unanswered: Scheduler.markSeen → saveState → Card.dismiss
```

## Error handling (fail-silent rule)

- Detector selectors don't match → `isGenerating()` stays false → no card ever shows. Claude
  untouched. (Dev hotkey still works for testing.)
- `pickNext` returns `null` (empty deck) → no card. Options page shows "deck is empty".
- `chrome.storage` read/write error → log to console, continue with in-memory state; never throw
  into the page.
- Malformed imported deck → `importDeck` returns `{ok:false, error}`; options page shows the error;
  nothing is stored.
- Running inside an iframe → Detector no-ops (top-frame only).

## Testing

- **Unit (Bun):** `test/scheduler.test.js` covers `newState`, `pickNext` (due ordering, unseen =
  due, none-due fallback to least-recently-seen, empty → null, determinism), `answer` (promote/demote,
  box clamp at 5, dueAt math), `markSeen` (no box change, updates lastSeen, accepts undefined).
  Run: `bun test`.
- **Manual QA (on Jonathan's machine):** load unpacked → open claude.ai → send a prompt → confirm a
  card fades in and the reveal/answer flow works → confirm the card fades when Claude finishes if
  untouched, and persists if mid-answer. Use **Ctrl+Shift+L** to test rendering/SRS without waiting,
  and to read the console line reporting which generating-selector matched (to confirm/adjust the
  Detector CONFIG against the live DOM).
- DOM detection itself is not unit-tested (it depends on Claude's live markup); it is isolated and
  manually verified.

## File layout

```
wait-and-learn/
  manifest.json
  src/scheduler.js
  src/deck.js
  src/detector.js
  src/card.js
  src/content.js
  decks/spanish-starter.json
  options/options.html
  options/options.js
  options/options.css
  test/scheduler.test.js
  README.md
```

## manifest.json (shape)

```json
{
  "manifest_version": 3,
  "name": "Wait & Learn — Flashcards while Claude thinks",
  "version": "0.1.0",
  "description": "Turns Claude.ai thinking time into spaced-repetition language flashcards.",
  "permissions": ["storage"],
  "host_permissions": ["https://claude.ai/*"],
  "content_scripts": [{
    "matches": ["https://claude.ai/*"],
    "js": ["src/scheduler.js","src/deck.js","src/detector.js","src/card.js","src/content.js"],
    "run_at": "document_idle",
    "all_frames": false
  }],
  "web_accessible_resources": [
    { "resources": ["decks/*.json"], "matches": ["https://claude.ai/*"] }
  ],
  "options_page": "options/options.html"
}
```

## Future (explicitly out of v1 scope)

- Sibling detectors for ChatGPT / Gemini (same Detector interface, different CONFIG).
- Audio pronunciation, more card types, deck marketplace, cross-device sync.
- Publish to the Chrome Web Store (needs icons, onboarding, store assets).
