import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom for everything: the sync tests need localStorage, navigator and
    // document listeners, and the pure ones do not care either way.
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    restoreMocks: true,
  },
});
