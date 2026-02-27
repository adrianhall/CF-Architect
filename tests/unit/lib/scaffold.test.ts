import { describe, it, expect } from "vitest";
import {
  generateScaffold,
  toBindingName,
  type ScaffoldInput,
} from "@lib/scaffold";

// ---------------------------------------------------------------------------
// Helper to build minimal scaffold inputs
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<ScaffoldInput> = {}): ScaffoldInput {
  return {
    title: overrides.title ?? "Test Project",
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
  };
}

// ---------------------------------------------------------------------------
// toBindingName
// ---------------------------------------------------------------------------

describe("toBindingName", () => {
  it("converts a normal label to SCREAMING_SNAKE_CASE", () => {
    expect(toBindingName("My D1 Database")).toBe("MY_D1_DATABASE");
  });

  it("strips special characters", () => {
    expect(toBindingName("user-data (prod)")).toBe("USERDATA_PROD");
  });

  it("collapses multiple spaces", () => {
    expect(toBindingName("  Hello   World  ")).toBe("HELLO_WORLD");
  });

  it("falls back to BINDING for empty/special-only labels", () => {
    expect(toBindingName("")).toBe("BINDING");
    expect(toBindingName("!!!")).toBe("BINDING");
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — empty / no-CF-nodes cases
// ---------------------------------------------------------------------------

describe("generateScaffold — empty cases", () => {
  it("returns an empty map for an empty diagram", () => {
    const files = generateScaffold(makeInput());
    expect(files.size).toBe(0);
  });

  it("returns an empty map when only external nodes are present", () => {
    const files = generateScaffold(
      makeInput({
        nodes: [
          { typeId: "external-api", label: "Some API" },
          { typeId: "client-browser", label: "Browser" },
        ],
      }),
    );
    expect(files.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — vanilla Worker
// ---------------------------------------------------------------------------

describe("generateScaffold — vanilla Worker", () => {
  const files = generateScaffold(
    makeInput({
      title: "My Vanilla App",
      nodes: [{ typeId: "worker", label: "API Worker" }],
    }),
  );

  it("generates wrangler.toml with the project name", () => {
    const toml = files.get("wrangler.toml")!;
    expect(toml).toContain('name = "my-vanilla-app"');
    expect(toml).toContain('main = "src/index.ts"');
    expect(toml).toContain("compatibility_flags");
  });

  it("generates a vanilla src/index.ts", () => {
    const src = files.get("src/index.ts")!;
    expect(src).toContain("async fetch(");
    expect(src).toContain("Hello from Cloudflare Workers!");
  });

  it("generates package.json with wrangler and deploy scripts", () => {
    const pkg = JSON.parse(files.get("package.json")!);
    expect(pkg.name).toBe("my-vanilla-app");
    expect(pkg.scripts.dev).toBe("wrangler dev");
    expect(pkg.scripts["deploy:cf"]).toBe("wrangler deploy");
    expect(pkg.scripts.deploy).toBe("run-s deploy:cf");
    expect(pkg.devDependencies.wrangler).toBeDefined();
    expect(pkg.devDependencies["npm-run-all"]).toBeDefined();
  });

  it("generates tsconfig.json", () => {
    expect(files.has("tsconfig.json")).toBe(true);
  });

  it("generates README.md", () => {
    const readme = files.get("README.md")!;
    expect(readme).toContain("my-vanilla-app");
    expect(readme).toContain("npm install");
    expect(readme).toContain("npm run deploy");
  });

  it("does NOT include Drizzle files", () => {
    expect(files.has("drizzle.config.ts")).toBe(false);
    expect(files.has("src/db/schema.ts")).toBe(false);
    expect(files.has("src/db/client.ts")).toBe(false);
    expect(files.has("migrations/0001_initial.sql")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — Hono Worker + D1 + KV
// ---------------------------------------------------------------------------

describe("generateScaffold — Hono + D1 + KV", () => {
  const files = generateScaffold(
    makeInput({
      title: "Hono API",
      nodes: [
        { typeId: "worker-hono", label: "API" },
        { typeId: "d1", label: "Main Database" },
        { typeId: "kv", label: "Cache Store" },
      ],
    }),
  );

  it("generates wrangler.toml with D1 and KV bindings", () => {
    const toml = files.get("wrangler.toml")!;
    expect(toml).toContain("[[d1_databases]]");
    expect(toml).toContain('binding = "MAIN_DATABASE"');
    expect(toml).toContain('database_name = "main-database"');
    expect(toml).toContain("[[kv_namespaces]]");
    expect(toml).toContain('binding = "CACHE_STORE"');
  });

  it("generates Hono src/index.ts", () => {
    const src = files.get("src/index.ts")!;
    expect(src).toContain("Hono");
    expect(src).toContain("Hello from Hono");
  });

  it("generates package.json with hono, drizzle, and D1 scripts", () => {
    const pkg = JSON.parse(files.get("package.json")!);
    expect(pkg.dependencies.hono).toBeDefined();
    expect(pkg.dependencies["drizzle-orm"]).toBeDefined();
    expect(pkg.devDependencies["drizzle-kit"]).toBeDefined();
    expect(pkg.scripts["deploy:db"]).toContain("MAIN_DATABASE");
    expect(pkg.scripts.deploy).toBe("run-s deploy:db deploy:cf");
    expect(pkg.scripts["db:generate"]).toBe("drizzle-kit generate");
    expect(pkg.scripts["db:migrate:local"]).toContain("MAIN_DATABASE");
  });

  it("includes Drizzle config, schema, client, and migration stub", () => {
    expect(files.has("drizzle.config.ts")).toBe(true);
    expect(files.has("src/db/schema.ts")).toBe(true);
    expect(files.has("src/db/client.ts")).toBe(true);

    const migration = files.get("migrations/0001_initial.sql")!;
    expect(migration).toContain("CREATE TABLE");
  });

  it("README includes D1 sections", () => {
    const readme = files.get("README.md")!;
    expect(readme).toContain("Drizzle ORM");
    expect(readme).toContain("db:migrate:local");
    expect(readme).toContain("deploy:db");
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — Astro + R2
// ---------------------------------------------------------------------------

describe("generateScaffold — Astro + R2", () => {
  const files = generateScaffold(
    makeInput({
      title: "My Astro Site",
      nodes: [
        { typeId: "worker-astro", label: "Web App" },
        { typeId: "r2", label: "Asset Bucket" },
      ],
    }),
  );

  it("generates Astro scaffold files", () => {
    expect(files.has("astro.config.mjs")).toBe(true);
    expect(files.has("src/pages/index.astro")).toBe(true);
    expect(files.has("src/index.ts")).toBe(false);
  });

  it("generates wrangler.toml with R2 binding and astro-specific config", () => {
    const toml = files.get("wrangler.toml")!;
    expect(toml).toContain("[[r2_buckets]]");
    expect(toml).toContain('binding = "ASSET_BUCKET"');
    expect(toml).toContain("[assets]");
  });

  it("generates package.json with astro deps and astro dev command", () => {
    const pkg = JSON.parse(files.get("package.json")!);
    expect(pkg.dependencies.astro).toBeDefined();
    expect(pkg.dependencies["@astrojs/cloudflare"]).toBeDefined();
    expect(pkg.scripts.dev).toBe("astro dev");
    expect(pkg.scripts["deploy:cf"]).toBe("npm run build && wrangler deploy");
  });

  it("does NOT include Drizzle files", () => {
    expect(files.has("drizzle.config.ts")).toBe(false);
  });

  it("README omits D1 sections", () => {
    const readme = files.get("README.md")!;
    expect(readme).not.toContain("Drizzle ORM");
    expect(readme).not.toContain("deploy:db");
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — bindings only (no Worker node)
// ---------------------------------------------------------------------------

describe("generateScaffold — bindings without explicit Worker node", () => {
  const files = generateScaffold(
    makeInput({
      title: "Storage Only",
      nodes: [
        { typeId: "kv", label: "Session Store" },
        { typeId: "r2", label: "Uploads" },
      ],
    }),
  );

  it("still generates a scaffold with vanilla Worker template", () => {
    expect(files.size).toBeGreaterThan(0);
    const src = files.get("src/index.ts")!;
    expect(src).toContain("Hello from Cloudflare Workers!");
  });

  it("includes KV and R2 bindings in wrangler.toml", () => {
    const toml = files.get("wrangler.toml")!;
    expect(toml).toContain("[[kv_namespaces]]");
    expect(toml).toContain("[[r2_buckets]]");
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — AI binding (singleton)
// ---------------------------------------------------------------------------

describe("generateScaffold — Workers AI binding", () => {
  const files = generateScaffold(
    makeInput({
      nodes: [
        { typeId: "worker", label: "AI Worker" },
        { typeId: "workers-ai", label: "Workers AI" },
      ],
    }),
  );

  it("generates [ai] binding in wrangler.toml", () => {
    const toml = files.get("wrangler.toml")!;
    expect(toml).toContain("[ai]");
    expect(toml).toContain('binding = "AI"');
  });
});

// ---------------------------------------------------------------------------
// generateScaffold — multiple D1 databases
// ---------------------------------------------------------------------------

describe("generateScaffold — multiple D1 databases", () => {
  const files = generateScaffold(
    makeInput({
      nodes: [
        { typeId: "worker", label: "Worker" },
        { typeId: "d1", label: "Users DB" },
        { typeId: "d1", label: "Analytics DB" },
      ],
    }),
  );

  it("generates separate D1 binding sections", () => {
    const toml = files.get("wrangler.toml")!;
    expect(toml).toContain('binding = "USERS_DB"');
    expect(toml).toContain('binding = "ANALYTICS_DB"');
  });

  it("deploy:db uses the first D1 binding", () => {
    const pkg = JSON.parse(files.get("package.json")!);
    expect(pkg.scripts["deploy:db"]).toContain("USERS_DB");
  });
});
