export const OUTPUT_CHANNEL_NAME = "LeetBridge";
export const SETTINGS_SEARCH_QUERY = "LeetBridge";

export const COMMAND_IDS = {
  setupAuth: "leetbridge.setupAuth",
  fetchProblem: "leetbridge.fetch"
} as const;

export const USER_ACTIONS = {
  openSettings: "Open Settings"
} as const;

export const VSCODE_COMMANDS = {
  openSettings: "workbench.action.openSettings"
} as const;

export const UI_TEXT = {
  setupAuthConfigured: "LeetBridge authentication is configured.",
  setupAuthMissing:
    "LeetBridge authentication is incomplete. Missing {{fields}}. Open settings and paste your LeetCode browser cookies.",
  fetchInputTitle: "LeetBridge: Fetch Problem",
  fetchInputPrompt: "Paste a problem URL to fetch metadata and save context.",
  fetchInputPlaceholder: "https://leetcode.com/problems/two-sum/",
  fetchSuccess:
    "Fetched \"{{title}}\" ({{difficulty}}) and saved problem context.",
  problemUrlRequired: "Problem URL is required.",
  invalidProblemUrl: "Enter a valid URL.",
  invalidProblemUrlProtocol: "Problem URL must use HTTP or HTTPS.",
  unknownError:
    "LeetBridge hit an unexpected error. Check the LeetBridge output channel."
} as const;
