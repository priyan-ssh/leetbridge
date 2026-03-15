export const OUTPUT_CHANNEL_NAME = "LeetBridge";
export const SETTINGS_SEARCH_QUERY = "LeetBridge";

export const COMMAND_IDS = {
  setupAuth: "leetbridge.setupAuth",
  fetchProblem: "leetbridge.fetch",
  run: "leetbridge.run",
  submit: "leetbridge.submit"
} as const;

export const USER_ACTIONS = {
  openSettings: "Open Settings"
} as const;

export const VSCODE_COMMANDS = {
  openSettings: "workbench.action.openSettings",
  runActiveFile: "workbench.action.terminal.runActiveFile"
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
  submitRequiresContext:
    "No fetched problem context found. Run 'LeetBridge: Fetch Problem' first.",
  runRequiresEditor: "Open a code editor with your solution before running.",
  runRequiresCode: "Cannot run empty code. Add your solution to the active editor.",
  runCancelledSaveIncomplete:
    "Run cancelled because the active file was not saved.",
  runStarted: "Run command started in the active terminal.",
  submitRequiresEditor: "Open a code editor with your solution before submitting.",
  submitRequiresCode: "Cannot submit empty code. Add your solution to the active editor.",
  problemUrlRequired: "Problem URL is required.",
  invalidProblemUrl: "Enter a valid URL.",
  invalidProblemUrlProtocol: "Problem URL must use HTTP or HTTPS.",
  unknownError:
    "LeetBridge hit an unexpected error. Check the LeetBridge output channel."
} as const;
