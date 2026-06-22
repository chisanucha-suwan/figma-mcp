import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Excluded — no runtime logic to unit-cover:
      //   types.ts  — pure type declarations (erased at compile time)
      //   index.ts  — stdio server bootstrap (wiring only; exercised by the integration test)
      exclude: ["src/types.ts", "src/index.ts"],
      reporter: ["text", "text-summary"],
      // Logic is fully covered — fail the build if it ever regresses.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
