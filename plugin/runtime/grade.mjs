// Agora - grade the flashcard currently shown in the Claude Code status
// line, feeding the SAME spaced-repetition state the status line reads. This is
// the bit of interactivity a status line cannot do on its own.
//
//   wl got      you knew it      -> promote (seen less often)
//   wl missed   you did not      -> demote to box 1 (seen more often)
//
// `wl` is the wrapper script in this folder; see the README for the alias.
import { deck, Scheduler, loadSrs, saveSrs, loadRhythm, saveRhythm } from "./store.mjs";

const arg = String(process.argv[2] || "").toLowerCase();
const gotIt = arg === "got" || arg === "g" || arg === "y" || arg === "yes" || arg === "know";
const missed = arg === "missed" || arg === "m" || arg === "n" || arg === "no" || arg === "miss";

try {
  if (!deck || !Scheduler || !Array.isArray(deck.cards)) {
    console.log("Agora: deck/scheduler not available.");
    process.exit(0);
  }
  if (!gotIt && !missed) {
    console.log("Usage:\n  wl got      (you knew the word)\n  wl missed   (you didn't)");
    process.exit(0);
  }

  const deckId = deck.id || "deck";
  const byId = {};
  deck.cards.forEach(function (c) { byId[c.id] = c; });

  const r = loadRhythm();
  if (!r.cardId || !byId[r.cardId]) {
    console.log("No current card to grade yet. Wait for one to appear in the status line.");
    process.exit(0);
  }

  const now = Date.now();
  const srs = loadSrs(deckId);                          // box state only
  const next = Scheduler.answer(srs[r.cardId], gotIt, now);
  srs[r.cardId] = { box: next.box, dueAt: next.dueAt }; // persist box state only
  if (!saveSrs(deckId, srs)) {
    console.log("Agora: couldn't save your grade (disk write failed). Try again.");
    process.exit(0);
  }

  // Clear the rhythm so the next status-line refresh starts on a fresh card
  // (the scheduler will not re-pick the one just graded up).
  saveRhythm({});

  const card = byId[r.cardId];
  const mark = gotIt ? "\x1b[32m✓ got it\x1b[0m" : "\x1b[33m✗ missed\x1b[0m";
  console.log(`${mark}  ${card.front} → ${card.back}   (box ${srs[r.cardId].box})`);
} catch (e) {
  console.log("Agora: grade failed.");
}
