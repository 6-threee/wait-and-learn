// Shared state + deck/scheduler loading for the terminal (Claude Code) flashcard.
// Used by statusline.js (display) and grade.js (got/missed feedback). Reuses the
// browser extension's exact deck and Leitner scheduler, with its own on-disk
// state under ~/.agora/ (separate from the browser's chrome.storage).
// Everything here is fail-silent: on error it returns empty/null, never throws.
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
// Node + bun compatible (import.meta.dir is bun-only).
const HERE = path.dirname(fileURLToPath(import.meta.url));

// One-time state-dir migration (rename from the old brand to ~/.agora). Runs
// before any reader below touches the state dir, so the user's SRS progress,
// Pro decks, and active-deck config survive the rebrand. Fail-silent: a rename
// failure leaves the old dir in place and never throws.
(function migrateStateDir() {
  try {
    const oldDir = path.join(os.homedir(), ".wait-and-learn");
    const newDir = path.join(os.homedir(), ".agora");
    if (!fs.existsSync(newDir) && fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir);
  } catch (e) {}
})();

// Resolve a module from the first path that loads. Supports both the dev layout
// (terminal/ next to ../src and ../decks) and the flat plugin layout (everything
// copied into one runtime/ directory).
function tryRequire(candidates) {
  for (const p of candidates) { try { return require(p); } catch (e) {} }
  return null;
}

// Decks the user has: the bundled free Starter, plus any Pro decks they have
// unlocked by dropping deck files into ~/.agora/decks/. That drop-in
// folder IS the Pro unlock; no license server, no network call.
export const decks = (function loadAllDecks() {
  const out = [];
  const bundled = tryRequire([
    path.join(HERE, "spanish-starter.js"),                 // flat plugin runtime
    path.join(HERE, "..", "decks", "spanish-starter.js")   // dev layout
  ]);
  if (bundled && Array.isArray(bundled.cards)) out.push(bundled);
  const userDir = path.join(os.homedir(), ".agora", "decks");
  try {
    for (const f of fs.readdirSync(userDir).sort()) {
      if (!f.endsWith(".js")) continue;
      try {
        const d = require(path.join(userDir, f));
        if (d && Array.isArray(d.cards) && !out.some(function (x) { return x.id === d.id; })) out.push(d);
      } catch (e) {}
    }
  } catch (e) {}
  return out;
})();

// The active deck = config.activeDeck if the user has it, else the bundled
// Starter. statusline/grade read this; switch it with the `deck` command.
export const deck = (function pickActive() {
  if (!decks.length) return null;
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".agora", "config.json"), "utf8")) || {}; } catch (e) {}
  if (cfg.activeDeck) {
    const found = decks.find(function (d) { return d.id === cfg.activeDeck; });
    if (found) return found;
  }
  return decks[0];
})();

// The same pure Leitner scheduler the extension uses.
export const Scheduler = tryRequire([
  path.join(HERE, "scheduler.js"),                       // flat plugin runtime
  path.join(HERE, "..", "src", "scheduler.js")           // dev layout
]);

const DIR = path.join(os.homedir(), ".agora");

// Self-heal orphaned temp files. A status-line process SIGKILLed between the
// writeJson temp-write and the rename never runs its catch/unlink, leaving a
// stale *.tmp.<pid>. Once per process at load, drop any whose owning PID is dead.
(function sweepOrphanTmp() {
  try {
    for (const f of fs.readdirSync(DIR)) {
      const m = f.match(/\.tmp\.(\d+)$/);
      if (!m) continue;
      const pid = Number(m[1]);
      if (pid === process.pid) continue; // never our own in-flight temp
      try { process.kill(pid, 0); } catch (e) {
        // ESRCH = no such process, so the temp is orphaned and safe to remove.
        // EPERM (or success) means the process is alive; leave its temp alone.
        if (e.code === "ESRCH") { try { fs.unlinkSync(path.join(DIR, f)); } catch (e2) {} }
      }
    }
  } catch (e) {}
})();

function ensureDir() { try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) {} }
function safeId(s) { return String(s || "deck").replace(/[^a-zA-Z0-9._-]/g, "_"); }

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; }
}
function writeJson(file, obj) {
  // Atomic: write a temp file then rename (rename is atomic on the same
  // filesystem). The status line runs every ~3s and overlapping invocations
  // can be cancelled mid-write; a torn write would otherwise read back as {}
  // and the next save would silently wipe the SRS map.
  // Returns true on success, false on failure, so a caller that must confirm a
  // write landed (the grader) can report failure instead of a false success.
  const tmp = file + ".tmp." + process.pid;
  try {
    ensureDir();
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    // Don't leave the temp file behind on a failed/partial write.
    try { fs.unlinkSync(tmp); } catch (e2) {}
    return false;
  }
}

// SRS box state: cardId -> { box, dueAt }. One file per deck. Written ONLY by the
// grader (grade.mjs). Kept separate from exposure (below) so the ~3s status-line
// writes can never race-clobber a grade; last-writer-wins on a shared file would
// otherwise silently revert a box promotion.
export function loadSrs(deckId) { return readJson(path.join(DIR, "srs." + safeId(deckId) + ".json"), {}) || {}; }
export function saveSrs(deckId, map) { return writeJson(path.join(DIR, "srs." + safeId(deckId) + ".json"), map); }

// Exposure state: cardId -> { lastSeen }. Written ONLY by the status line, every
// refresh, to drive least-recently-seen rotation. Separate file means its frequent
// writes never touch the grader's box file.
export function loadExposure(deckId) { return readJson(path.join(DIR, "exposure." + safeId(deckId) + ".json"), {}) || {}; }
export function saveExposure(deckId, map) { return writeJson(path.join(DIR, "exposure." + safeId(deckId) + ".json"), map); }

// Rhythm: which card is on screen and whether it is in front/reveal phase.
// Global (not per-session) so the grading command can target the shown card.
export function loadRhythm() { return readJson(path.join(DIR, "rhythm.json"), {}) || {}; }
export function saveRhythm(obj) { return writeJson(path.join(DIR, "rhythm.json"), obj); }

// Config written by the plugin setup (e.g. { prevCommand } for combined mode,
// where we keep the user's previous status line and append the flashcard).
export function loadConfig() { return readJson(path.join(DIR, "config.json"), {}) || {}; }

// Build the [{ id, state }] entries the scheduler's pickNext expects, merging box
// state (box, dueAt) with exposure (lastSeen) into the single shape it sorts on.
export function entries(srs, exposure) {
  if (!deck || !Array.isArray(deck.cards)) return [];
  exposure = exposure || {};
  return deck.cards.map(function (c) {
    var b = srs[c.id] || {};
    var e = exposure[c.id] || {};
    return { id: c.id, state: { box: b.box, dueAt: b.dueAt, lastSeen: e.lastSeen } };
  });
}
