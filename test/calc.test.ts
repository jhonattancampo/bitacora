/* =========================================================
   calc.test.ts — The training maths behind the numbers the
   app shows: estimated 1RM, session volume, weekly sets and
   the personal record star.
   ========================================================= */
import { describe, expect, it } from "vitest";
import {
  bestE1RM,
  clamp,
  doneSessions,
  e1rm,
  lastPerf,
  num,
  sessionVolume,
  weeklySets,
  type Session,
} from "../src/lib/calc";

describe("num", () => {
  it("accepts both decimal separators, because the keyboard offers both", () => {
    expect(num("72,5")).toBe(72.5);
    expect(num("72.5")).toBe(72.5);
    expect(num(80)).toBe(80);
  });

  it("returns null for anything that is not a number", () => {
    expect(num("")).toBeNull();
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("pesado")).toBeNull();
  });

  it("keeps zero as zero, not as null", () => {
    expect(num("0")).toBe(0);
  });
});

describe("e1rm", () => {
  it("uses the Epley formula", () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.6667, 3);
    expect(e1rm(60, 12)).toBeCloseTo(84, 5);
  });

  it("returns the weight itself for a single rep", () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.3333, 3);
  });

  it("returns zero when either half of the set is missing", () => {
    expect(e1rm(0, 8)).toBe(0);
    expect(e1rm(80, 0)).toBe(0);
    expect(e1rm(0, 0)).toBe(0);
  });

  it("grows with reps at equal weight, which is what makes a set a record", () => {
    expect(e1rm(80, 9)).toBeGreaterThan(e1rm(80, 8));
    expect(e1rm(82.5, 8)).toBeGreaterThan(e1rm(80, 8));
  });
});

describe("clamp", () => {
  it("keeps a value inside its bounds", () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(210, 0, 100)).toBe(100);
  });
});

const session = (over: Partial<Session>): Session => ({
  id: "s",
  date: "2026-03-01",
  endedAt: 1,
  entries: [],
  ...over,
});

describe("sessionVolume", () => {
  it("counts only the sets that were actually marked done", () => {
    const s = session({
      entries: [
        {
          exerciseId: "banca",
          sets: [
            { w: "80", r: "8", done: true },
            { w: "80", r: "7", done: true },
            { w: "80", r: "6", done: false },
          ],
        },
      ],
    });
    expect(sessionVolume(s)).toEqual({ v: 80 * 8 + 80 * 7, sets: 2 });
  });

  it("adds up across exercises and survives commas in the inputs", () => {
    const s = session({
      entries: [
        { exerciseId: "banca", sets: [{ w: "82,5", r: "8", done: true }] },
        { exerciseId: "remo", sets: [{ w: "60", r: "10", done: true }] },
      ],
    });
    expect(sessionVolume(s)).toEqual({ v: 82.5 * 8 + 600, sets: 2 });
  });

  it("returns zero for a session with nothing logged", () => {
    expect(sessionVolume(session({ entries: [] }))).toEqual({ v: 0, sets: 0 });
    expect(sessionVolume(session({ entries: undefined }))).toEqual({ v: 0, sets: 0 });
  });

  it("treats a blank weight as zero rather than blowing up", () => {
    const s = session({
      entries: [{ exerciseId: "dominadas", sets: [{ w: "", r: "10", done: true }] }],
    });
    expect(sessionVolume(s)).toEqual({ v: 0, sets: 1 });
  });
});

describe("bestE1RM — the ★ personal record", () => {
  const history: Session[] = [
    session({
      id: "s1",
      date: "2026-02-01",
      entries: [{ exerciseId: "banca", sets: [{ w: "80", r: "8", done: true }] }],
    }),
    session({
      id: "s2",
      date: "2026-02-08",
      entries: [
        {
          exerciseId: "banca",
          sets: [
            { w: "85", r: "6", done: true },
            { w: "90", r: "6", done: false },
          ],
        },
      ],
    }),
  ];

  it("takes the best set ever recorded for that exercise", () => {
    expect(bestE1RM(history, "banca")).toBeCloseTo(e1rm(85, 6), 6);
  });

  it("ignores sets that were never marked done", () => {
    expect(bestE1RM(history, "banca")).toBeLessThan(e1rm(90, 6));
  });

  it("ignores unfinished sessions", () => {
    const withOpen = history.concat(
      session({
        id: "open",
        endedAt: null,
        entries: [{ exerciseId: "banca", sets: [{ w: "120", r: "10", done: true }] }],
      }),
    );
    expect(bestE1RM(withOpen, "banca")).toBeCloseTo(e1rm(85, 6), 6);
  });

  it("excludes the session in progress, so today's set can beat the record", () => {
    const today = session({
      id: "s3",
      date: "2026-02-15",
      entries: [{ exerciseId: "banca", sets: [{ w: "87,5", r: "6", done: true }] }],
    });
    const all = history.concat(today);
    const previous = bestE1RM(all, "banca", "s3");
    expect(previous).toBeCloseTo(e1rm(85, 6), 6);
    expect(e1rm(87.5, 6)).toBeGreaterThan(previous);
  });

  it("returns zero for an exercise with no history", () => {
    expect(bestE1RM(history, "sentadilla")).toBe(0);
  });
});

