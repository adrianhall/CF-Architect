import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  plugins: [
    // TanStack Router Vite plugin — generates routeTree.gen.ts from src/routes/
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],

  define: {
    // Expose the package version to source code as a string constant.
    // Used by /api/version and any version display components.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* requests to the wrangler dev server during
      // local development (`npm run dev:web` + `npm run dev:worker`).
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/_auth": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
