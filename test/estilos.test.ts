import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compile } from "tailwindcss";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

/** Compila SOLO Tailwind (sin el CSS de la app) para preguntarle, de cada
 *  nombre, si el genera una utilidad con ese nombre exacto. */
async function tailwindUtilitiesFor(names: string[]): Promise<Set<string>> {
  const twRoot = resolve(ROOT, "node_modules/tailwindcss");
  const compiled = await compile('@import "tailwindcss";', {
    base: ROOT,
    loadStylesheet: async (id: string, base: string) => {
      const path = id === "tailwindcss" ? resolve(twRoot, "index.css") : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  const css = compiled.build(names);
  const emitted = new Set<string>();
  for (const name of names) {
    // el nombre aparece escapado en el selector: .w-full , .2xl\:foo , etc.
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:/g, "\\\\:");
    if (new RegExp(`\\.${esc}(?![\\w-])`).test(css)) emitted.add(name);
  }
  return emitted;
}

/** Nombres de clase que la app define para si misma dentro de @layer components. */
function appComponentClasses(): Set<string> {
  const css = read("src/app.css");
  const start = css.indexOf("@layer components {");
  expect(start, "app.css debe tener un bloque @layer components").toBeGreaterThan(-1);
  const body = css.slice(start);
  const names = new Set<string>();
  for (const m of body.matchAll(/\.([a-zA-Z][\w-]*)/g)) names.add(m[1]);
  return names;
}

describe("capas de estilos", () => {
  it("el CSS de la app vive dentro de capas, para que las utilidades puedan ganarle", () => {
    const css = read("src/app.css");
    expect(css).toContain("@layer base {");
    expect(css).toContain("@layer components {");
    // Nada de reglas sueltas despues del bloque de variables: lo no-encapado
    // le gana a `utilities` y las clases de los templates dejan de servir.
    const afterTheme = css.slice(css.indexOf("@layer base {"));
    const unlayered = afterTheme
      .split("\n")
      .filter((l) => /^[.#a-zA-Z*[]/.test(l) && !l.startsWith("@"));
    expect(unlayered, `reglas fuera de capa:\n${unlayered.join("\n")}`).toEqual([]);
  });

  it("ninguna clase propia se llama igual que una utilidad de Tailwind", async () => {
    // `block` fue el caso real: la app definia .block{width:100%} y Tailwind
    // genera .block{display:block}. Al estar en `utilities`, gana Tailwind y
    // 30 botones pasaron de inline-flex a block sin un solo error en consola.
    const mine = [...appComponentClasses()];
    const collisions = [...(await tailwindUtilitiesFor(mine))].sort();
    expect(
      collisions,
      `Estas clases de la app colisionan con utilidades de Tailwind y PIERDEN.\n` +
        `Renombralas o reemplazalas por la utilidad equivalente:\n  ${collisions.join("\n  ")}`,
    ).toEqual([]);
  });
});
