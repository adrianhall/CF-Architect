import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "compile",
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      chunkSizeWarningLimit: 1500,
    },
    resolve: {
      alias: import.meta.env.PROD && {
        "react-dom/server": "react-dom/server.edge",
      },
    },
    ssr: {
      external: ["node:crypto"],
    },
  },
});
