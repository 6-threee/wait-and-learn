// Agora - list your decks or switch the active one.
//   deck            list available decks (→ marks the active one)
//   deck <word>     switch active deck, matched by language code, id, or name
// Pro decks appear here once their files are in ~/.agora/decks/.
import fs from "fs";
import os from "os";
import path from "path";
import { decks, deck as activeDeck, saveRhythm } from "./store.mjs";

const arg = String(process.argv.slice(2).join(" ") || "").trim().toLowerCase();
const cfgPath = path.join(os.homedir(), ".agora", "config.json");

function readCfg() { try { return JSON.parse(fs.readFileSync(cfgPath, "utf8")) || {}; } catch (e) { return {}; } }
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
  if (!decks || !decks.length) {
    console.log("Agora: no decks found. Run /agora:setup first.");
    process.exit(0);
  }

  if (!arg) {
    const lines = decks.map(function (d) {
      const mark = (activeDeck && d.id === activeDeck.id) ? "→" : " ";
      return ` ${mark} ${d.name}  (${d.lang}, ${d.cards.length} cards)`;
    });
    const pro = decks.length > 1 ? "" : "\nUnlock more languages with Agora Pro.";
    console.log("Your decks:\n" + lines.join("\n") + "\n\nSwitch with: /agora:deck <language>" + pro);
    process.exit(0);
  }

  // Match by language code, exact id, then name/id substring.
  const match = decks.find(function (d) { return (d.lang || "").toLowerCase() === arg; })
    || decks.find(function (d) { return d.id.toLowerCase() === arg; })
    || decks.find(function (d) { return (d.name || "").toLowerCase().indexOf(arg) !== -1; })
    || decks.find(function (d) { return d.id.toLowerCase().indexOf(arg) !== -1; });

  if (!match) {
    console.log(`No deck matches "${arg}". Run /agora:deck to list them.`);
    process.exit(0);
  }

  const cfg = readCfg();
  cfg.activeDeck = match.id;
  if (!writeCfg(cfg)) {
    console.log("Agora: couldn't save your deck choice (disk write failed).");
    process.exit(0);
  }
  saveRhythm({}); // start the next refresh fresh on the new deck
  console.log(`\x1b[32m✓\x1b[0m active deck: ${match.name} (${match.lang}, ${match.cards.length} cards)`);
} catch (e) {
  console.log("Agora: deck switch failed.");
}
