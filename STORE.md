# Chrome Web Store listing assets

Everything needed to publish Agora. The code is store-ready; this file holds the
copy, the data disclosures, and the asset checklist.

## One-time setup
- Register a Chrome Web Store developer account: **$5 one-time fee** (covers up to 20 extensions).
  https://developer.chrome.com/docs/webstore/register
- Zip the extension folder (everything except `docs/`, `test/`, `STORE.md`, `.git/`) and upload.

## Listing copy

**Name:** Agora: Flashcards while Claude thinks

**Summary (132 chars max):**
Turn Claude's thinking time into language practice. A spaced-repetition flashcard appears while Claude generates its reply.

**Description:**
Agora fills the few seconds while Claude is generating a response with one quick language
flashcard. See the word, try to recall it, tap to reveal the translation, and mark "Got it" or
"Missed". A lightweight spaced-repetition scheduler (Leitner boxes) shows the words you are still
learning more often.

- Tap-to-reveal active recall, the proven way to retain vocabulary
- Spaced repetition, all stored locally on your device
- Hear the word pronounced with your computer's built-in voices
- Cards keep coming for the whole time Claude is thinking
- Bring your own deck: import any language as a simple JSON word list
- Ships with a 40-word Spanish starter deck

Nothing leaves your device. No account, no tracking, no servers. The extension only runs on
claude.ai and only stores your review progress in local browser storage.

**Category:** Education
**Language:** English

## Privacy / data use disclosures
- **Does the extension collect user data?** No.
- **Data stored:** Only local spaced-repetition progress and the auto-speak preference, in
  `chrome.storage.local`. Never transmitted. No analytics, no network requests.
- **Permissions justification:**
  - `storage` - save review progress and settings on the device.
  - host permission `https://claude.ai/*` - the extension only runs on claude.ai, to detect when
    Claude is generating and show the card there.
- **Single purpose:** show language flashcards during Claude's generation time on claude.ai.

## Asset checklist
- [x] Icon 128x128 PNG (`icons/icon128.png`) plus 16/32/48 in the manifest.
- [ ] At least one screenshot, **1280x800** or **640x400** PNG/JPG. Capture the floating card on a
      real claude.ai page while Claude is generating. (The harness shots under `/tmp` are for QA,
      not the listing.)
- [ ] Small promo tile **440x280** (optional but recommended).
- [ ] Privacy policy URL if required by the dashboard (a short page stating "no data collected,
      all storage is local" suffices).

## Notes
- Each claude.ai DOM change that breaks the detector selector means publishing an update (re-review
  each time). For personal use, load-unpacked avoids this entirely.
- Bump `version` in `manifest.json` for every store update (currently 0.2.0).
