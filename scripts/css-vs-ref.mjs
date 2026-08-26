#!/usr/bin/env node
/* =========================================================
   css-vs-ref.mjs — Compara el CSS compilado de esta rama
   contra el de una referencia (por defecto, origin/main).

   Por que existe: Tailwind v4 escanea los archivos fuente
   buscando candidatos a clase, y no distingue entre un
   `class="..."` y una palabra suelta en un comentario. Escribir
   "its sticky header" en un comentario alcanza para que compile
   `.sticky{position:sticky}` muerto en el bundle que se manda al
   telefono. Ya paso dos veces durante la Fase 3 (.table y
   .sticky), y no lo agarra ni el typecheck ni el linter ni los
   tests: el CSS simplemente engorda en silencio.

   En un refactor que no cambia comportamiento, la respuesta
   correcta es que el CSS salga identico. Este script lo prueba.

   Uso:
     node scripts/css-vs-ref.mjs [ref]        # ref por defecto: origin/main

   Sale con codigo 1 si aparecen o desaparecen utilidades.
   ========================================================= */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ref = process.argv[2] || "origin/main";
const root = resolve(import.meta.dirname, "..");
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

/** Todos los selectores de clase que aparecen en un CSS compilado. */
function selectors(file) {
  const css = readFileSync(file, "utf8");
  return new Set([...css.matchAll(/\.(?:\\.|[a-zA-Z0-9_-])+/g)].map((m) => m[0]));
}

/** El unico .css que Vite emite en dist/assets. */
const builtCss = (dir) => {
  const assets = join(dir, "dist", "assets");
  const name = readdirSync(assets).find((f) => f.endsWith(".css"));
  if (!name) throw new Error(`no hay CSS compilado en ${assets}`);
  return join(assets, name);
};

let worktree;
try {
  run("npx", ["vite", "build", "--logLevel", "error"]);
  const mine = builtCss(root);

  worktree = mkdtempSync(join(tmpdir(), "bitacora-ref-"));
  rmSync(worktree, { recursive: true, force: true });
  run("git", ["worktree", "add", "--quiet", "--detach", worktree, ref]);
  symlinkSync(join(root, "node_modules"), join(worktree, "node_modules"));
  run("npx", ["vite", "build", "--logLevel", "error"], worktree);
  const theirs = builtCss(worktree);

  const a = selectors(theirs);
  const b = selectors(mine);
  const gone = [...a].filter((v) => !b.has(v)).sort();
  const added = [...b].filter((v) => !a.has(v)).sort();
  const identical = readFileSync(theirs, "utf8") === readFileSync(mine, "utf8");

  console.log(`referencia : ${ref}`);
  console.log(`desaparecen: ${gone.length ? gone.join(" ") : "(ninguna)"}`);
  console.log(`aparecen   : ${added.length ? added.join(" ") : "(ninguna)"}`);
  console.log(`identico byte a byte: ${identical}`);

  if (gone.length || added.length) {
    console.error(
      "\nEl conjunto de utilidades cambio. Si no era la intencion, buscá la palabra\n" +
        "en un comentario o en un string de los archivos nuevos: Tailwind la esta\n" +
        "leyendo como si fuera una clase.",
    );
    process.exit(1);
  }
} finally {
  if (worktree) {
    try {
      run("git", ["worktree", "remove", "--force", worktree]);
    } catch {
      /* el worktree ya no esta */
    }
  }
}
