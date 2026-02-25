/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
}

declare namespace App {
  interface Locals extends Runtime {
    user: import("./lib/auth/types").AppUser;
  }
}
