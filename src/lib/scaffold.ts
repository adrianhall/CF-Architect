/**
 * Project scaffold generator.
 *
 * Walks a diagram graph and produces a Map<filePath, fileContent> representing
 * a downloadable wrangler project. The caller (ScaffoldButton) is responsible
 * for zipping the map and triggering the browser download.
 */

import { NODE_TYPE_MAP } from "./catalog";

import vanillaIndex from "./scaffold-templates/vanilla/src/index.ts?raw";
import honoIndex from "./scaffold-templates/hono/src/index.ts?raw";
import astroConfig from "./scaffold-templates/astro/astro.config.mjs?raw";
import astroIndex from "./scaffold-templates/astro/src/pages/index.astro?raw";
import drizzleConfig from "./scaffold-templates/drizzle/drizzle.config.ts?raw";
import drizzleSchema from "./scaffold-templates/drizzle/src/db/schema.ts?raw";
import drizzleClient from "./scaffold-templates/drizzle/src/db/client.ts?raw";
import migrationStub from "./scaffold-templates/migrations/0001_initial.sql?raw";
import readmeTemplate from "./scaffold-templates/README.md.tmpl?raw";
import baseTsconfig from "./scaffold-templates/tsconfig.json?raw";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScaffoldNode {
  typeId: string;
  label: string;
}

interface ScaffoldEdge {
  source: string;
  target: string;
  edgeType?: string;
}

export interface ScaffoldInput {
  title: string;
  nodes: ScaffoldNode[];
  edges: ScaffoldEdge[];
}

interface ResolvedBinding {
  /** wrangler.toml section key, e.g. "d1_databases" */
  wranglerBinding: string;
  /** SCREAMING_SNAKE_CASE binding name */
  bindingName: string;
  /** Human label from the diagram */
  label: string;
  /** Lowercase resource name for wrangler.toml resource-name fields */
  resourceName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a user label into SCREAMING_SNAKE_CASE suitable for a binding name.
 * e.g. "My D1 Database" -> "MY_D1_DATABASE"
 */
export function toBindingName(label: string): string {
  return (
    label
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toUpperCase() || "BINDING"
  );
}

/**
 * Convert a label into a lowercase-kebab resource name.
 * e.g. "My D1 Database" -> "my-d1-database"
 */
function toResourceName(label: string): string {
  return (
    label
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "resource"
  );
}

/**
 * Sanitise a title into a valid npm package / wrangler project name.
 */
function toProjectName(title: string): string {
  return (
    title
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "my-cloudflare-project"
  );
}

// ---------------------------------------------------------------------------
// Binding section generators for wrangler.toml
// ---------------------------------------------------------------------------

type SectionEmitter = (bindings: ResolvedBinding[]) => string;

const sectionEmitters: Record<string, SectionEmitter> = {
  d1_databases: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[d1_databases]]\nbinding = "${b.bindingName}"\ndatabase_name = "${b.resourceName}"\ndatabase_id = "<INSERT_DATABASE_ID>"\nmigrations_dir = "migrations"`,
      )
      .join("\n\n"),

  kv_namespaces: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[kv_namespaces]]\nbinding = "${b.bindingName}"\nid = "<INSERT_NAMESPACE_ID>"`,
      )
      .join("\n\n"),

  r2_buckets: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[r2_buckets]]\nbinding = "${b.bindingName}"\nbucket_name = "${b.resourceName}"`,
      )
      .join("\n\n"),

  queues: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[queues.producers]]\nbinding = "${b.bindingName}"\nqueue = "${b.resourceName}"`,
      )
      .join("\n\n"),

  ai: () => `[ai]\nbinding = "AI"`,

  durable_objects: (bindings) => {
    const classes = bindings
      .map(
        (b) =>
          `  { binding = "${b.bindingName}", class_name = "${b.bindingName}" }`,
      )
      .join(",\n");
    return `[durable_objects]\nbindings = [\n${classes}\n]`;
  },

  vectorize: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[vectorize]]\nbinding = "${b.bindingName}"\nindex_name = "${b.resourceName}"`,
      )
      .join("\n\n"),

  hyperdrive: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[hyperdrive]]\nbinding = "${b.bindingName}"\nid = "<INSERT_HYPERDRIVE_ID>"`,
      )
      .join("\n\n"),

  analytics_engine_datasets: (bindings) =>
    bindings
      .map((b) => `[[analytics_engine_datasets]]\nbinding = "${b.bindingName}"`)
      .join("\n\n"),

  browser: () => `[browser]\nbinding = "BROWSER"`,

  dispatch_namespaces: (bindings) =>
    bindings
      .map(
        (b) =>
          `[[dispatch_namespaces]]\nbinding = "${b.bindingName}"\nnamespace = "${b.resourceName}"`,
      )
      .join("\n\n"),
};

