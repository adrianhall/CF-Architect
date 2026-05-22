/**
 * scripts/render-wrangler.test.ts
 *
 * Tests for the render-wrangler.ts script logic.
 * We test the substitution behaviour in isolation without spawning the script.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Helpers — replicate the substitution logic from render-wrangler.ts so we
// can test it without importing the script (which has process.exit calls).
// ---------------------------------------------------------------------------

const TOKEN_PATTERN = /\$\{(TF_OUTPUT_[A-Z0-9_]+)\}/g;

function renderTemplate(
  template: string,
  outputs: Record<string, string>,
): { rendered: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const rendered = template.replace(TOKEN_PATTERN, (_match, token: string) => {
    if (Object.prototype.hasOwnProperty.call(outputs, token)) {
      const value = outputs[token];
      if (!value) {
        unresolved.push(`${token} (present but empty)`);
        return _match;
      }
      return value;
    }
    unresolved.push(token);
    return _match;
  });
  return { rendered, unresolved };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderTemplate()", () => {
  it("substitutes all ${TF_OUTPUT_*} tokens", () => {
    const template = `
      database_id = "\${TF_OUTPUT_D1_DATABASE_ID}"
      kv_id = "\${TF_OUTPUT_KV_SHARES_ID}"
    `;
    const outputs = {
      TF_OUTPUT_D1_DATABASE_ID: "abc-123",
      TF_OUTPUT_KV_SHARES_ID: "kv-456",
    };

    const { rendered, unresolved } = renderTemplate(template, outputs);

    expect(unresolved).toHaveLength(0);
    expect(rendered).toContain(`"abc-123"`);
    expect(rendered).toContain(`"kv-456"`);
    expect(rendered).not.toContain("TF_OUTPUT_");
  });

  it("reports unresolved tokens", () => {
    const template = `id = "\${TF_OUTPUT_MISSING_KEY}"`;
    const outputs: Record<string, string> = {};

    const { unresolved } = renderTemplate(template, outputs);

    expect(unresolved).toContain("TF_OUTPUT_MISSING_KEY");
  });

  it("does not substitute non-TF_OUTPUT tokens", () => {
    const template = `note = "\${SOME_OTHER_VAR}"`;
    const { rendered, unresolved } = renderTemplate(template, {});

    // Non-TF_OUTPUT tokens are left untouched and NOT in unresolved
    expect(rendered).toBe(template);
    expect(unresolved).toHaveLength(0);
  });

  it("reports partially empty outputs as unresolved", () => {
    const template = `id = "\${TF_OUTPUT_EMPTY_KEY}"`;
    const outputs = { TF_OUTPUT_EMPTY_KEY: "" };

    const { unresolved } = renderTemplate(template, outputs);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toContain("TF_OUTPUT_EMPTY_KEY");
  });

  it("handles multiple occurrences of the same token", () => {
    const template = `a = "\${TF_OUTPUT_ID}" b = "\${TF_OUTPUT_ID}"`;
    const outputs = { TF_OUTPUT_ID: "replaced" };

    const { rendered, unresolved } = renderTemplate(template, outputs);

    expect(unresolved).toHaveLength(0);
    expect(rendered).toBe(`a = "replaced" b = "replaced"`);
  });
});

// ---------------------------------------------------------------------------
// File I/O integration — minimal smoke tests using a temp directory
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(resolve(tmpdir(), "render-wrangler-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("file I/O behaviour", () => {
  it("correctly reads and writes a template file", () => {
    const templatePath = resolve(tmpDir, "wrangler.template.jsonc");
    const outputsPath = resolve(tmpDir, ".terraform-outputs.json");
    const outputPath = resolve(tmpDir, "wrangler.jsonc");

    const template = `{ "name": "\${TF_OUTPUT_WORKER_NAME}" }`;
    const outputs = { TF_OUTPUT_WORKER_NAME: "my-worker" };

    writeFileSync(templatePath, template, "utf-8");
    writeFileSync(outputsPath, JSON.stringify(outputs), "utf-8");

    // Simulate what render-wrangler.ts does
    const raw = readFileSync(outputsPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    const tmpl = readFileSync(templatePath, "utf-8");
    const { rendered, unresolved } = renderTemplate(tmpl, parsed);

    expect(unresolved).toHaveLength(0);
    writeFileSync(outputPath, rendered, "utf-8");

    const written = readFileSync(outputPath, "utf-8");
    expect(written).toBe(`{ "name": "my-worker" }`);
  });

  it("throws-equivalent when outputs file is missing", () => {
    const outputsPath = resolve(tmpDir, ".terraform-outputs.json");

    expect(() => {
      readFileSync(outputsPath, "utf-8");
    }).toThrow();

    expect(existsSync(outputsPath)).toBe(false);
  });
});
