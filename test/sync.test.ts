/* =========================================================
   sync.test.ts — Two simulated devices against one fake cloud.
   These cover the failures that actually reached production:
     · a read served from IndexedDB reported as a successful sync
     · a promise that never settles leaving the app stuck "syncing"
     · conflicts resolved by "who synced last" instead of by clock
   ========================================================= */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { FakeServer, fakeBackend } from "./support/fake-firestore";
import { Client, emptyState, type AppState } from "./support/client";

const USER = { uid: "u1", email: "test@example.com" };
const T0 = new Date("2026-03-01T10:00:00Z").getTime();

let server: FakeServer;
let Sync: any;

/** A fresh module instance so no state leaks between tests. */
async function loadSync() {
  vi.resetModules();
  const mod = await import("../src/sync");
  mod.Sync._inject(fakeBackend(server), USER);
  return mod.Sync as any;
}

function stateWithRoutine(id: string, name: string): AppState {
  const s = emptyState();
  s.routines.push({ id, name, items: [] });
  return s;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  server = new FakeServer();
  Sync = await loadSync();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("first sync", () => {
  it("uploads everything this device has and marks it reconciled", async () => {
    const a = new Client(stateWithRoutine("r1", "A · Empuje"));
    a.activate();

    await Sync.run("test");

    expect(Sync.state.status).toBe("ok");
    expect(server.docs.has("rt_r1")).toBe(true);
    expect(server.docs.has("settings")).toBe(true);
    expect(a.shadow()["rt_r1"].t).toBe(T0);
    expect(a.lastPull()).toBe(T0);
  });

  it("only uploads finished sessions", async () => {
    const a = new Client(emptyState());
    a.state.sessions.push({ id: "s-open", date: "2026-03-01", endedAt: null, entries: [] });
    a.state.sessions.push({ id: "s-done", date: "2026-02-28", endedAt: T0 - 1000, entries: [] });
    a.activate();

    await Sync.run("test");

    expect(server.docs.has("se_s-done")).toBe(true);
    expect(server.docs.has("se_s-open")).toBe(false);
  });
});

describe("two devices", () => {
  it("carries a finished session from one device to the other", async () => {
    const a = new Client(emptyState());
    const b = new Client(emptyState());

    a.edit((s) => {
      s.sessions.push({
        id: "s1",
        date: "2026-03-01",
        name: "A · Empuje",
        endedAt: T0,
        entries: [{ exerciseId: "banca", sets: [{ w: "80", r: "8", done: true }] }],
      });
    }, Sync);
    await Sync.run("a-push");

    b.activate();
    await Sync.run("b-pull");

    expect(b.session("s1")).toBeTruthy();
    expect(b.session("s1").entries[0].sets[0].w).toBe("80");
    expect(b.adopted).toBe(1);
  });

  it("gives the routine to whichever device edited it last", async () => {
    const a = new Client(stateWithRoutine("r1", "original"));
    const b = new Client(emptyState());

    a.activate();
    await Sync.run("a-first");
    b.activate();
    await Sync.run("b-first");
    expect(b.routine("r1").name).toBe("original");

    // A edits and uploads.
    vi.setSystemTime(T0 + 1000);
    a.edit((s) => {
      s.routines[0].name = "editado en A";
    }, Sync);
    await Sync.run("a-push");
    expect((server.docs.get("rt_r1") as any).data.name).toBe("editado en A");

    // B edits the same routine afterwards, without having pulled A's version.
    vi.setSystemTime(T0 + 2000);
    b.edit((s) => {
      s.routines[0].name = "editado en B";
    }, Sync);

    vi.setSystemTime(T0 + 3000);
    b.activate();
    await Sync.run("b-push");

    // B edited last, so B wins — not "whoever synced last", which used to be
    // the rule and quietly swallowed the other device's work.
    expect((server.docs.get("rt_r1") as any).data.name).toBe("editado en B");
    expect(b.routine("r1").name).toBe("editado en B");

    vi.setSystemTime(T0 + 4000);
    a.activate();
    await Sync.run("a-pull");
    expect(a.routine("r1").name).toBe("editado en B");
  });

  it("discards the local edit when the other device edited the same thing later", async () => {
    const a = new Client(stateWithRoutine("r1", "original"));
    const b = new Client(emptyState());

    a.activate();
    await Sync.run("a-first");
    b.activate();
    await Sync.run("b-first");

    // B edits first...
    vi.setSystemTime(T0 + 1000);
    b.edit((s) => {
      s.routines[0].name = "editado en B";
    }, Sync);

    // ...A edits later and uploads before B gets a chance to.
    vi.setSystemTime(T0 + 2000);
    a.activate();
    a.edit((s) => {
      s.routines[0].name = "editado en A";
    }, Sync);
    await Sync.run("a-push");

    vi.setSystemTime(T0 + 3000);
    b.activate();
    await Sync.run("b-sync");

    expect(b.routine("r1").name).toBe("editado en A");
    expect((server.docs.get("rt_r1") as any).data.name).toBe("editado en A");
  });

  /* Known limitation, kept as an executable note rather than a silent gap.
     `updatedAt` is stamped when a document is UPLOADED, not when it was
     EDITED, so a device that edits and then stays offline for a while gets
     treated as if it had edited at upload time. When both sides edit while
     offline, the one that reconnects first wins regardless of who actually
     edited last. Fixing that means carrying the edit timestamp into the
     document, which is a behaviour change and belongs to a later phase.
     If this test starts failing, the fix landed — update it, do not delete it. */
  it("documents that updatedAt is the upload time, not the edit time", async () => {
    const a = new Client(stateWithRoutine("r1", "original"));
    const b = new Client(emptyState());

    a.activate();
    await Sync.run("a-first");
    b.activate();
    await Sync.run("b-first");

    // A edits first but stays offline.
    vi.setSystemTime(T0 + 1000);
    a.edit((s) => {
      s.routines[0].name = "editado en A";
    }, Sync);

    // B edits later, also offline.
    vi.setSystemTime(T0 + 2000);
    b.edit((s) => {
      s.routines[0].name = "editado en B";
    }, Sync);

    // A reconnects first: its upload is stamped T0+3000.
    vi.setSystemTime(T0 + 3000);
    a.activate();
    await Sync.run("a-push");

    vi.setSystemTime(T0 + 4000);
    b.activate();
    await Sync.run("b-sync");

    // By the wall clock B edited last, but A's upload time wins today.
    expect(b.routine("r1").name).toBe("editado en A");
  });

  it("keeps the older device's edit when the newer device never touched it", async () => {
    const a = new Client(stateWithRoutine("r1", "original"));
    const b = new Client(emptyState());

    a.activate();
    await Sync.run("a-first");
    b.activate();
    await Sync.run("b-first");

    vi.setSystemTime(T0 + 5000);
    b.edit((s) => {
      s.routines[0].name = "editado en B";
    }, Sync);
    await Sync.run("b-push");

    vi.setSystemTime(T0 + 6000);
    a.activate();
    await Sync.run("a-pull");

    expect(a.routine("r1").name).toBe("editado en B");
    expect(a.adopted).toBe(1);
  });

  it("propagates a deletion through its tombstone", async () => {
    const a = new Client(stateWithRoutine("r1", "borrable"));
    const b = new Client(emptyState());

    a.activate();
    await Sync.run("a-first");
    b.activate();
    await Sync.run("b-first");
    expect(b.routine("r1")).toBeTruthy();

    vi.setSystemTime(T0 + 1000);
    a.edit((s) => {
      s.routines.length = 0;
    }, Sync);
    await Sync.run("a-delete");

    expect((server.docs.get("rt_r1") as any).deleted).toBe(true);

    vi.setSystemTime(T0 + 2000);
    b.activate();
    await Sync.run("b-pull");
    expect(b.routine("r1")).toBeUndefined();
  });

  it("never deletes a document just because a device does not have it", async () => {
    const a = new Client(stateWithRoutine("r1", "de A"));
    const b = new Client(stateWithRoutine("r2", "de B"));

    a.activate();
    await Sync.run("a-first");

    vi.setSystemTime(T0 + 1000);
    b.activate();
    await Sync.run("b-first");

    // B had never heard of r1 and A had never heard of r2. Both survive.
    expect(server.docs.has("rt_r1")).toBe(true);
    expect(server.docs.has("rt_r2")).toBe(true);
    expect((server.docs.get("rt_r1") as any).deleted).toBe(false);
    expect(b.routine("r1")).toBeTruthy();

    vi.setSystemTime(T0 + 2000);
    a.activate();
    await Sync.run("a-pull");
    expect(a.routine("r2")).toBeTruthy();
  });
});

describe("a read served from the local cache is not a sync", () => {
  it("reports an error instead of 'Al día' when the server was never reached", async () => {
    const a = new Client(stateWithRoutine("r1", "A · Empuje"));
    server.options.fromCache = true;
    a.activate();

    await Sync.run("test");

    expect(Sync.state.status).toBe("error");
    expect(Sync.state.msg).toMatch(/no se pudo confirmar/i);
    // Nothing may be recorded as reconciled, or the device would believe it
    // had already uploaded everything.
    expect(a.shadow()).toEqual({});
    expect(a.lastPull()).toBe(0);
    expect(server.docs.size).toBe(0);
  });

  it("says 'sin conexión' instead of 'error' when the device is offline", async () => {
    const a = new Client(emptyState());
    server.options.fromCache = true;
    a.activate();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    await Sync.run("test");

    expect(Sync.state.status).toBe("offline");
  });

  it("syncs normally on the next attempt once the server answers", async () => {
    const a = new Client(stateWithRoutine("r1", "A · Empuje"));
    server.options.fromCache = true;
    a.activate();
    await Sync.run("cached");
    expect(Sync.state.status).toBe("error");

    server.options.fromCache = false;
    await Sync.run("live");

    expect(Sync.state.status).toBe("ok");
    expect(server.docs.has("rt_r1")).toBe(true);
  });
});

describe("no wait on the network is unbounded", () => {
  it("fails a read that never settles instead of hanging forever", async () => {
    const a = new Client(stateWithRoutine("r1", "A · Empuje"));
    server.options.hangGetDocs = true;
    a.activate();

    const running = Sync.run("hang");
    await vi.advanceTimersByTimeAsync(46_000);
    await running;

    expect(Sync.state.status).toBe("error");
    expect(Sync.state.msg).toMatch(/no respondió/i);
    // busy must be released, or "Sincronizar ahora" stops working for good.
    expect(Sync.state.busy).toBe(false);
  });

  it("lets the next sync succeed after a timeout", async () => {
    const a = new Client(stateWithRoutine("r1", "A · Empuje"));
    server.options.hangGetDocs = true;
    a.activate();

    const running = Sync.run("hang");
    await vi.advanceTimersByTimeAsync(46_000);
    await running;

    server.options.hangGetDocs = false;
    await Sync.run("retry");

    expect(Sync.state.status).toBe("ok");
    expect(server.docs.has("rt_r1")).toBe(true);
  });

  it("does not record a sync that the server never acknowledged", async () => {
    const a = new Client(stateWithRoutine("r1", "A · Empuje"));
    server.options.hangPendingWrites = true;
    a.activate();

    const running = Sync.run("no-ack");
    await vi.advanceTimersByTimeAsync(46_000);
    await running;

    expect(Sync.state.status).toBe("error");
    expect(a.shadow()).toEqual({});
    expect(a.lastPull()).toBe(0);

    // The shadow stayed clean, so the retry really retries.
    server.options.hangPendingWrites = false;
    await Sync.run("retry");
    expect(Sync.state.status).toBe("ok");
    expect(a.shadow()["rt_r1"]).toBeTruthy();
  });
});
