/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-require-imports": "off",
  },
  ignorePatterns: [
    "node_modules",
    "dist",
    ".next",
    "out",
    "coverage",
    "*.min.js",
    "**/*.vue", // Vue files need vue-eslint-parser — handled per-app
  ],
};
