import * as vscode from "vscode";

export type LeetBridgeLanguage = "python" | "javascript" | "java" | "cpp";

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
  const config = vscode.workspace.getConfiguration("leetbridge");

  const leetcodeSessionToken = config
    .get<string>("leetcodeSessionToken", "")
    .trim();

  const csrfToken = config.get<string>("csrfToken", "").trim();

  const configuredLanguage = config
    .get<string>("defaultLanguage", "python")
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
