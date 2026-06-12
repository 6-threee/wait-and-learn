import { test, expect } from "bun:test";
const Scheduler = require("/Users/jonathanluis/Desktop/wait-and-learn/src/scheduler.js");

const I = Scheduler.INTERVALS;

test("INTERVALS map matches the contract (ms per box)", () => {
  expect(I).toEqual({
    1: 60000,
    2: 600000,
    3: 3600000,
    4: 86400000,
    5: 345600000
  });
});

test("newState returns fresh box-1 state with dueAt = now", () => {
  const now = 1000;
  expect(Scheduler.newState(now)).toEqual({ box: 1, dueAt: now, seen: 0, lastSeen: 0 });
});

test("pickNext returns null for empty entries", () => {
  expect(Scheduler.pickNext([], 5000)).toBeNull();
});

test("pickNext treats undefined / unseen state as due (dueAt=0, lastSeen=0)", () => {
  const now = 5000;
  // Single unseen card is due even though now is well past 0.
  expect(Scheduler.pickNext([{ id: "a", state: undefined }], now)).toBe("a");
});

test("pickNext due-ordering: dueAt asc wins first", () => {
  const now = 1000000;
  const entries = [
    { id: "later", state: { box: 1, dueAt: 500, seen: 1, lastSeen: 500 } },
    { id: "earlier", state: { box: 1, dueAt: 100, seen: 1, lastSeen: 100 } }
  ];
  expect(Scheduler.pickNext(entries, now)).toBe("earlier");
});

test("pickNext due-ordering: equal dueAt -> lower box wins", () => {
  const now = 1000000;
  const entries = [
    { id: "hi", state: { box: 4, dueAt: 200, seen: 3, lastSeen: 50 } },
    { id: "lo", state: { box: 2, dueAt: 200, seen: 3, lastSeen: 90 } }
  ];
  expect(Scheduler.pickNext(entries, now)).toBe("lo");
});

test("pickNext due-ordering: equal dueAt and box -> smaller lastSeen wins", () => {
  const now = 1000000;
  const entries = [
    { id: "recent", state: { box: 2, dueAt: 200, seen: 3, lastSeen: 900 } },
    { id: "stale", state: { box: 2, dueAt: 200, seen: 3, lastSeen: 100 } }
  ];
  expect(Scheduler.pickNext(entries, now)).toBe("stale");
});

test("pickNext: only due cards are eligible when some are due", () => {
  const now = 1000;
  const entries = [
    { id: "notdue", state: { box: 3, dueAt: 5000, seen: 2, lastSeen: 50 } },
    { id: "due", state: { box: 5, dueAt: 1000, seen: 2, lastSeen: 999 } }
  ];
  // notdue has dueAt 5000 > now, so it is excluded even though it sorts earlier on box.
  expect(Scheduler.pickNext(entries, now)).toBe("due");
});

test("pickNext: when none are due, falls back to least-recently-seen", () => {
  const now = 1000;
  const entries = [
    { id: "recent", state: { box: 2, dueAt: 9000, seen: 5, lastSeen: 800 } },
    { id: "oldest", state: { box: 4, dueAt: 8000, seen: 5, lastSeen: 200 } },
    { id: "middle", state: { box: 3, dueAt: 7000, seen: 5, lastSeen: 500 } }
  ];
  expect(Scheduler.pickNext(entries, now)).toBe("oldest");
});

test("pickNext: none-due fallback puts unseen (lastSeen 0) first", () => {
  const now = 1000;
  const entries = [
    { id: "seen", state: { box: 2, dueAt: 9000, seen: 1, lastSeen: 300 } },
    { id: "unseen-but-future", state: { box: 1, dueAt: 9000, seen: 0, lastSeen: 0 } }
  ];
  expect(Scheduler.pickNext(entries, now)).toBe("unseen-but-future");
});

test("pickNext is deterministic across repeated calls", () => {
  const now = 1000000;
  const entries = [
    { id: "a", state: { box: 2, dueAt: 200, seen: 1, lastSeen: 100 } },
    { id: "b", state: { box: 2, dueAt: 200, seen: 1, lastSeen: 100 } },
    { id: "c", state: undefined }
  ];
  const first = Scheduler.pickNext(entries, now);
  for (let i = 0; i < 25; i++) {
    expect(Scheduler.pickNext(entries, now)).toBe(first);
  }
});

test("answer: gotIt promotes box +1 and sets dueAt by new box", () => {
  const now = 1000000;
  const state = { box: 2, dueAt: 5, seen: 3, lastSeen: 40 };
  const next = Scheduler.answer(state, true, now);
  expect(next.box).toBe(3);
  expect(next.dueAt).toBe(now + I[3]);
  expect(next.seen).toBe(4);
  expect(next.lastSeen).toBe(now);
});

test("answer: promotion clamps box at 5", () => {
  const now = 2000000;
  const state = { box: 5, dueAt: 5, seen: 7, lastSeen: 40 };
  const next = Scheduler.answer(state, true, now);
  expect(next.box).toBe(5);
  expect(next.dueAt).toBe(now + I[5]);
  expect(next.seen).toBe(8);
  expect(next.lastSeen).toBe(now);
});

test("answer: miss demotes to box 1 with box-1 interval", () => {
  const now = 3000000;
  const state = { box: 4, dueAt: 5, seen: 9, lastSeen: 40 };
  const next = Scheduler.answer(state, false, now);
  expect(next.box).toBe(1);
  expect(next.dueAt).toBe(now + I[1]);
  expect(next.seen).toBe(10);
  expect(next.lastSeen).toBe(now);
});

test("answer: accepts undefined state (starts from a fresh box-1 state)", () => {
  const now = 4000000;
  const next = Scheduler.answer(undefined, true, now);
  // Fresh box 1, promoted to box 2.
  expect(next.box).toBe(2);
  expect(next.dueAt).toBe(now + I[2]);
  expect(next.seen).toBe(1);
  expect(next.lastSeen).toBe(now);
});

test("answer: does not mutate the input state", () => {
  const now = 5000000;
  const state = { box: 2, dueAt: 5, seen: 3, lastSeen: 40 };
  const snapshot = { box: 2, dueAt: 5, seen: 3, lastSeen: 40 };
  Scheduler.answer(state, true, now);
  expect(state).toEqual(snapshot);
});

test("markSeen: updates lastSeen, leaves box/dueAt/seen unchanged", () => {
  const now = 6000000;
  const state = { box: 3, dueAt: 12345, seen: 4, lastSeen: 11 };
  const next = Scheduler.markSeen(state, now);
  expect(next.box).toBe(3);
  expect(next.dueAt).toBe(12345);
  expect(next.seen).toBe(4);
  expect(next.lastSeen).toBe(now);
});

test("markSeen: accepts undefined state (fresh state, then lastSeen = now)", () => {
  const now = 7000000;
  const next = Scheduler.markSeen(undefined, now);
  // Fresh state has dueAt = now and box 1, seen 0; lastSeen set to now.
  expect(next.box).toBe(1);
  expect(next.dueAt).toBe(now);
  expect(next.seen).toBe(0);
  expect(next.lastSeen).toBe(now);
});

test("markSeen: does not mutate the input state", () => {
  const now = 8000000;
  const state = { box: 3, dueAt: 12345, seen: 4, lastSeen: 11 };
  const snapshot = { box: 3, dueAt: 12345, seen: 4, lastSeen: 11 };
  Scheduler.markSeen(state, now);
  expect(state).toEqual(snapshot);
});
