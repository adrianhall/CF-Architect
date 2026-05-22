import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "scripts",
    environment: "node",
    include: ["*.test.ts", "*.test.mjs"],
    coverage: {
      provider: "istanbul",
      include: ["*.ts", "*.mjs"],
      exclude: ["*.test.ts", "*.test.mjs", "vitest.config.ts"],
    },
  },
});