// ---------------------------------------------------------------------------
// wrangler.toml generation
// ---------------------------------------------------------------------------

function generateWranglerToml(
  projectName: string,
  bindingsByType: Map<string, ResolvedBinding[]>,
  scaffoldTemplate: string,
): string {
  const lines: string[] = [
    `name = "${projectName}"`,
    `main = "${scaffoldTemplate === "astro" ? "dist/_worker.js" : "src/index.ts"}"`,
    `compatibility_date = "${new Date().toISOString().slice(0, 10)}"`,
    `compatibility_flags = ["nodejs_compat"]`,
  ];

  if (scaffoldTemplate === "astro") {
    lines.push(`\n[assets]\ndirectory = "dist"`);
  }

  for (const [bindingType, bindings] of bindingsByType) {
    const emitter = sectionEmitters[bindingType];
    if (emitter) {
      lines.push("");
      lines.push(emitter(bindings));
    }
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// package.json generation
// ---------------------------------------------------------------------------

function generatePackageJson(
  projectName: string,
  scaffoldTemplate: string,
  hasD1: boolean,
  d1Bindings: ResolvedBinding[],
): string {
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {
    wrangler: "^4.0.0",
    "@cloudflare/workers-types": "^4.0.0",
    typescript: "^5.7.0",
    "npm-run-all": "^4.1.5",
  };

  if (scaffoldTemplate === "hono") {
    deps["hono"] = "^4.0.0";
  } else if (scaffoldTemplate === "astro") {
    deps["astro"] = "^5.0.0";
    deps["@astrojs/cloudflare"] = "^12.0.0";
  }

  if (hasD1) {
    deps["drizzle-orm"] = "^0.39.0";
    devDeps["drizzle-kit"] = "^0.30.0";
  }

  const scripts: Record<string, string> = {};

  if (scaffoldTemplate === "astro") {
    scripts["dev"] = "astro dev";
    scripts["build"] = "astro build";
    scripts["deploy:cf"] = "npm run build && wrangler deploy";
  } else {
    scripts["dev"] = "wrangler dev";
    scripts["deploy:cf"] = "wrangler deploy";
  }

  if (hasD1) {
    const firstD1 = d1Bindings[0]?.bindingName ?? "DB";
    scripts["deploy:db"] = `wrangler d1 migrations apply ${firstD1} --remote`;
    scripts["deploy"] = "run-s deploy:db deploy:cf";
    scripts["db:generate"] = "drizzle-kit generate";
    scripts["db:migrate:local"] =
      `wrangler d1 migrations apply ${firstD1} --local`;
  } else {
    scripts["deploy"] = "run-s deploy:cf";
  }

  const pkg = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts,
    dependencies: Object.keys(deps).length > 0 ? deps : undefined,
    devDependencies: devDeps,
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// README generation
// ---------------------------------------------------------------------------

function generateReadme(projectName: string, hasD1: boolean): string {
  let readme = readmeTemplate.replace(/\{\{PROJECT_NAME\}\}/g, projectName);

  if (hasD1) {
    readme = readme
      .replace(/\{\{D1_LOCAL_SECTION\}\}\n/g, "")
      .replace(/\{\{D1_LOCAL_SECTION_START\}\}\n/g, "")
      .replace(/\{\{D1_LOCAL_SECTION_END\}\}\n/g, "")
      .replace(/\{\{D1_DEPLOY_SECTION_START\}\}\n/g, "")
      .replace(/\{\{D1_DEPLOY_SECTION_END\}\}\n/g, "")
      .replace(
        /\{\{NO_D1_DEPLOY_SECTION_START\}\}[\s\S]*?\{\{NO_D1_DEPLOY_SECTION_END\}\}\n/g,
        "",
      )
      .replace(/\{\{D1_LINKS_START\}\}\n/g, "")
      .replace(/\{\{D1_LINKS_END\}\}\n/g, "");
  } else {
    readme = readme
      .replace(/\{\{D1_LOCAL_SECTION\}\}\n/g, "")
      .replace(
        /\{\{D1_LOCAL_SECTION_START\}\}[\s\S]*?\{\{D1_LOCAL_SECTION_END\}\}\n/g,
        "",
      )
      .replace(
        /\{\{D1_DEPLOY_SECTION_START\}\}[\s\S]*?\{\{D1_DEPLOY_SECTION_END\}\}\n/g,
        "",
      )
      .replace(/\{\{NO_D1_DEPLOY_SECTION_START\}\}\n/g, "")
      .replace(/\{\{NO_D1_DEPLOY_SECTION_END\}\}\n/g, "")
      .replace(/\{\{D1_LINKS_START\}\}[\s\S]*?\{\{D1_LINKS_END\}\}\n/g, "");
  }

  return readme;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate a complete project scaffold from a diagram.
 *
 * @returns A Map of file paths to file contents. Empty map if no Cloudflare
 *          nodes with bindings are found (caller should show a disabled state).
 */
export function generateScaffold(input: ScaffoldInput): Map<string, string> {
  const files = new Map<string, string>();
  const projectName = toProjectName(input.title);

  const bindingsByType = new Map<string, ResolvedBinding[]>();
  let scaffoldTemplate = "vanilla";
  let hasWorker = false;

  for (const node of input.nodes) {
    const def = NODE_TYPE_MAP.get(node.typeId);
    if (!def) continue;

    if (def.scaffoldTemplate) {
      scaffoldTemplate = def.scaffoldTemplate;
    }

    if (def.wranglerBinding === "worker") {
      hasWorker = true;
      continue;
    }

    if (!def.wranglerBinding) continue;

    const binding: ResolvedBinding = {
      wranglerBinding: def.wranglerBinding,
      bindingName: toBindingName(node.label),
      label: node.label,
      resourceName: toResourceName(node.label),
    };

    const existing = bindingsByType.get(def.wranglerBinding) ?? [];
    existing.push(binding);
    bindingsByType.set(def.wranglerBinding, existing);
  }

  const hasBindings = bindingsByType.size > 0;
  if (!hasWorker && !hasBindings) {
    return files;
  }

  const hasD1 = bindingsByType.has("d1_databases");
  const d1Bindings = bindingsByType.get("d1_databases") ?? [];

  files.set(
    "wrangler.toml",
    generateWranglerToml(projectName, bindingsByType, scaffoldTemplate),
  );

  files.set(
    "package.json",
    generatePackageJson(projectName, scaffoldTemplate, hasD1, d1Bindings),
  );

  files.set("tsconfig.json", baseTsconfig);

  switch (scaffoldTemplate) {
    case "hono":
      files.set("src/index.ts", honoIndex);
      break;
    case "astro":
      files.set("astro.config.mjs", astroConfig);
      files.set("src/pages/index.astro", astroIndex);
      break;
    default:
      files.set("src/index.ts", vanillaIndex);
      break;
  }

  if (hasD1) {
    files.set("drizzle.config.ts", drizzleConfig);
    files.set("src/db/schema.ts", drizzleSchema);
    files.set("src/db/client.ts", drizzleClient);
    files.set("migrations/0001_initial.sql", migrationStub);
  }

  files.set("README.md", generateReadme(projectName, hasD1));

  return files;
}
