import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/", ".wrangler/", ".astro/", "migrations/"],
  },

  eslint.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
  },

  ...eslintPluginAstro.configs.recommended,

  {
    files: ["**/*.astro", "**/*.astro/*.ts"],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    files: ["**/*.tsx"],
    ...reactHooks.configs.flat["recommended-latest"],
  },

  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  eslintConfigPrettier,
);
