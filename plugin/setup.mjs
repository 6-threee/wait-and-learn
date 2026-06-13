// Agora plugin installer. Run by the /agora:setup command.
//
// Two modes:
//  - statusline (default): the flashcard runs in Claude Code's status line
//    (always visible), with the reveal rhythm and /agora:wl grading.
//  - spinner ("/agora:setup spinner"): the active deck shows in Claude Code's
//    thinking spinner (settings.json spinnerVerbs, CC 2.1.143+); the status line
//    is left as Claude Code's default. Passive, shows only while generating.
//
// Copies the bundled runtime to ~/.agora/runtime/, BACKS UP settings.json before
// writing (when it is not already ours), only ever removes Agora's OWN status
// line (never a foreign one), and records the mode in config.json so /agora:deck
// knows whether to refresh the spinner. Node + bun. Fail-loud, never half-writes.
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runtimeSrc = path.join(HERE, "runtime");
const home = os.homedir();
const stateDir = path.join(home, ".agora");
const runtimeDst = path.join(stateDir, "runtime");
const settingsPath = path.join(home, ".claude", "settings.json");
const configPath = path.join(stateDir, "config.json");
const mode = String(process.argv[2] || "").trim().toLowerCase() === "spinner" ? "spinner" : "statusline";

// One-time state-dir migration (rename from the old brand to ~/.agora). Runs
// before the runtime copy creates ~/.agora, so re-running setup over an old
// install carries the user's SRS progress, extra decks, and config across.
try {
  const oldStateDir = path.join(home, ".wait-and-learn");
  if (!fs.existsSync(stateDir) && fs.existsSync(oldStateDir)) fs.renameSync(oldStateDir, stateDir);
} catch (e) {}

