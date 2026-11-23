/* =========================================================
   sync-comidas.test.ts — Las comidas viajan por su propia
   colección, y eso es lo que las salva.

   Lo que se cubre acá es, sobre todo, que una build que no
   conoce las comidas no pueda borrarlas. Dentro de `items` ese
   camino existia: el dispositivo viejo baja un documento de un
   tipo que no entiende, le estampa la sombra igual, y en la
   sincronizacion siguiente lo ve ausente de su flatten() y sube
   una lapida. En una coleccion aparte, ni siquiera la lee.
   ========================================================= */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { FakeServer, fakeBackend } from "./support/fake-firestore";
import { Client, emptyState, type AppState } from "./support/client";

const USER = { uid: "u1", email: "test@example.com" };
const T0 = new Date("2026-03-01T10:00:00Z").getTime();

let server: FakeServer;
let Sync: any;

async function loadSync() {
  vi.resetModules();
  const mod = await import("../src/sync");
  mod.Sync._inject(fakeBackend(server), USER);
  return mod.Sync as any;
}

const item = (id: string, kcal = 100) => ({
  id,
  name: "Pollo",
  qty: 100,
  unit: "g",
  macros: { kcal, protein: 20, carbs: 0, fat: 2 },
  source: "catalog",
});

const comer = (s: AppState, date: string, slotId: string, it: ReturnType<typeof item>) => {
  s.dayLogs = s.dayLogs || [];
  let day = s.dayLogs.find((d: any) => d.date === date);
  if (!day) {
    day = { date, slots: [] };
    s.dayLogs.push(day);
  }
  let slot = day.slots.find((x: any) => x.slotId === slotId);
  if (!slot) {
    slot = { slotId, items: [] };
    day.slots.push(slot);
  }
  slot.items.push(it);
};

const items = (s: AppState, date: string, slotId: string): any[] =>
  s.dayLogs?.find((d: any) => d.date === date)?.slots.find((x: any) => x.slotId === slotId)
    ?.items ?? [];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  server = new FakeServer();
  Sync = await loadSync();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("las comidas van a su propia coleccion", () => {
  it("no se mezclan con el resto del estado", async () => {
    const a = new Client(emptyState());
    a.edit((s) => comer(s, "2026-03-01", "almuerzo", item("i1")), Sync);
    a.activate();

    await Sync.run("test");

    expect(server.meals.has("i1")).toBe(true);
    expect(server.docs.has("i1")).toBe(false);
    expect(server.reads.some((r) => r.path.endsWith("/meals"))).toBe(true);
    expect(server.reads.some((r) => r.path.endsWith("/items"))).toBe(true);
  });
});

describe("dos dispositivos", () => {
  it("una comida registrada en uno aparece en el otro", async () => {
    const a = new Client(emptyState());
    const b = new Client(emptyState());

    a.edit((s) => comer(s, "2026-03-01", "almuerzo", item("i1")), Sync);
    a.activate();
    await Sync.run("test");

    b.activate();
    await Sync.run("test");

    expect(items(b.state, "2026-03-01", "almuerzo").map((i) => i.id)).toEqual(["i1"]);
  });

  it("comidas distintas el MISMO dia no se pisan", async () => {
    // Un documento por dia resolveria el dia entero por reloj y el que
    // llegara segundo perderia su comida. Por eso es uno por item.
    const a = new Client(emptyState());
    const b = new Client(emptyState());

    a.edit((s) => comer(s, "2026-03-01", "desayuno", item("i1")), Sync);
    a.activate();
    await Sync.run("test");

    b.activate();
    await Sync.run("test");
    vi.setSystemTime(T0 + 20000);
    b.edit((s) => comer(s, "2026-03-01", "almuerzo", item("i2")), Sync);
    b.activate();
    await Sync.run("test");

    vi.setSystemTime(T0 + 30000);
    a.activate();
    await Sync.run("test");

    expect(items(a.state, "2026-03-01", "desayuno").map((i) => i.id)).toEqual(["i1"]);
    expect(items(a.state, "2026-03-01", "almuerzo").map((i) => i.id)).toEqual(["i2"]);
  });

  it("borrar una comida en uno la borra en el otro", async () => {
    const a = new Client(emptyState());
    const b = new Client(emptyState());

    a.edit((s) => comer(s, "2026-03-01", "almuerzo", item("i1")), Sync);
    a.activate();
    await Sync.run("test");
    b.activate();
    await Sync.run("test");
    expect(items(b.state, "2026-03-01", "almuerzo")).toHaveLength(1);

    vi.setSystemTime(T0 + 20000);
    a.edit((s) => {
      s.dayLogs = [];
    }, Sync);
    a.activate();
    await Sync.run("test");

    vi.setSystemTime(T0 + 30000);
    b.activate();
    await Sync.run("test");

    expect(b.state.dayLogs).toEqual([]);
    expect((server.meals.get("i1") as any).deleted).toBe(true);
  });

  it("y no deja el dia vacio contando como registrado", async () => {
    const a = new Client(emptyState());
    a.edit((s) => comer(s, "2026-03-01", "almuerzo", item("i1")), Sync);
    a.activate();
    await Sync.run("test");

    const b = new Client(emptyState());
    b.activate();
    await Sync.run("test");

    vi.setSystemTime(T0 + 20000);
    a.edit((s) => {
      s.dayLogs![0].slots[0].items = [];
      s.dayLogs![0].slots = [];
      s.dayLogs = [];
    }, Sync);
    a.activate();
    await Sync.run("test");

    vi.setSystemTime(T0 + 30000);
    b.activate();
    await Sync.run("test");
    expect(b.state.dayLogs).toEqual([]);
  });
});

describe("un dispositivo que no conoce las comidas", () => {
  it("NO las borra, que es el bug que esta separacion previene", async () => {
    const a = new Client(emptyState());
    a.edit((s) => comer(s, "2026-03-01", "almuerzo", item("i1")), Sync);
    a.activate();
    await Sync.run("test");
    expect(server.meals.has("i1")).toBe(true);

    // Un estado sin dayLogs, como el de una build anterior.
    const viejo = new Client(emptyState());
    delete viejo.state.dayLogs;
    viejo.activate();
    vi.setSystemTime(T0 + 20000);
    await Sync.run("test");
    vi.setSystemTime(T0 + 30000);
    await Sync.run("test");

    // Ni una lapida.
    expect((server.meals.get("i1") as any).deleted).toBeFalsy();

    vi.setSystemTime(T0 + 40000);
    a.activate();
    await Sync.run("test");
    expect(items(a.state, "2026-03-01", "almuerzo").map((i) => i.id)).toEqual(["i1"]);
  });
});
