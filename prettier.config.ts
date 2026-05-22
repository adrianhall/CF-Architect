import type { Config } from "prettier";

const config: Config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  printWidth: 100,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  // JSON files
  overrides: [
    {
      files: "*.json",
      options: { printWidth: 120 },
    },
    {
      files: ["*.jsonc", "*.json5"],
      options: { printWidth: 120 },
    },
  ],
};

export default config;
