var WL = (typeof window !== "undefined") ? (window.WL = window.WL || {}) : {};

// WL.Detector — Approach A: watch the "generating" signal on claude.ai.
//
// This is the ONLY Claude-specific module. The selectors below are BEST-GUESS
// and MUST be confirmed against the live claude.ai DOM. Use the dev hotkey
// (Ctrl+Shift+L) which logs WL.Detector.debugSelectors() so every candidate
// selector's match-state is visible in one session. If claude.ai changes its
// markup, this CONFIG block is the one place to update.
(function () {
  "use strict";

  var CONFIG = {
    // If ANY of these matches a VISIBLE element, a generation is in progress.
    GENERATING_SELECTORS: [
      'button[aria-label*="Stop" i]',          // VERIFY on live claude.ai
      'button[aria-label*="stop response" i]', // VERIFY on live claude.ai
      '[data-testid*="stop" i]',               // VERIFY on live claude.ai
      '[data-testid*="thinking" i]'            // VERIFY on live claude.ai (secondary: thinking indicator fallback)
    ],
    THROTTLE_MS: 150,    // re-evaluate at most this often on a burst of mutations
    START_DEBOUNCE_MS: 150, // signal must be true this long before onStart fires
    END_DEBOUNCE_MS: 400    // signal must be false this long before onEnd fires
  };

  // Live-evaluation state.
  var observer = null;
  var running = false;
  var callbacks = { onStart: null, onEnd: null };

  // Debounced "reported" state. Distinct from isGenerating() (which is always a
  // fresh live evaluation). This flag gates onStart/onEnd.
  var generating = false;
  var startTimer = null;
  var endTimer = null;

  // Throttle bookkeeping. lastEvalAt guards the leading edge; trailingTimer
  // guarantees a final evaluation so a suppressed last-mutation (e.g. the stop
  // button disappearing) still gets seen and can fire onEnd.
  var lastEvalAt = 0;
  var trailingTimer = null;

  function isVisible(el) {
    try {
      // getClientRects covers position:fixed elements (offsetParent does not).
      if (!el || el.getClientRects().length === 0) return false;
      var style = (el.ownerDocument && el.ownerDocument.defaultView)
        ? el.ownerDocument.defaultView.getComputedStyle(el)
        : null;
      if (style) {
        if (style.visibility === "hidden" || style.display === "none") return false;
        if (parseFloat(style.opacity) === 0) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Live evaluation: true if any candidate selector matches a visible element.
  function evaluate() {
    try {
      for (var i = 0; i < CONFIG.GENERATING_SELECTORS.length; i++) {
        var nodes;
        try {
          nodes = document.querySelectorAll(CONFIG.GENERATING_SELECTORS[i]);
        } catch (e) {
          continue; // bad/unsupported selector — skip, never throw
        }
        for (var j = 0; j < nodes.length; j++) {
          if (isVisible(nodes[j])) return true;
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  // Apply a fresh live signal to the debounced reported state.
  function applySignal(signal) {
    try {
      if (signal) {
        // Cancel any pending "end" — we are (still) generating.
        if (endTimer !== null) {
          clearTimeout(endTimer);
          endTimer = null;
        }
        if (!generating && startTimer === null) {
          startTimer = setTimeout(function () {
            startTimer = null;
            if (!generating && evaluate()) {
              generating = true;
              fire(callbacks.onStart);
            }
          }, CONFIG.START_DEBOUNCE_MS);
        }
      } else {
        // Cancel any pending "start" — signal dropped before it stabilized.
        if (startTimer !== null) {
          clearTimeout(startTimer);
          startTimer = null;
        }
        if (generating && endTimer === null) {
          endTimer = setTimeout(function () {
            endTimer = null;
            if (generating && !evaluate()) {
              generating = false;
              fire(callbacks.onEnd);
            }
          }, CONFIG.END_DEBOUNCE_MS);
        }
      }
    } catch (e) {
      // fail silent
    }
  }

  function fire(fn) {
    if (typeof fn !== "function") return;
    try {
      fn();
    } catch (e) {
      // never let a callback throw into the page
    }
  }

  // Recompute now: read the live signal and push it through the debounce.
  function recompute() {
    applySignal(evaluate());
  }

  // Throttled entry point for the observer. Leading-edge eval plus a guaranteed
  // trailing eval so the final suppressed mutation is never lost.
  function onMutations() {
    try {
      var now = Date.now();
      var since = now - lastEvalAt;
      if (since >= CONFIG.THROTTLE_MS) {
        lastEvalAt = now;
        if (trailingTimer !== null) {
          clearTimeout(trailingTimer);
          trailingTimer = null;
        }
        recompute();
      } else if (trailingTimer === null) {
        trailingTimer = setTimeout(function () {
          trailingTimer = null;
          lastEvalAt = Date.now();
          recompute();
        }, CONFIG.THROTTLE_MS - since);
      }
    } catch (e) {
      // fail silent
    }
  }

  function start(opts) {
    try {
      // Top-frame only — no-op inside iframes.
      if (window.top !== window) return;
      if (running) return;

      opts = opts || {};
      callbacks.onStart = typeof opts.onStart === "function" ? opts.onStart : null;
      callbacks.onEnd = typeof opts.onEnd === "function" ? opts.onEnd : null;

      if (!document.body) return; // nothing to observe; fail silent

      observer = new MutationObserver(onMutations);
      observer.observe(document.body, { childList: true, subtree: true });
      running = true;

      // Catch a page that loaded mid-generation (observer only sees future
      // mutations).
      lastEvalAt = Date.now();
      recompute();
    } catch (e) {
      // fail silent
    }
  }

  function stop() {
    try {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (startTimer !== null) { clearTimeout(startTimer); startTimer = null; }
      if (endTimer !== null) { clearTimeout(endTimer); endTimer = null; }
      if (trailingTimer !== null) { clearTimeout(trailingTimer); trailingTimer = null; }
      generating = false;
      lastEvalAt = 0;
      running = false;
    } catch (e) {
      // fail silent
    }
  }

  // Current live evaluation (NOT the debounced reported flag). Used by the dev
  // hotkey/tests.
  function isGenerating() {
    return evaluate();
  }

  // Evaluate EVERY candidate selector right now. count = raw querySelectorAll
  // length; matched = at least one VISIBLE match (mirrors detection logic).
  function debugSelectors() {
    var out = [];
    var list = CONFIG.GENERATING_SELECTORS;
    for (var i = 0; i < list.length; i++) {
      var selector = list[i];
      var count = 0;
      var matched = false;
      try {
        var nodes = document.querySelectorAll(selector);
        count = nodes.length;
        for (var j = 0; j < nodes.length; j++) {
          if (isVisible(nodes[j])) { matched = true; break; }
        }
      } catch (e) {
        count = 0;
        matched = false;
      }
      out.push({ selector: selector, matched: matched, count: count });
    }
    return out;
  }

  WL.Detector = {
    CONFIG: CONFIG,
    start: start,
    stop: stop,
    isGenerating: isGenerating,
    debugSelectors: debugSelectors
  };
})();
