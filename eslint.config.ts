import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import globals from "globals";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.terraform/**",
      "**/.wrangler/**",
      "apps/web/src/routeTree.gen.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },

  // Base JS rules for all files
  eslintJs.configs.recommended,

  // TypeScript rules for all TS/TSX files
  ...tseslint.configs.recommended,

  // Type-aware TypeScript + React rules for app production source files.
  // Files must be included in their workspace tsconfig.json.
  {
    files: [
      "apps/web/src/**/*.ts",
      "apps/web/src/**/*.tsx",
      "apps/worker/src/**/*.ts",
      "packages/shared/src/**/*.ts",
    ],
    // Exclude test files from type-aware lint (they have different type environments)
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    extends: [eslintReact.configs["recommended-typescript"]],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
  },

  // Non-type-aware TypeScript rules for config files and test files.
  // These files are excluded from workspace tscconfigs so projectService
  // cannot resolve them — apply syntax-only TS rules here.
  {
    files: ["**/*.config.ts", "**/*.test.ts", "**/*.test.tsx", "e2e/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Node/script files — no browser globals, relax some rules
  {
    files: ["scripts/**/*.{ts,mjs,js}", "*.config.{ts,js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Scripts often need console output
      "no-console": "off",
    },
  },

  // Worker files — Cloudflare Workers runtime (no browser/Node globals)
  {
    files: ["apps/worker/src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.es2022,
      },
    },
  },

  // Test files — relax strict rules
  {
    files: ["**/*.test.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // General rules applied everywhere
  {
    rules: {
      // Prefer const
      "prefer-const": "error",
      // No unused vars (use underscore prefix to ignore)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
);