describe("doneSessions and lastPerf", () => {
  const history: Session[] = [
    session({
      id: "old",
      date: "2026-02-01",
      entries: [{ exerciseId: "banca", sets: [{ w: "75", r: "8", done: true }] }],
    }),
    session({
      id: "new",
      date: "2026-02-20",
      entries: [{ exerciseId: "banca", sets: [{ w: "82,5", r: "8", done: true }] }],
    }),
    session({ id: "open", date: "2026-02-25", endedAt: null, entries: [] }),
  ];

  it("lists finished sessions newest first", () => {
    expect(doneSessions(history).map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("breaks a same-day tie by start time, newest first", () => {
    const sameDay = [
      session({ id: "morning", date: "2026-03-01", startedAt: 100 }),
      session({ id: "evening", date: "2026-03-01", startedAt: 900 }),
    ];
    expect(doneSessions(sameDay).map((s) => s.id)).toEqual(["evening", "morning"]);
  });

  it("finds the most recent time the exercise was actually performed", () => {
    expect(lastPerf(history, "banca")?.date).toBe("2026-02-20");
    expect(lastPerf(history, "banca")?.sets).toEqual([{ w: "82,5", r: "8", done: true }]);
  });

  it("skips the session in progress so you compare against the previous one", () => {
    expect(lastPerf(history, "banca", "new")?.date).toBe("2026-02-01");
  });

  it("skips sessions where the exercise was loaded but never done", () => {
    const skipped = [
      session({
        id: "skip",
        date: "2026-02-22",
        entries: [{ exerciseId: "banca", sets: [{ w: "80", r: "8", done: false }] }],
      }),
    ].concat(history);
    expect(lastPerf(skipped, "banca")?.date).toBe("2026-02-20");
  });

  it("returns null when the exercise was never trained", () => {
    expect(lastPerf(history, "sentadilla")).toBeNull();
  });
});

describe("weeklySets", () => {
  const exercises = [
    { id: "banca", name: "Press banca", group: "Pecho" },
    { id: "remo", name: "Remo", group: "Espalda" },
  ];
  const now = new Date("2026-03-01T12:00:00Z").getTime();

  it("counts completed sets per muscle group inside the window", () => {
    const sessions = [
      session({
        id: "a",
        date: "2026-02-27",
        entries: [
          { exerciseId: "banca", sets: [{ done: true }, { done: true }, { done: false }] },
          { exerciseId: "remo", sets: [{ done: true }] },
        ],
      }),
    ];
    const out = weeklySets(7, sessions, exercises, now);
    expect(out["Pecho"]).toBe(2);
    expect(out["Espalda"]).toBe(1);
  });

  it("leaves sessions older than the window out", () => {
    const sessions = [
      session({
        id: "old",
        date: "2026-01-01",
        entries: [{ exerciseId: "banca", sets: [{ done: true }] }],
      }),
    ];
    expect(weeklySets(7, sessions, exercises, now)["Pecho"]).toBe(0);
  });

  it("starts every known group at zero so the chart has no holes", () => {
    const out = weeklySets(7, [], exercises, now);
    expect(out["Gemelos"]).toBe(0);
    expect(Object.keys(out).length).toBeGreaterThan(10);
  });

  it("ignores entries whose exercise no longer exists", () => {
    const sessions = [
      session({
        id: "a",
        date: "2026-02-27",
        entries: [{ exerciseId: "borrado", sets: [{ done: true }] }],
      }),
    ];
    expect(() => weeklySets(7, sessions, exercises, now)).not.toThrow();
  });

  it("ignores sessions that were never finished", () => {
    const sessions = [
      session({
        id: "open",
        date: "2026-02-28",
        endedAt: null,
        entries: [{ exerciseId: "banca", sets: [{ done: true }] }],
      }),
    ];
    expect(weeklySets(7, sessions, exercises, now)["Pecho"]).toBe(0);
  });
});
