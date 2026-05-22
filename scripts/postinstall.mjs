/**
 * scripts/postinstall.mjs
 *
 * Selective postinstall script runner.
 *
 * Security rationale
 * ------------------
 * .npmrc sets `ignore-scripts=true`, which prevents ALL package lifecycle
 * scripts (postinstall, prepare, preinstall, etc.) from running automatically
 * during `npm install` or `npm ci`. This eliminates an entire class of
 * supply-chain attacks where a malicious or compromised package uses a
 * postinstall script to exfiltrate environment variables, tokens, or SSH keys.
 *
 * However, a small number of packages genuinely need to run a native-build step
 * to function — most notably `esbuild`, which ships pre-built binaries for each
 * platform and selects the right one via its own postinstall script.
 *
 * This script maintains an explicit POSTINSTALL_ALLOWLIST. For each package in
 * the list, it calls `npm rebuild <pkg>` which re-runs only that package's
 * own build/postinstall step in isolation. Any package NOT on the list is
 * skipped and logged.
 *
 * Adding a package to the allowlist REQUIRES a code-reviewed PR with a written
 * justification explaining why the package needs a build step and confirming
 * that the script has been reviewed and is safe.
 */

import { execSync } from "node:child_process";

/**
 * Packages permitted to run their postinstall/prepare scripts.
 * Keep this list as short as possible.
 *
 * To add a package: open a PR, add it here, and document why in the PR
 * description.
 */
const POSTINSTALL_ALLOWLIST = [
  "esbuild", // Ships platform-specific native binaries; rebuild selects correct binary
];

for (const pkg of POSTINSTALL_ALLOWLIST) {
  try {
    console.log(`[postinstall] running rebuild for: ${pkg}`);
    execSync(`npm rebuild ${pkg}`, { stdio: "inherit" });
    console.log(`[postinstall] done: ${pkg}`);
  } catch {
    // npm rebuild exits non-zero if the package is not installed (e.g. it is a
    // devDependency not present in a production install). Log and continue so
    // that production installs without devDependencies don't fail here.
    console.warn(`[postinstall] skipped (not installed or rebuild failed): ${pkg}`);
  }
}

const allPackages = ["esbuild" /* expand if allowlist grows */];
const skipped = allPackages.filter((p) => !POSTINSTALL_ALLOWLIST.includes(p));
if (skipped.length > 0) {
  for (const pkg of skipped) {
    console.log(`[postinstall] skipped (not in allowlist): ${pkg}`);
  }
}
