import type { Config } from "jest";

const config: Config = {
  displayName: "integration",
  rootDir: ".",
  testMatch: [
    "<rootDir>/src/**/*.integration-spec.ts",
    "<rootDir>/test/**/*.spec.ts",
  ],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  moduleFileExtensions: ["ts", "js", "json"],
};

export default config;
