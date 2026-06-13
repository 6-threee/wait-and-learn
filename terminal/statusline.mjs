// Agora - Claude Code status line.
// Shows a rotating language flashcard from the SAME deck the browser extension
// uses, with real spaced repetition (shared scheduler) and a passive recall
// rhythm: it shows the word alone first ("el perro · ?"), then reveals the
// translation on the next refresh ("el perro -> the dog"), then moves on.
// Grade the shown word with the `wl` command (see grade.js) to feed real SRS.
//
// The persisted rhythm always reflects the card CURRENTLY on screen, so `wl got`
// / `wl missed` grade exactly what you see.
//
// Configure with a short refreshInterval so it rotates during waits (README).
// Fail-silent: prints nothing on error rather than break the status bar.
import fs from "fs";
import { execSync } from "child_process";
import { deck, Scheduler, loadSrs, loadExposure, saveExposure, loadRhythm, saveRhythm, loadConfig, entries } from "./store.mjs";

// How many refreshes the revealed answer lingers before auto-advancing if you
// do not grade it. With refreshInterval 3, 2 = the answer shows for ~6s.
const REVEAL_TICKS = 2;

try {
  // Read stdin (Claude Code pipes session JSON). Kept for combined mode below.
  let stdinRaw = "";
  try { stdinRaw = fs.readFileSync(0, "utf8"); } catch (e) {}

  if (!deck || !Scheduler || !Array.isArray(deck.cards) || !deck.cards.length) process.exit(0);

  // Focus mode: /agora:pause renders nothing (live, every refresh).
  if (loadConfig().paused) process.exit(0);

  const byId = {};
  deck.cards.forEach(function (c) { byId[c.id] = c; });
  const deckId = deck.id || "deck";
  const now = Date.now();

  const srs = loadSrs(deckId);              // box state (read-only here)
  const exposure = loadExposure(deckId);    // exposure state (the status line owns this)
  function pickId() { return Scheduler.pickNext(entries(srs, exposure), now); }

  // Advance from the previous (displayed) state to the state to show THIS run.
  const prev = loadRhythm();
  let cur;
  if (prev.deckId !== deckId || !prev.cardId || !byId[prev.cardId]) {
    cur = { deckId: deckId, cardId: pickId(), phase: "front", revealCount: 0 };
  } else if (prev.phase === "front") {
    cur = { deckId: deckId, cardId: prev.cardId, phase: "reveal", revealCount: 0 };
  } else {
    const rc = (prev.revealCount || 0) + 1;
    if (rc >= REVEAL_TICKS) {
      // Exposure memory: record that the finished card was just seen (lastSeen) in
      // the EXPOSURE file only, never the box file, so this ~3s write can't
      // race-revert a grade. pickNext's lastSeen tiebreak then rotates the deck.
      exposure[prev.cardId] = { lastSeen: now };
      saveExposure(deckId, exposure);
      cur = { deckId: deckId, cardId: pickId() || prev.cardId, phase: "front", revealCount: 0 };
    } else {
      cur = { deckId: deckId, cardId: prev.cardId, phase: "reveal", revealCount: rc };
    }
  }
  if (!cur.cardId || !byId[cur.cardId]) process.exit(0); // empty deck guard

  const card = byId[cur.cardId];

  // Render the current phase.
  const dim = "\x1b[2m", bold = "\x1b[1m", cyan = "\x1b[36m", reset = "\x1b[0m";
  const lang = String(deck.lang || "").toUpperCase();
  let out;
  if (cur.phase === "front") {
    out = `${dim}📘 ${lang}${reset} ${bold}${cyan}${card.front}${reset} ${dim}· ?${reset}`;
  } else {
    out = `${dim}📘 ${lang}${reset} ${bold}${cyan}${card.front}${reset} ${dim}→${reset} ${card.back}`;
  }

  // Combined mode: if the plugin setup saved the user's previous status-line
  // command, run it (with the same stdin) and show its output first, so they
  // keep their normal bar and get the flashcard appended. Defensive: on any
  // error or timeout we just show the flashcard alone.
  //
  // Security: prevCommand is the user's OWN previously-configured status-line
  // command, read from their settings.json by the plugin setup. It is not
  // external/network input - it is the same shell command Claude Code was
  // already running every refresh. A shell is required (status lines are shell
  // pipelines like jq). The piped session JSON goes via `input` (stdin), never
  // interpolated into the command string, so there is no injection from it.
  const cfg = loadConfig();
  if (cfg && cfg.prevCommand) {
    try {
      const prev = execSync(cfg.prevCommand, { input: stdinRaw, timeout: 1500, stdio: ["pipe", "pipe", "ignore"] })
        .toString().replace(/\n+$/, "");
      if (prev) out = prev + `  ${dim}|${reset}  ` + out;
    } catch (e) { /* prev command failed; show flashcard alone */ }
  }

  process.stdout.write(out);

  // Persist the state that is now on screen (so grading targets this card).
  saveRhythm(cur);
} catch (e) {
  // fail silent: print nothing rather than break the status line
}
