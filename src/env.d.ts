/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  DB: D1Database
  CACHE: KVNamespace
  CF_ACCESS_TEAM_NAME: string
  INITIAL_ADMIN_GITHUB_USERNAME: string
}>

declare namespace App {
  interface Locals extends Runtime {
    user: {
      id: string
      github_id: string
      github_username: string
      email: string
      display_name: string
      avatar_url: string | null
      role: 'admin' | 'user'
    } | null
  }
}
