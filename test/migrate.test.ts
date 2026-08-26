/* =========================================================
   migrate.test.ts — What happens to a state written by an
   older build when this one opens it.

   The interesting rules are about photos: whose exercise gets
   to inherit the public-domain pictures, and whose must be left
   exactly as the user wrote it.
   ========================================================= */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, migrate } from "../src/state/migrate";
import { EX_IMAGES, EX_PHOTO_NOTE } from "../src/data/exercises";
import type { AppState, Exercise } from "../src/types";

/** An id the seed ships photos AND a variant note for. */
const CON_NOTA = Object.keys(EX_PHOTO_NOTE)[0];
/** An id the seed ships photos for, with no note. */
const CON_FOTO = Object.keys(EX_IMAGES).find((k) => !EX_PHOTO_NOTE[k])!;

const ex = (over: Partial<Exercise>): Exercise => ({
  id: "x",
  name: "Ejercicio",
  group: "Pecho",
  cues: [],
  err: "",
  tip: "",
  custom: false,
  ...over,
});

/** A state as bare as the oldest one on disk could plausibly be. */
const viejo = (over: Partial<AppState> = {}): AppState => ({ ...over }) as AppState;

describe("los campos que un estado viejo no tiene", () => {
  it("aparecen vacíos en vez de romper la primera vista que los recorra", () => {
    const s = migrate(viejo());
    expect(s.exercises).toEqual([]);
    expect(s.routines).toEqual([]);
    expect(s.sessions).toEqual([]);
    expect(s.bw).toEqual([]);
    expect(s.ui).toEqual({});
  });

  it("completan los ajustes sin pisar lo que el usuario ya eligió", () => {
    const s = migrate(viejo({ settings: { theme: "light", accent: "coral" } as never }));
    expect(s.settings.theme).toBe("light");
    expect(s.settings.accent).toBe("coral");
    expect(s.settings.rest).toBe(DEFAULT_SETTINGS.rest);
    expect(s.settings.wake).toBe(DEFAULT_SETTINGS.wake);
  });

  it("no deja que un estado migrado comparta el objeto de defaults con el siguiente", () => {
    const a = migrate(viejo());
    const b = migrate(viejo());
    a.settings.rest = 999;
    expect(b.settings.rest).toBe(DEFAULT_SETTINGS.rest);
    expect(DEFAULT_SETTINGS.rest).toBe(90);
  });
});

describe("las fotos que se heredan y las que no", () => {
  it("le da al ejercicio de la semilla las fotos que le faltan", () => {
    const s = migrate(viejo({ exercises: [ex({ id: CON_FOTO })] }));
    expect(s.exercises[0].images).toEqual(EX_IMAGES[CON_FOTO].images);
  });

  it("copia el array, así borrar una foto no toca la constante del módulo", () => {
    const s = migrate(viejo({ exercises: [ex({ id: CON_FOTO })] }));
    s.exercises[0].images!.length = 0;
    expect(EX_IMAGES[CON_FOTO].images.length).toBeGreaterThan(0);
  });

  it("deja sin fotos al ejercicio propio del usuario, aunque el id coincida", () => {
    // Si alguien creó su propio ejercicio y le tocó ese id, heredar la foto
    // de otro movimiento sería mostrarle una imagen que no es la suya.
    const s = migrate(viejo({ exercises: [ex({ id: CON_FOTO, custom: true })] }));
    expect(s.exercises[0].images).toEqual([]);
  });

  it("no toca las fotos que el ejercicio ya traía", () => {
    const propias = ["https://ejemplo/mia.jpg"];
    const s = migrate(viejo({ exercises: [ex({ id: CON_FOTO, images: propias })] }));
    expect(s.exercises[0].images).toEqual(propias);
  });

  it("respeta un array de fotos vacío a propósito", () => {
    // `[]` no es "todavía no tiene fotos": es "las borré". Solo `undefined`
    // significa que el estado es viejo y hay que completarlo.
    const s = migrate(viejo({ exercises: [ex({ id: CON_FOTO, images: [] })] }));
    expect(s.exercises[0].images).toEqual([]);
  });
});

describe("la aclaración de foto de variante", () => {
  it("se le agrega al ejercicio de la semilla que la necesita", () => {
    const s = migrate(viejo({ exercises: [ex({ id: CON_NOTA })] }));
    expect(s.exercises[0].photoNote).toBe(EX_PHOTO_NOTE[CON_NOTA]);
  });

  it("no se le agrega a uno reemplazado desde la base pública", () => {
    // `sourceId` significa que la foto ya no es la de la semilla: la nota
    // estaría describiendo una imagen que dejó de estar ahí.
    const s = migrate(viejo({ exercises: [ex({ id: CON_NOTA, sourceId: "algo" })] }));
    expect(s.exercises[0].photoNote).toBeUndefined();
  });

  it("no se le agrega a uno propio del usuario", () => {
    const s = migrate(viejo({ exercises: [ex({ id: CON_NOTA, custom: true })] }));
    expect(s.exercises[0].photoNote).toBeUndefined();
  });
});
