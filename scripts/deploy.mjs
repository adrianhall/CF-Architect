#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync, existsSync, copyFileSync  } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env");
const DIST = join(ROOT, "dist");
const WRANGLER_SRC = join(ROOT, "wrangler.toml");
const WRANGLER_TMP = join(ROOT, ".wrangler.deploy.toml");
const ASSETSIGNORE_SRC = join(ROOT, ".assetsignore");
const ASSETSIGNORE_TMP = join(DIST, ".assetsignore");

// Load .env file if present (values won't overwrite existing env vars)
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] ??= val;
  }
}

const vars = {
  D1_DATABASE_ID: process.env.D1_DATABASE_ID,
  KV_NAMESPACE_ID: process.env.KV_NAMESPACE_ID,
  SESSION_NAMESPACE_ID: process.env.SESSION_NAMESPACE_ID,
};

const missing = Object.entries(vars)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  console.error(
    "Set them in a .env file or export them as environment variables.",
  );
  process.exit(1);
}

let config = readFileSync(WRANGLER_SRC, "utf-8");

// Order matters: replace "local-session" before "local" to avoid partial match
config = config.replace(
  'database_id = "local"',
  `database_id = "${vars.D1_DATABASE_ID}"`,
);
config = config.replace(
  'id = "local-session"',
  `id = "${vars.SESSION_NAMESPACE_ID}"`,
);
config = config.replace('id = "local"', `id = "${vars.KV_NAMESPACE_ID}"`);

writeFileSync(WRANGLER_TMP, config, "utf-8");

// Copy .assetsignore to dist/ so Wrangler picks it up during deploy
if (existsSync(ASSETSIGNORE_SRC)) {
  copyFileSync(ASSETSIGNORE_SRC, ASSETSIGNORE_TMP);
} else {
  // If no .assetsignore exists, create an empty one to avoid Wrangler warnings
  writeFileSync(ASSETSIGNORE_TMP, "", "utf-8");
}

try {
  console.log("Applying D1 migrations...");
  execSync(
    "npx wrangler d1 migrations apply DB --remote --config .wrangler.deploy.toml",
    { cwd: ROOT, stdio: "inherit" },
  );

  console.log("\nDeploying to Cloudflare Workers...");
  execSync("npx wrangler deploy --config .wrangler.deploy.toml", {
    cwd: ROOT,
    stdio: "inherit",
  });
} finally {
  if (existsSync(WRANGLER_TMP)) unlinkSync(WRANGLER_TMP);
}
