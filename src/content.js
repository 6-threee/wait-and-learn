var WL = (typeof window !== "undefined") ? (window.WL = window.WL || {}) : {};

// content.js - wiring: Detector -> Scheduler/DeckStore -> Card.
// No exports. Fail silent throughout; never throw into the claude.ai page.
(function () {
  // Top-frame only. all_frames:false already prevents iframe injection;
  // this is belt-and-suspenders and also covers the hotkey listener below.
  if (window.top !== window) return;

  // now() - single place that wraps Date.now(), easy to stub.
  function now() {
    return Date.now();
  }

  // The card currently shown (if any), plus its state at pick time.
  // currentState is always a real state object (never undefined): we normalize
  // an unseen pick to Scheduler.newState(now()) so answer()/markSeen() always
  // receive a concrete state, regardless of whether they accept undefined.
  var currentId = null;
  var currentState = null;

  // True while Claude is generating (between Detector onStart and onEnd). Drives
  // the "keep feeding cards until done thinking" loop: after each answer, if we
  // are still generating, the next due card is shown.
  var generating = false;

  // Pick a due card and show it. Used by onStart and the dev hotkey.
  function pickAndShow() {
    try {
      // Don't stack a card on top of a visible one.
      if (WL.Card.isVisible()) return;

      var entries = WL.DeckStore.getEntries(); // [{ id, card, state }]
      // Scheduler.pickNext expects [{ id, state }] (state may be undefined).
      var id = WL.Scheduler.pickNext(
        entries.map(function (e) { return { id: e.id, state: e.state }; }),
        now()
      );
      if (id === null || id === undefined) return;

      var entry = entries.find(function (e) { return e.id === id; });
      if (!entry || !entry.card) return;

      currentId = entry.id;
      // Normalize unseen (undefined) state to a fresh box-1 state.
      currentState = entry.state || WL.Scheduler.newState(now());

      // lang lives at the deck level, not on the card; thread it onto the card
      // object so Card.show can render the FRONT-state language badge.
      var deck = WL.DeckStore.getActiveDeck();
      var card = entry.card;
      if (deck && deck.lang && !card.lang) {
        card = { id: card.id, front: card.front, back: card.back, example: card.example, lang: deck.lang };
      }

      WL.Card.show(card, { onAnswer: onAnswer });
    } catch (e) {
      // Fail silent - never throw into the page.
    }
  }

  // false -> true transition of "is generating".
  function onStart() {
    generating = true;
    pickAndShow();
  }

  // true -> false transition of "is generating".
  function onEnd() {
    try {
      // Generation is done: stop the card-feeding loop.
      generating = false;
      // Card revealed and waiting for an answer - keep it, don't lose the rep.
      if (WL.Card.isAwaitingAnswer()) return;
      // Card shown but still on FRONT (unanswered) - mark seen so it isn't
      // immediately re-picked, then dismiss.
      if (WL.Card.isVisible()) {
        var state = WL.Scheduler.markSeen(currentState, now());
        var id = currentId;
        WL.Card.dismiss();
        currentId = null;
        currentState = null;
        WL.DeckStore.saveState(id, state).catch(function () {});
      }
    } catch (e) {
      // Fail silent.
    }
  }

  // User tapped "Got it" / "Missed".
  function onAnswer(gotIt) {
    try {
      var state = WL.Scheduler.answer(currentState, gotIt, now());
      var id = currentId;
      WL.Card.dismiss();
      currentId = null;
      currentState = null;
      WL.DeckStore.saveState(id, state).catch(function () {});

      // Keep going while Claude is still thinking: after the current card fades
      // out, show the next due card. Guarded so a generation that ended during
      // the delay does not pop one more card after Claude finished.
      if (generating) {
        setTimeout(function () {
          if (generating && !WL.Card.isVisible()) pickAndShow();
        }, 220);
      }
    } catch (e) {
      // Fail silent.
    }
  }

  // Dev hotkey: Ctrl+Shift+L (or Cmd+Shift+L on Mac) - force-pick & show a
  // card, and log the match-state of every candidate selector so the live
  // selector can be confirmed in one session.
  function onKeyDown(ev) {
    try {
      // Accept Control OR Command: on macOS users naturally press Cmd, which
      // sets metaKey (not ctrlKey). Without metaKey the hotkey silently no-ops.
      if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key && ev.key.toLowerCase() === "l") {
        ev.preventDefault();
        pickAndShow();
        console.table(WL.Detector.debugSelectors());
      }
    } catch (e) {
      // Fail silent.
    }
  }

  // Boot.
  (function init() {
    try {
      WL.DeckStore.init()
        .then(function () {
          WL.Detector.start({ onStart: onStart, onEnd: onEnd });
          document.addEventListener("keydown", onKeyDown, true);
        })
        .catch(function () {
          // init failed - never throw into the page; no card will show.
        });
    } catch (e) {
      // Fail silent.
    }
  })();
})();
