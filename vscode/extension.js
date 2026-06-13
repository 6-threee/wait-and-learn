// Agora ("now" in Portuguese) - shows language flashcards in Claude Code's
// thinking spinner. While Claude generates, the spinner shows a flashcard from
// your deck ("hola -> hello") instead of the stock "Discombobulating..." verbs.
//
// To reach the VS Code thinking spinner there is no supported setting, so Agora
// patches Claude Code's installed extension bundle. That is invasive, so it asks
// for explicit consent on first run and never patches silently. It reverts
// cleanly on disable and on a normal shutdown.

const vscode = require("vscode");
const fs = require("fs");
const { DECKS, getDeck, verbsFromDeck } = require("./lib/decks");
const patcher = require("./lib/patcher");

const ENABLED_KEY = "agora.enabled"; // true | false | undefined (undefined = never asked)
let STATE_DIR = null; // stashed for deactivate(), which has no context

function deckKey() {
  return vscode.workspace.getConfiguration("agora").get("deck", "spanish");
}

function apply(notify) {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch (e) {}
  const key = deckKey();
  const verbs = verbsFromDeck(getDeck(key));
  const res = patcher.patchAll(verbs, STATE_DIR);
  if (notify) {
    if (res.patched > 0) {
      vscode.window.showInformationMessage(
        "Agora: " + getDeck(key).name + " is now in Claude Code's thinking spinner. " +
        "Reload the window (or restart the Claude Code panel) to load it."
      );
    } else if (res.found === 0) {
      vscode.window.showWarningMessage("Agora: Claude Code does not appear to be installed, so there is nothing to patch yet.");
    } else {
      vscode.window.showWarningMessage("Agora: could not patch Claude Code (its layout may have changed in this version, or the backup could not be written). Nothing was modified.");
    }
  }
  return res;
}

// First run: get explicit, informed consent before touching Claude Code's files.
async function promptFirstRun(context) {
  const choice = await vscode.window.showInformationMessage(
    "Agora shows language flashcards in Claude Code's thinking spinner. To do that it modifies " +
    "Claude Code's installed extension files on disk. This is reversible (\"Agora: Disable\" restores " +
    "them, and so does a normal shutdown) and re-applies after Claude Code updates. Enable it now?",
    { modal: true },
    "Enable", "Not now"
  );
  if (choice === "Enable") {
    await context.globalState.update(ENABLED_KEY, true);
    apply(true);
  } else {
    await context.globalState.update(ENABLED_KEY, false);
    vscode.window.showInformationMessage("Agora: left Claude Code untouched. Run \"Agora: Enable\" anytime to turn it on.");
  }
}

function activate(context) {
  STATE_DIR = context.globalStorageUri.fsPath;

  const enabled = context.globalState.get(ENABLED_KEY);
  if (enabled === true) {
    apply(false);            // returning user who opted in
  } else if (enabled === undefined) {
    promptFirstRun(context); // never asked: get consent, do not patch silently
  }                          // enabled === false: stay off

  context.subscriptions.push(
    vscode.commands.registerCommand("agora.enable", async () => {
      await context.globalState.update(ENABLED_KEY, true);
      apply(true);
    }),
    vscode.commands.registerCommand("agora.disable", async () => {
      await context.globalState.update(ENABLED_KEY, false);
      const res = patcher.revertAll(STATE_DIR);
      const failed = (res.details || []).filter(function (d) {
        return d.status === "no-backup" || d.status === "read-failed" || d.status === "threw";
      }).length;
      let msg = "Agora: restored Claude Code's own thinking verbs (" + res.reverted + " install(s)).";
      if (failed > 0) {
        msg += " " + failed + " install(s) could NOT be restored (no backup found); reinstall Claude Code to fully revert.";
      }
      msg += " Reload the window to see it take effect.";
      vscode.window.showInformationMessage(msg);
    }),
    vscode.commands.registerCommand("agora.switchLanguage", async () => {
      const items = Object.keys(DECKS).map(function (k) { return { label: DECKS[k].name, key: k }; });
      const pick = await vscode.window.showQuickPick(items, { placeHolder: "Pick a language deck" });
      if (!pick) return;
      await vscode.workspace.getConfiguration("agora").update("deck", pick.key, vscode.ConfigurationTarget.Global);
      await context.globalState.update(ENABLED_KEY, true);
      apply(true);
    })
  );
}

function deactivate() {
  // Best-effort: leave Claude Code clean when Agora stops (including uninstall
  // within the session). VS Code does not guarantee this runs on a crash or
  // force-quit; in that case the next activate re-applies (if enabled) and a
  // clean disable/shutdown later still restores the original.
  try { if (STATE_DIR) patcher.revertAll(STATE_DIR); } catch (e) {}
}

module.exports = { activate, deactivate };
