var WL = (typeof window !== "undefined") ? (window.WL = window.WL || {}) : {};

// WL.Scheduler — pure Leitner-box spaced-repetition logic.
// No DOM, no storage, no randomness. Never mutates inputs; returns new objects.
WL.Scheduler = (function () {
  // Interval per box (ms): box 1 = 1 min ... box 5 = 4 days.
  var INTERVALS = {
    1: 60000,      // 1 minute
    2: 600000,     // 10 minutes
    3: 3600000,    // 1 hour
    4: 86400000,   // 1 day
    5: 345600000   // 4 days
  };

  // Fresh state for a never-seen card.
  function newState(now) {
    return { box: 1, dueAt: now, seen: 0, lastSeen: 0 };
  }

  // Normalize a (possibly undefined) state into the fields pickNext sorts on.
  // Unseen / undefined → treated as due: dueAt = 0, lastSeen = 0.
  function normalize(state) {
    if (!state) {
      return { box: 1, dueAt: 0, lastSeen: 0 };
    }
    return {
      box: typeof state.box === "number" ? state.box : 1,
      dueAt: typeof state.dueAt === "number" ? state.dueAt : 0,
      lastSeen: typeof state.lastSeen === "number" ? state.lastSeen : 0
    };
  }

  // Choose the next card id from entries: [{ id, state }].
  // Returns the chosen id, or null if entries is empty.
  function pickNext(entries, now) {
    if (!entries || entries.length === 0) {
      return null;
    }

    // Preserve original order as the final, fully deterministic tiebreak.
    var items = entries.map(function (entry, index) {
      return { id: entry.id, n: normalize(entry.state), index: index };
    });

    var due = items.filter(function (item) {
      return item.n.dueAt <= now;
    });

    if (due.length > 0) {
      // Due ordering: dueAt asc, then box asc, then lastSeen asc, then original index.
      due.sort(function (a, b) {
        if (a.n.dueAt !== b.n.dueAt) return a.n.dueAt - b.n.dueAt;
        if (a.n.box !== b.n.box) return a.n.box - b.n.box;
        if (a.n.lastSeen !== b.n.lastSeen) return a.n.lastSeen - b.n.lastSeen;
        return a.index - b.index;
      });
      return due[0].id;
    }

    // None due → fall back to least-recently-seen (smallest lastSeen, unseen first).
    items.sort(function (a, b) {
      if (a.n.lastSeen !== b.n.lastSeen) return a.n.lastSeen - b.n.lastSeen;
      return a.index - b.index;
    });
    return items[0].id;
  }

  // Apply an answer to a state. gotIt → promote (box + 1, clamped at 5); else demote to box 1.
  // dueAt = now + INTERVALS[newBox]; seen incremented; lastSeen = now.
  function answer(state, gotIt, now) {
    var base = state || newState(now);
    var newBox = gotIt ? Math.min(base.box + 1, 5) : 1;
    return {
      box: newBox,
      dueAt: now + INTERVALS[newBox],
      seen: (typeof base.seen === "number" ? base.seen : 0) + 1,
      lastSeen: now
    };
  }

  // Record that a card was shown but not answered: update lastSeen only.
  // box / dueAt / seen unchanged. Accepts undefined state (creates a fresh one first).
  function markSeen(state, now) {
    var base = state || newState(now);
    return {
      box: base.box,
      dueAt: base.dueAt,
      seen: base.seen,
      lastSeen: now
    };
  }

  return {
    INTERVALS: INTERVALS,
    newState: newState,
    pickNext: pickNext,
    answer: answer,
    markSeen: markSeen
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = WL.Scheduler;
