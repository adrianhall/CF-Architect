import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow longer subject lines (URLs in commit messages are common)
    "header-max-length": [2, "always", 120],
    // Enforce scope to be lowercase
    "scope-case": [2, "always", "lower-case"],
  },
};

export default config;
