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
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/env.d.ts", "src/**/*.astro"],
      reporter: ["text", "text-summary", "json-summary"],
    },
  },
});
