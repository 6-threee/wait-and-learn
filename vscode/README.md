# Agora — Flashcards while Claude thinks

*Agora* means "now" in Portuguese. While Claude generates a response, its
"thinking" spinner shows a flashcard from your deck (`hola → hello`) instead of
the stock `Discombobulating…` verbs. Free, no ads, no account, nothing leaves
your machine.

## How it works (and what it changes)

Claude Code's VS Code panel keeps its thinking verbs hardcoded in its own
bundle, with no setting to change them. So Agora **modifies Claude Code's
installed extension files on disk** to swap in your deck's `front → back` pairs.

Because that is invasive, Agora **asks for your consent on first run and never
patches silently.** The change is:

- **Reversible on a clean disable/shutdown.** The original verbs are backed up
  before the first patch. "Agora: Disable" restores them byte-for-byte, and so
  does a normal VS Code shutdown.
- **Self-healing.** When Claude Code updates, its bundle is rewritten and the
  patch is re-applied on the next VS Code start (if enabled).
- **Safe.** Agora fails closed: if it cannot write the backup, or cannot
  confidently locate the verb pool, it changes nothing.

**Honest limitation:** if VS Code crashes or is force-quit (so the clean
shutdown restore never runs) and you then uninstall Agora, or if the backup file
is lost, the patch can remain in Claude Code until you reinstall Claude Code or
restore the file manually. The patched bundle is still valid and Claude Code
keeps working; it just shows the flashcard verbs.

## Commands

- **Agora: Switch Language** — pick Spanish, French, or German.
- **Agora: Disable** — restore Claude Code's own thinking verbs.
- **Agora: Enable** — turn the flashcards on.

After enabling or switching, reload the window (or restart the Claude Code
panel) so it picks up the new verbs.

## Note

Modifying another extension's files is the only way to reach the VS Code
thinking spinner (the terminal CLI has a supported `spinnerVerbs` setting; the
webview does not). It depends on Claude Code's internal layout and may need an
update if that layout changes.

The richer flashcard experience (tap-to-reveal, spaced repetition, grading)
lives in the companion browser extension and Claude Code terminal status line.

MIT licensed. Not affiliated with Anthropic.
