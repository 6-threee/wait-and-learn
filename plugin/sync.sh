#!/bin/sh
# Refresh the plugin's bundled runtime from the project source.
# Plugins must be self-contained (they can't reference files outside their dir),
# so the deck + scheduler + terminal scripts are copied flat into runtime/.
# Run after changing any of those source files.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
mkdir -p "$DIR/runtime"
cp "$ROOT/src/scheduler.js"            "$DIR/runtime/scheduler.js"
cp "$ROOT/decks/spanish-starter.js"    "$DIR/runtime/spanish-starter.js"
cp "$ROOT/terminal/store.mjs"           "$DIR/runtime/store.mjs"
cp "$ROOT/terminal/statusline.mjs"      "$DIR/runtime/statusline.mjs"
cp "$ROOT/terminal/grade.mjs"           "$DIR/runtime/grade.mjs"
cp "$ROOT/terminal/deck.mjs"            "$DIR/runtime/deck.mjs"
cp "$ROOT/terminal/settings.mjs"        "$DIR/runtime/settings.mjs"
cp "$ROOT/terminal/review.mjs"          "$DIR/runtime/review.mjs"
cp "$ROOT/terminal/stats.mjs"           "$DIR/runtime/stats.mjs"
echo "Synced plugin/runtime/ from source:"
ls -1 "$DIR/runtime"
