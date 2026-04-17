// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  integrations: [react()],
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
    build: {
      // tldraw client-side chunks exceed Vite's default 500 KB warning.
      // This is fine — tldraw is served as a static asset, not part of
      // the Worker script (which has its own size limits).
      chunkSizeWarningLimit: 2000,
    },
  },
})
