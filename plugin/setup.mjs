// Agora plugin installer. Run by the /agora:setup command.
// - Copies the bundled runtime to a STABLE dir (~/.agora/runtime/),
//   because the plugin's own install path is ephemeral (changes on update).
// - Configures statusLine in ~/.claude/settings.json, preserving any existing
//   one in "combined mode" (the previous bar is kept, the flashcard appended).
// - Backs up settings.json first; aborts without changes if it can't be parsed.
// Node + bun compatible. Fail-loud (this is an explicit user action), but never
// leaves settings.json half-written.
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runtimeSrc = path.join(HERE, "runtime");
const home = os.homedir();
const stateDir = path.join(home, ".agora");
const runtimeDst = path.join(stateDir, "runtime");
const settingsPath = path.join(home, ".claude", "settings.json");
const configPath = path.join(stateDir, "config.json");

// One-time state-dir migration (rename from the old brand to ~/.agora). Runs
// before the runtime copy creates ~/.agora, so re-running setup over an old
// install carries the user's SRS progress, Pro decks, and config across. Its
// own try/catch so a rename failure never aborts the otherwise fail-loud setup.
try {
  const oldStateDir = path.join(home, ".wait-and-learn");
  if (!fs.existsSync(stateDir) && fs.existsSync(oldStateDir)) fs.renameSync(oldStateDir, stateDir);
} catch (e) {}

function writeAtomic(file, text) {
  const tmp = file + ".tmp." + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

try {
  // 1. Copy the runtime to the stable location.
  if (!fs.existsSync(runtimeSrc)) {
    console.log("Agora: bundled runtime not found at " + runtimeSrc + ". Aborting.");
    process.exit(1);
  }
  fs.mkdirSync(runtimeDst, { recursive: true });
  for (const f of fs.readdirSync(runtimeSrc)) {
    // .mjs = ESM runtime, .js = the CommonJS scheduler + deck.
    if (f.endsWith(".js") || f.endsWith(".mjs")) {
      fs.copyFileSync(path.join(runtimeSrc, f), path.join(runtimeDst, f));
    }
  }

  // 2. The interpreter that ran this script is the one to use for the status line.
  const interp = process.execPath; // absolute path to bun or node
  const statuslinePath = path.join(runtimeDst, "statusline.mjs");
  const slCommand = `"${interp}" "${statuslinePath}"`;

  // 3. Read existing settings (or start fresh). Never clobber unparseable JSON.
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

  // 4. Combined mode: if there is an existing status line that is not ours,
  //    keep it (the runtime prepends its output before the flashcard).
  let combined = false;
  const existingCmd = settings.statusLine && settings.statusLine.command;
  const ours = existingCmd && existingCmd.indexOf(statuslinePath) !== -1;

  // Back up settings BEFORE writing, but only when we are not re-running over our
  // own install. Re-running would otherwise overwrite the user's original backup
  // with our-command settings, breaking the documented restore path.
  if (existed && !ours) {
    writeAtomic(settingsPath + ".wl-backup", rawSettings);
  }

  if (existingCmd && !ours) {
    let cfg = {};
    if (fs.existsSync(configPath)) {
      try { cfg = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch (e) { cfg = {}; }
    }
    cfg.prevCommand = existingCmd;
    fs.mkdirSync(stateDir, { recursive: true });
    writeAtomic(configPath, JSON.stringify(cfg));
    combined = true;
  }

  // 5. Set the status line, preserving any chosen refresh interval.
  const prevInterval = settings.statusLine && settings.statusLine.refreshInterval;
  settings.statusLine = {
    type: "command",
    command: slCommand,
    refreshInterval: typeof prevInterval === "number" ? prevInterval : 3
  };

  // 6. Write settings atomically (preserves all other keys).
  writeAtomic(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  // 7. Report.
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
} catch (e) {
  console.log("Agora setup failed: " + (e && e.message ? e.message : e));
  process.exit(1);
}
