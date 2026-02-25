import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./src/lib/db/schema.ts",
  dialect: "sqlite",
});
