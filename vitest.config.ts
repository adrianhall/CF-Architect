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
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/env.d.ts", "src/**/*.astro"],
      reporter: ["text", "text-summary"],
    },
  },
});
