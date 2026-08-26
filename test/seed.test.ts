/* =========================================================
   seed.test.ts — The plan itself: the exercises, the routines,
   and the state a fresh install starts from.

   This is the net under the data move. The seed used to be 240
   lines in the middle of app.ts; these checks say the catalogue
   is still internally consistent — every routine points at an
   exercise that exists, every exercise sits in a real muscle
   group, every photo belongs to something.
   ========================================================= */
import { describe, expect, it } from "vitest";
import { EX_IMAGES, EX_PHOTO_NOTE, SEED_EX } from "../src/data/exercises";
import { SEED_ROUTINES } from "../src/data/routines";
import { RANGES } from "../src/data/groups";
import { GROUPS } from "../src/lib/calc";
import { seedState } from "../src/state/store";

describe("el catálogo de ejercicios", () => {
  it("no repite ids: el id es la clave de todo lo demás", () => {
    const ids = SEED_EX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("usa solo grupos musculares que Progreso sabe dibujar", () => {
    // A group outside GROUPS would never appear in the weekly volume bars:
    // the sets would be counted and then silently dropped from the chart.
    const unknown = SEED_EX.filter((e) => !GROUPS.includes(e.group)).map((e) => e.name);
    expect(unknown).toEqual([]);
  });

  it("le da a cada ejercicio al menos un paso de ejecución", () => {
    const empty = SEED_EX.filter((e) => !e.cues.length).map((e) => e.name);
    expect(empty).toEqual([]);
  });

  it("marca la semilla como no-propia, que es lo que decide si hereda fotos", () => {
    expect(SEED_EX.every((e) => e.custom === false)).toBe(true);
  });
});

describe("las fotos de la base pública", () => {
  it("están todas asociadas a un ejercicio que existe", () => {
    const ids = new Set(SEED_EX.map((e) => e.id));
    const huérfanas = Object.keys(EX_IMAGES).filter((k) => !ids.has(k));
    expect(huérfanas).toEqual([]);
  });

  it("aclaran con una nota cuando la foto es de una variante, no del ejercicio", () => {
    const ids = new Set(SEED_EX.map((e) => e.id));
    const huérfanas = Object.keys(EX_PHOTO_NOTE).filter((k) => !ids.has(k));
    expect(huérfanas).toEqual([]);
    // La nota sin foto no se ve en ningún lado: sería una advertencia muda.
    const sinFoto = Object.keys(EX_PHOTO_NOTE).filter((k) => !EX_IMAGES[k]);
    expect(sinFoto).toEqual([]);
  });
});

describe("las rutinas del plan", () => {
  it("apuntan solo a ejercicios del catálogo", () => {
    const ids = new Set(SEED_EX.map((e) => e.id));
    const rotos = SEED_ROUTINES().flatMap((r) =>
      r.items.filter((i) => !ids.has(i.exerciseId)).map((i) => `${r.name} → ${i.exerciseId}`),
    );
    expect(rotos).toEqual([]);
  });

  it("nunca piden un rango de repeticiones al revés", () => {
    const rotos = SEED_ROUTINES().flatMap((r) =>
      r.items.filter((i) => i.repsMin > i.repsMax).map((i) => `${r.name} → ${i.exerciseId}`),
    );
    expect(rotos).toEqual([]);
  });

  it("reparte ids nuevos en cada llamada", () => {
    // Two routines built from the same seed must not share item ids: the
    // routine editor addresses rows by id, and a duplicate would edit both.
    const a = SEED_ROUTINES().flatMap((r) => r.items.map((i) => i.id));
    const b = SEED_ROUTINES().flatMap((r) => r.items.map((i) => i.id));
    expect(new Set(a).size).toBe(a.length);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });
});

describe("cada grupo muscular tiene un rango semanal", () => {
  it("porque Progreso dibuja la zona óptima leyendo RANGES[grupo]", () => {
    const sinRango = GROUPS.filter((g) => !RANGES[g]);
    expect(sinRango).toEqual([]);
    const alRevés = GROUPS.filter((g) => RANGES[g][0] > RANGES[g][1]);
    expect(alRevés).toEqual([]);
  });
});

describe("seedState", () => {
  it("le pega a cada ejercicio las fotos que le corresponden", () => {
    const s = seedState();
    const conFoto = s.exercises.filter((e) => EX_IMAGES[e.id]);
    expect(conFoto.length).toBe(Object.keys(EX_IMAGES).length);
    expect(conFoto.every((e) => (e.images || []).length > 0)).toBe(true);
  });

  it("copia el array de fotos en vez de compartir el de la semilla", () => {
    // Sharing it would mean deleting a photo in one install's state mutates
    // the module-level constant for every state built afterwards.
    const a = seedState();
    const b = seedState();
    const id = Object.keys(EX_IMAGES)[0];
    a.exercises.find((e) => e.id === id)!.images!.push("about:blank");
    expect(b.exercises.find((e) => e.id === id)!.images).not.toContain("about:blank");
    expect(EX_IMAGES[id].images).not.toContain("about:blank");
  });

  it("arranca sin historial y sin sesión en curso", () => {
    const s = seedState();
    expect(s.sessions).toEqual([]);
    expect(s.bw).toEqual([]);
    expect(s.active).toBeNull();
  });

  it("deja el ejercicio de Progreso apuntando a algo que existe", () => {
    const s = seedState();
    expect(s.exercises.some((e) => e.id === s.ui.progressEx)).toBe(true);
  });
});
