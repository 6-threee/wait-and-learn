// Agora - pause / resume the flashcards (focus mode).
//   pause   hide the cards; resume   bring them back.
//
// Status-line mode: the status line checks this flag every refresh, so pausing
// clears it within a few seconds (live). Spinner mode: Claude Code reads the
// spinner words at launch, so pause removes them but the running session may not
// clear until the next Claude Code restart; resume re-applies them.
import fs from "fs";
import os from "os";
import path from "path";
import { deck, loadConfig } from "./store.mjs";
import { applySpinner, clearSpinner, verbsForDeck } from "./settings.mjs";

const action = String(process.argv[2] || "").trim().toLowerCase() === "resume" ? "resume" : "pause";
const cfgPath = path.join(os.homedir(), ".agora", "config.json");

function writeCfg(o) {
  try {
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    const tmp = cfgPath + ".tmp." + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(o));
    fs.renameSync(tmp, cfgPath);
    return true;
  } catch (e) { try { fs.unlinkSync(cfgPath + ".tmp." + process.pid); } catch (e2) {} return false; }
}

try {
  const cfg = loadConfig();
  const spinner = cfg.mode === "spinner";

  if (action === "pause") {
    cfg.paused = true;
    writeCfg(cfg);
    if (spinner) clearSpinner();
    console.log("\x1b[2m⏸ Agora paused. Flashcards hidden." +
      (spinner ? " (spinner clears on the next Claude Code restart)" : " (status line clears within a few seconds)") +
      " Resume with /agora:resume.\x1b[0m");
  } else {
    cfg.paused = false;
    writeCfg(cfg);
    if (spinner) applySpinner(verbsForDeck(deck));
    console.log("\x1b[2m▶ Agora resumed. Flashcards are back" +
      (spinner ? " (restart Claude Code if the spinner doesn't show them yet)." : ".") + "\x1b[0m");
  }
} catch (e) {
  console.log("Agora: pause/resume failed.");
}
