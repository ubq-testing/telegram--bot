import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/worker.ts", "src/workflow-entry.ts"],
  project: ["src/**/*.ts"],
  ignore: ["src/types/config.ts", "**/__mocks__/**", "**/__fixtures__/**", "src/workflow-bot-mtproto-api/bot/scripts/sms-auth/*.ts"],
  ignoreExportsUsedInFile: true,
  // eslint can also be safely ignored as per the docs: https://knip.dev/guides/handling-issues#eslint--jest
  ignoreDependencies: ["eslint-config-prettier", "eslint-plugin-prettier", "smee-client", "libsodium-wrappers", "input"],
  eslint: true,
};

export default config;
