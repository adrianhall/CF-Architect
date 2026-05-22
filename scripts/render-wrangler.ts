/**
 * scripts/render-wrangler.ts
 *
 * Reads the Terraform output file (.terraform-outputs.json) and substitutes
 * all ${TF_OUTPUT_*} tokens in wrangler.template.jsonc to produce
 * wrangler.jsonc.
 *
 * Run via: npm run render-wrangler
 * Runs automatically as a postprovision hook after: npm run provision
 *
 * Exits with code 1 and a clear error message if:
 *   - .terraform-outputs.json is missing (run `npm run provision` first)
 *   - Any ${TF_OUTPUT_*} token in the template is not present in the outputs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, "..");
const OUTPUTS_PATH = resolve(ROOT, ".terraform-outputs.json");
const TEMPLATE_PATH = resolve(ROOT, "wrangler.template.jsonc");
const OUTPUT_PATH = resolve(ROOT, "wrangler.jsonc");

// ---------------------------------------------------------------------------
// Load Terraform outputs
// ---------------------------------------------------------------------------
let outputs: Record<string, string>;
try {
  const raw = readFileSync(OUTPUTS_PATH, "utf-8");
  outputs = JSON.parse(raw) as Record<string, string>;
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    console.error(
      "render-wrangler: .terraform-outputs.json not found.\n" +
        "Run `npm run provision` first to provision Cloudflare resources and\n" +
        "generate the outputs file.",
    );
  } else {
    console.error(`render-wrangler: failed to read .terraform-outputs.json: ${String(err)}`);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load template
// ---------------------------------------------------------------------------
let template: string;
try {
  template = readFileSync(TEMPLATE_PATH, "utf-8");
} catch (err) {
  console.error(`render-wrangler: failed to read wrangler.template.jsonc: ${String(err)}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Substitute tokens
// ---------------------------------------------------------------------------
const TOKEN_PATTERN = /\$\{(TF_OUTPUT_[A-Z0-9_]+)\}/g;

const unresolved: string[] = [];
const rendered = template.replace(TOKEN_PATTERN, (_match, token: string) => {
  if (Object.prototype.hasOwnProperty.call(outputs, token)) {
    const value = outputs[token];
    if (value === undefined || value === null || value === "") {
      unresolved.push(`${token} (present but empty)`);
      return _match;
    }
    return value;
  }
  unresolved.push(token);
  return _match;
});

if (unresolved.length > 0) {
  console.error(
    "render-wrangler: the following placeholders were not resolved:\n" +
      unresolved.map((t) => `  - ${t}`).join("\n") +
      "\n\nCheck that .terraform-outputs.json contains all expected keys.\n" +
      "Re-run `npm run provision` if resources have changed.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
writeFileSync(OUTPUT_PATH, rendered, "utf-8");
console.log(`render-wrangler: wrote ${OUTPUT_PATH}`);