function writeAtomic(file, text) {
  const tmp = file + ".tmp." + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function readConfig() {
  if (fs.existsSync(configPath)) {
    try { return JSON.parse(fs.readFileSync(configPath, "utf8")) || {}; } catch (e) {}
  }
  return {};
}

try {
  // 1. Copy the runtime to the stable location.
  if (!fs.existsSync(runtimeSrc)) {
    console.log("Agora: bundled runtime not found at " + runtimeSrc + ". Aborting.");
    process.exit(1);
  }
  fs.mkdirSync(runtimeDst, { recursive: true });
  for (const f of fs.readdirSync(runtimeSrc)) {
    if (f.endsWith(".js") || f.endsWith(".mjs")) {
      fs.copyFileSync(path.join(runtimeSrc, f), path.join(runtimeDst, f));
    }
  }

  // Separate-terminal launcher, so the review loop never mixes with the work
  // chat. Lives at ~/.agora/agora (stable); the user aliases it.
  const launcherPath = path.join(stateDir, "agora");
  // Pick the interpreter by existence (not by exit code) and exec it, so Ctrl-C
  // quitting the interactive loop cannot fall through and relaunch a 2nd session.
  const launcher = [
    "#!/bin/sh",
    "# Agora terminal CLI - run in a SEPARATE terminal from your Claude Code work.",
    'RT="$HOME/.agora/runtime"',
    'if command -v bun >/dev/null 2>&1; then RUN=bun; else RUN=node; fi',
    'case "$1" in',
    '  review) exec "$RUN" "$RT/review.mjs" ;;',
    '  stats) exec "$RUN" "$RT/stats.mjs" ;;',
    '  deck) shift; exec "$RUN" "$RT/deck.mjs" "$@" ;;',
    '  pause) exec "$RUN" "$RT/pause.mjs" pause ;;',
    '  resume) exec "$RUN" "$RT/pause.mjs" resume ;;',
    '  *) echo "Agora: agora review | agora stats | agora deck [lang] | agora pause | agora resume" ;;',
    "esac",
    ""
  ].join("\n");
  let launcherOk = false;
  try { fs.writeFileSync(launcherPath, launcher); fs.chmodSync(launcherPath, 0o755); launcherOk = true; } catch (e) {}

  const cfg = readConfig();

  // 2. Read settings.json once (shared by both modes). Never clobber bad JSON.
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  let settings = {};
  let existed = false;
  let rawSettings = "";
  if (fs.existsSync(settingsPath)) {
    existed = true;
    rawSettings = fs.readFileSync(settingsPath, "utf8");
    try {
      settings = JSON.parse(rawSettings);
    } catch (e) {
      console.log("Agora: ~/.claude/settings.json is not valid JSON; aborting without changes.");
      process.exit(1);
    }
  }

  // Detect OUR status line (current path, or our pre-rebrand path) so we never
  // treat a migrating install as foreign and never touch a genuinely foreign bar.
  const interp = process.execPath; // absolute path to bun or node
  const statuslinePath = path.join(runtimeDst, "statusline.mjs");
  const slCommand = `"${interp}" "${statuslinePath}"`;
  const oldStatuslinePath = path.join(home, ".wait-and-learn", "runtime", "statusline.mjs");
  const existingCmd = settings.statusLine && settings.statusLine.command;
  const ours = existingCmd &&
    (existingCmd.indexOf(statuslinePath) !== -1 || existingCmd.indexOf(oldStatuslinePath) !== -1);

  // Back up a foreign settings.json before we modify it (either mode). Not when
  // it's already ours (that would overwrite the user's original backup).
  if (existed && !ours) {
    writeAtomic(settingsPath + ".wl-backup", rawSettings);
  }

  // 3. SPINNER MODE: deck shows in the thinking spinner; status line stays the
  //    user's own (we only remove a status line WE installed).
  if (mode === "spinner") {
    let verbs = [];
    try {
      const settingsMod = await import(pathToFileURL(path.join(runtimeDst, "settings.mjs")).href);
      const storeMod = await import(pathToFileURL(path.join(runtimeDst, "store.mjs")).href);
      verbs = settingsMod.verbsForDeck(storeMod.deck);
    } catch (e) { verbs = []; }

    if (!verbs.length) {
      console.log("Agora: could not load a deck to show in the spinner. Aborting without changes.");
      process.exit(1);
    }

    if (ours && settings.statusLine) delete settings.statusLine; // drop only OUR bar
    settings.spinnerVerbs = { mode: "replace", verbs };
    writeAtomic(settingsPath, JSON.stringify(settings, null, 2) + "\n");

    cfg.mode = "spinner"; // recorded only after the settings write succeeded
    writeAtomic(configPath, JSON.stringify(cfg));

    console.log("✓ Agora installed (spinner mode).");
    console.log("  runtime:     " + runtimeDst);
    console.log("  spinner:     your deck (" + verbs.length + " words) now shows in Claude Code's thinking spinner.");
    if (existed && !ours) console.log("  backup:      " + settingsPath + ".wl-backup");
    console.log("  status line: " + (ours ? "Agora's status-line entry removed (back to default)." : "left untouched."));
    console.log("");
    console.log("Restart Claude Code to load it. Switch language with /agora:deck <language>.");
    console.log("");
    if (launcherOk) {
      console.log("Study (recall + grading) in a SEPARATE terminal, so it never mixes with");
      console.log("your work chat:  alias agora=\"$HOME/.agora/agora\"   then:  agora review");
    } else {
      console.log("Study in a SEPARATE terminal with:  bun ~/.agora/runtime/review.mjs");
    }
    process.exit(0);
  }

  // 4. STATUS-LINE MODE (default): the flashcard is the status line.
  let combined = false;
  if (existingCmd && !ours) {
    cfg.prevCommand = existingCmd; // keep the foreign bar; runtime prepends it
    combined = true;
  }
  const prevInterval = settings.statusLine && settings.statusLine.refreshInterval;
  settings.statusLine = {
    type: "command",
    command: slCommand,
    refreshInterval: typeof prevInterval === "number" ? prevInterval : 3
  };
  if (settings.spinnerVerbs) delete settings.spinnerVerbs; // leaving spinner mode

  writeAtomic(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  cfg.mode = "statusline";
  writeAtomic(configPath, JSON.stringify(cfg));

  const runtimeName = path.basename(interp);
  console.log("✓ Agora installed.");
  console.log("  runtime:     " + runtimeDst + "  (via " + runtimeName + ")");
  console.log("  status line: configured in ~/.claude/settings.json (refreshInterval " + settings.statusLine.refreshInterval + "s)");
  if (existed && !ours) console.log("  backup:      " + settingsPath + ".wl-backup");
  if (combined) {
    console.log("  combined:    your previous status line is kept; the flashcard is appended.");
  } else {
    console.log("  (no previous status line; the flashcard is your status line.)");
  }
  console.log("");
  console.log("Restart Claude Code to see it. Grade the shown word with:");
  console.log("  /agora:wl got      (you knew it)");
  console.log("  /agora:wl missed   (you didn't)");
  console.log("");
  console.log("Prefer it only while Claude thinks? Run /agora:setup spinner.");
  console.log("");
  if (launcherOk) {
    console.log("Tip: study in a SEPARATE terminal to keep this chat clean:");
    console.log("  alias agora=\"$HOME/.agora/agora\"   then:  agora review");
  } else {
    console.log("Tip: study in a SEPARATE terminal:  bun ~/.agora/runtime/review.mjs");
  }
} catch (e) {
  console.log("Agora setup failed: " + (e && e.message ? e.message : e));
  process.exit(1);
}
