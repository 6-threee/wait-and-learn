// Agora - interactive spaced-repetition review loop. Run this in a SEPARATE
// terminal from your Claude Code work session, so flashcards never mix with task
// output. It reads the SAME ~/.agora progress the spinner/status line use.
//
//   agora review        (or: bun ~/.agora/runtime/review.mjs)
//
// Per card: see the word, press Enter to reveal the answer, then grade:
//   g = got it (promote)   m = missed (back to box 1)   s = skip   q = quit
//
// In spinner mode, grading also refreshes the spinner word list toward your
// weakest cards (applies on the next Claude Code start).
//
// Uses event-based readline (not readline/promises, which mis-handles piped
// input under bun) so it works the same in a real terminal and when scripted.
import { deck, Scheduler, loadSrs, saveSrs, loadExposure, saveExposure,
         loadConfig, entries } from "./store.mjs";
import { applySpinner } from "./settings.mjs";
import { createInterface } from "node:readline";

const bold = "\x1b[1m", cyan = "\x1b[36m", dim = "\x1b[2m",
      green = "\x1b[32m", yellow = "\x1b[33m", reset = "\x1b[0m";

if (!deck || !Scheduler || !Array.isArray(deck.cards) || !deck.cards.length) {
  console.log("Agora: no deck loaded. Run /agora:setup first.");
  process.exit(0);
}

const deckId = deck.id || "deck";
const lang = String(deck.lang || "").toUpperCase();
const byId = {};
deck.cards.forEach(function (c) { byId[c.id] = c; });
const srs = loadSrs(deckId);
const exposure = loadExposure(deckId);
const inSpinnerMode = (function () { try { return loadConfig().mode === "spinner"; } catch (e) { return false; } })();

function refreshSpinner() {
  if (!inSpinnerMode) return;
  try {
    const ordered = deck.cards.slice().sort(function (a, b) {
      return ((srs[a.id] && srs[a.id].box) || 1) - ((srs[b.id] && srs[b.id].box) || 1);
    });
    applySpinner(ordered.filter(function (c) { return c.front && c.back; })
      .map(function (c) { return c.front + " → " + c.back; }));
  } catch (e) { /* fail-soft */ }
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
let state = "front";   // "front" (awaiting reveal/skip/quit) | "reveal" (awaiting grade)
let currentId = null;
let graded = 0;
let correctThisSession = 0;

function frontPrompt(c) {
  return `📘 ${dim}${lang}${reset}  ${bold}${cyan}${c.front}${reset}   ${dim}[Enter] reveal · s skip · q quit${reset} `;
}
function gradePrompt() {
  return `   ${dim}g got · m missed · s skip · q quit${reset} `;
}
function showNext() {
  const id = Scheduler.pickNext(entries(srs, exposure), Date.now());
  if (!id || !byId[id]) { rl.close(); return; }
  currentId = id;
  state = "front";
  rl.setPrompt(frontPrompt(byId[id]));
  rl.prompt();
}
function gradeCurrent(gotIt) {
  // Pass the RAW state (may be undefined) to answer() so its `|| newState`
  // fallback works; read counters from a safe copy.
  const prevCounts = srs[currentId] || {};
  const n = Scheduler.answer(srs[currentId], gotIt, Date.now());
  srs[currentId] = {
    box: n.box,
    dueAt: n.dueAt,
    attempts: (prevCounts.attempts || 0) + 1,
    correct: (prevCounts.correct || 0) + (gotIt ? 1 : 0)
  };
  if (saveSrs(deckId, srs)) {
    graded++;
    if (gotIt) correctThisSession++;
    refreshSpinner();
    console.log(`   ${gotIt ? green + "✓ got it" : yellow + "✗ missed"}${reset}  (box ${n.box})\n`);
  } else {
    console.log(`   ${yellow}couldn't save grade (disk write failed)${reset}\n`);
  }
}
function skipCurrent() {
  exposure[currentId] = { lastSeen: Date.now() };
  saveExposure(deckId, exposure);
  console.log(`${dim}↷ skipped${reset}\n`);
}

console.log(`${dim}Agora review - ${deck.name}. Enter = reveal, g/m/s = grade/skip, q = quit.${reset}\n`);
showNext();

rl.on("line", function (raw) {
  const a = String(raw || "").trim().toLowerCase();
  if (a === "q" || a === "quit") { rl.close(); return; }

  if (state === "front") {
    if (a === "s" || a === "skip") { skipCurrent(); showNext(); return; }
    const c = byId[currentId];
    console.log(`   ${bold}${cyan}${c.front}${reset} ${dim}→${reset} ${c.back}` +
      (c.example ? `   ${dim}${c.example}${reset}` : ""));
    state = "reveal";
    rl.setPrompt(gradePrompt());
    rl.prompt();
    return;
  }

  // state === "reveal"
  if (a === "g" || a === "got") gradeCurrent(true);
  else if (a === "m" || a === "missed") gradeCurrent(false);
  else skipCurrent();
  showNext();
});

rl.on("close", function () {
  const pct = graded > 0 ? Math.round((correctThisSession / graded) * 100) : 0;
  const tally = graded > 0 ? `${graded} graded, ${correctThisSession} correct (${pct}%)` : "0 graded";
  console.log(`\n${dim}Session done. ${tally}. ¡Hasta luego!${reset}`);
  process.exit(0);
});
