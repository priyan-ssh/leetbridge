import * as vscode from "vscode";
import { getLeetBridgeConfig, type LeetBridgeConfig } from "./config";
import { PlatformFactory } from "./platforms/PlatformFactory";
import { getCurrentProblemContext, setCurrentProblemContext } from "./state";

const SETUP_AUTH_COMMAND = "leetbridge.setupAuth";
const FETCH_PROBLEM_COMMAND = "leetbridge.fetch";
const OPEN_SETTINGS_ACTION = "Open Settings";

type AsyncCommandHandler = () => Promise<void>;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("LeetBridge");
  const platformFactory = new PlatformFactory();

  const restoredContext = getCurrentProblemContext(context);

  if (restoredContext) {
    outputChannel.appendLine(
      `[${new Date().toISOString()}] Restored problem context ${restoredContext.platform}:${restoredContext.slug}`
    );
  }

  const setupAuthDisposable = vscode.commands.registerCommand(
    SETUP_AUTH_COMMAND,
    withCommandErrorHandling(SETUP_AUTH_COMMAND, outputChannel, runSetupAuthCommand)
  );

  const fetchProblemDisposable = vscode.commands.registerCommand(
    FETCH_PROBLEM_COMMAND,
    withCommandErrorHandling(FETCH_PROBLEM_COMMAND, outputChannel, async () => {
      await runFetchProblemCommand(context, platformFactory, outputChannel);
    })
  );

  context.subscriptions.push(
    outputChannel,
    setupAuthDisposable,
    fetchProblemDisposable
  );
}

export function deactivate(): void {}

async function runSetupAuthCommand(): Promise<void> {
  const config = getLeetBridgeConfig();
  const missingFields = getMissingAuthFields(config);

  if (missingFields.length === 0) {
    void vscode.window.showInformationMessage(
      "LeetBridge authentication is configured."
    );
    return;
  }

  await promptToOpenSettings(missingFields);
}

async function runFetchProblemCommand(
  context: vscode.ExtensionContext,
  platformFactory: PlatformFactory,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const problemUrl = await promptForProblemUrl();

  if (!problemUrl) {
    return;
  }

  const config = getLeetBridgeConfig();
  const adapter = platformFactory.resolveAdapter(problemUrl);

  if (adapter.platform === "leetcode") {
    const missingFields = getMissingAuthFields(config);

    if (missingFields.length > 0) {
      await promptToOpenSettings(missingFields);
      return;
    }
  }

  const problem = await adapter.fetchProblem({
    problemUrl,
    config
  });

  await setCurrentProblemContext(context, {
    platform: problem.platform,
    url: problem.url,
    slug: problem.slug,
    language: config.defaultLanguage,
    fetchedAt: new Date().toISOString()
  });

  outputChannel.appendLine(
    `[${new Date().toISOString()}] Fetched ${problem.platform}:${problem.slug}`
  );

  void vscode.window.showInformationMessage(
    `Fetched "${problem.title}" (${problem.difficulty}) and saved problem context.`
  );
}

async function promptForProblemUrl(): Promise<string | undefined> {
  const result = await vscode.window.showInputBox({
    title: "LeetBridge: Fetch Problem",
    prompt: "Paste a problem URL to fetch metadata and save context.",
    placeHolder: "https://leetcode.com/problems/two-sum/",
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value.trim()) {
        return "Problem URL is required.";
      }

      try {
        const parsed = new URL(value.trim());

        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return "Problem URL must use HTTP or HTTPS.";
        }
      } catch {
        return "Enter a valid URL.";
      }

      return undefined;
    }
  });

  return result?.trim();
}

function getMissingAuthFields(config: LeetBridgeConfig): string[] {
  const missingFields: string[] = [];

  if (!config.leetcodeSessionToken) {
    missingFields.push("leetcodeSessionToken");
  }

  if (!config.csrfToken) {
    missingFields.push("csrfToken");
  }

  return missingFields;
}

async function promptToOpenSettings(missingFields: string[]): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `LeetBridge authentication is incomplete. Missing ${missingFields.join(
      " and "
    )}. Open settings and paste your LeetCode browser cookies.`,
    OPEN_SETTINGS_ACTION
  );

  if (choice === OPEN_SETTINGS_ACTION) {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "LeetBridge"
    );
  }
}

function withCommandErrorHandling(
  commandName: string,
  outputChannel: vscode.OutputChannel,
  handler: AsyncCommandHandler
): () => Promise<void> {
  return async () => {
    try {
      await handler();
    } catch (error) {
      logCommandError(commandName, error, outputChannel);
      void vscode.window.showErrorMessage(toUserErrorMessage(error));
    }
  };
}

function logCommandError(
  commandName: string,
  error: unknown,
  outputChannel: vscode.OutputChannel
): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] Command failed: ${commandName}`);

  if (error instanceof Error) {
    outputChannel.appendLine(error.message);

    if (error.stack) {
      outputChannel.appendLine(error.stack);
    }

    return;
  }

  outputChannel.appendLine(String(error));
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "LeetBridge hit an unexpected error. Check the LeetBridge output channel.";
}
