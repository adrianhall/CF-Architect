import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@islands": path.resolve(__dirname, "src/islands"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
    setupFiles: ["tests/setup-dom.ts"],
    // Node 25+ enables Web Storage API by default, which conflicts with happy-dom.
    // Provide a valid temp path so the --localstorage-file flag doesn't warn.
    // See: https://github.com/vitest-dev/vitest/issues/8757
    execArgv: ["--no-experimental-webstorage"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/env.d.ts",
        "src/**/*.astro",
        "src/lib/scaffold-templates/**",
      ],
      reporter: ["text", "json", "lcov", "text-summary", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
