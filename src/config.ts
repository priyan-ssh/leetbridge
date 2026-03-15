import * as vscode from "vscode";

export type LeetBridgeLanguage = "python" | "javascript" | "java" | "cpp";

export const LEETBRIDGE_CONFIG = {
  section: "leetbridge",
  keys: {
    leetcodeSessionToken: "leetcodeSessionToken",
    csrfToken: "csrfToken",
    defaultLanguage: "defaultLanguage"
  }
} as const;

export interface LeetBridgeConfig {
  leetcodeSessionToken: string;
  csrfToken: string;
  defaultLanguage: LeetBridgeLanguage;
}

const SUPPORTED_LANGUAGES: LeetBridgeLanguage[] = [
  "python",
  "javascript",
  "java",
  "cpp"
];

export function getLeetBridgeConfig(): LeetBridgeConfig {
  const config = vscode.workspace.getConfiguration(LEETBRIDGE_CONFIG.section);

  const leetcodeSessionToken = config
    .get<string>(LEETBRIDGE_CONFIG.keys.leetcodeSessionToken, "")
    .trim();

  const csrfToken = config
    .get<string>(LEETBRIDGE_CONFIG.keys.csrfToken, "")
    .trim();

  const configuredLanguage = config
    .get<string>(LEETBRIDGE_CONFIG.keys.defaultLanguage, "python")
    .toLowerCase();

  const defaultLanguage: LeetBridgeLanguage = SUPPORTED_LANGUAGES.includes(
    configuredLanguage as LeetBridgeLanguage
  )
    ? (configuredLanguage as LeetBridgeLanguage)
    : "python";

  return {
    leetcodeSessionToken,
    csrfToken,
    defaultLanguage
  };
}
