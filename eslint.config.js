import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "dev-dist/**", "node_modules/**", "coverage/**"],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      /* The point of the linter here is to catch real mistakes, not to impose a
         style on code that already works. Formatting belongs to Prettier. */
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      /* Con `strict: true` desde la Fase 3, los `any` que quedan ya no son
         deuda: son fronteras reales. La SDK de Firebase se carga por CDN y no
         trae tipos; `$`/`$$` devuelven `any` a proposito, documentado en
         lib/dom.ts; y el `el` de un handler es el elemento que el que lo
         escribio ya sabe cual es. Prender la regla pediria treinta
         `eslint-disable` que no compran nada. */
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["warn", "smart"],
    },
  },

  {
    /* Type-aware pass, deliberately narrow. A promise nobody waited on is
       exactly the bug that left the sync card spinning forever in production,
       so it is worth the extra type information; the rest of the type-checked
       ruleset would drown this codebase in `no-unsafe-*` noise for no gain. */
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/await-thenable": "error",
    },
  },

  {
    files: ["public/config.js"],
    languageOptions: { sourceType: "script" },
  },

  {
    /* scripts/ son herramientas de linea de comandos, no codigo de la app:
       usan process y escriben a stdout a proposito. */
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },

  {
    /* Estos dos corren DENTRO del navegador (se cargan con fetch + eval desde
       la consola), no en Node. */
    files: ["scripts/huella-visual/dom.js", "scripts/huella-visual/escena.js"],
    languageOptions: { globals: { ...globals.browser } },
    rules: { "no-eval": "off" },
  },

  prettier,
);
