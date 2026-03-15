import * as vscode from "vscode";
import {
  getLeetBridgeConfig,
  LEETBRIDGE_CONFIG,
  type LeetBridgeConfig,
  type LeetBridgeLanguage
} from "./config";
import {
  COMMAND_IDS,
  OUTPUT_CHANNEL_NAME,
  SETTINGS_SEARCH_QUERY,
  UI_TEXT,
  USER_ACTIONS,
  VSCODE_COMMANDS
} from "./constants";
import { PlatformFactory } from "./platforms/PlatformFactory";
import type { PlatformLogger } from "./platforms/logger";
import { PLATFORMS, type SubmissionResult } from "./platforms/types";
import { isSupportedProblemUrlProtocol } from "./platforms/urlValidation";
import { getCurrentProblemContext, setCurrentProblemContext } from "./state";

type AsyncCommandHandler = () => Promise<void>;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const logger = createOutputChannelLogger(outputChannel);
  const platformFactory = new PlatformFactory({ logger });

  const restoredContext = getCurrentProblemContext(context);

  if (restoredContext) {
    logger.info(
      `Restored problem context ${restoredContext.platform}:${restoredContext.slug}`
    );
  }

  const setupAuthDisposable = vscode.commands.registerCommand(
    COMMAND_IDS.setupAuth,
    withCommandErrorHandling(
      COMMAND_IDS.setupAuth,
      outputChannel,
      runSetupAuthCommand
    )
  );

  const fetchProblemDisposable = vscode.commands.registerCommand(
    COMMAND_IDS.fetchProblem,
    withCommandErrorHandling(
      COMMAND_IDS.fetchProblem,
      outputChannel,
      async () => {
        await runFetchProblemCommand(context, platformFactory, logger);
      }
    )
  );

  const submitDisposable = vscode.commands.registerCommand(
    COMMAND_IDS.submit,
    withCommandErrorHandling(COMMAND_IDS.submit, outputChannel, async () => {
      await runSubmitCommand(context, platformFactory, logger);
    })
  );

  const runDisposable = vscode.commands.registerCommand(
    COMMAND_IDS.run,
    withCommandErrorHandling(COMMAND_IDS.run, outputChannel, async () => {
      await runRunCommand(logger);
    })
  );

  context.subscriptions.push(
    outputChannel,
    setupAuthDisposable,
    fetchProblemDisposable,
    runDisposable,
    submitDisposable
  );
}

export function deactivate(): void {}

async function runSetupAuthCommand(): Promise<void> {
  const config = getLeetBridgeConfig();
  const missingFields = getMissingAuthFields(config);

  if (missingFields.length === 0) {
    void vscode.window.showInformationMessage(UI_TEXT.setupAuthConfigured);
    return;
  }

  await promptToOpenSettings(missingFields);
}

async function runFetchProblemCommand(
  context: vscode.ExtensionContext,
  platformFactory: PlatformFactory,
  logger: PlatformLogger
): Promise<void> {
  const problemUrl = await promptForProblemUrl();

  if (!problemUrl) {
    logger.debug("Fetch problem command cancelled before URL submission");
    return;
  }

  logger.info(`Starting problem fetch flow for URL: ${problemUrl}`);

  const config = getLeetBridgeConfig();
  const adapter = platformFactory.resolveAdapter(problemUrl);

  if (adapter.platform === PLATFORMS.LEETCODE) {
    const missingFields = getMissingAuthFields(config);

    if (missingFields.length > 0) {
      await promptToOpenSettings(missingFields);
      return;
    }
  }

  const problem = await adapter.fetchProblem({
    problemUrl,
    config,
    logger
  });

  await setCurrentProblemContext(context, {
    platform: problem.platform,
    url: problem.url,
    slug: problem.slug,
    problemId: problem.problemId,
    language: config.defaultLanguage,
    fetchedAt: new Date().toISOString()
  });

  logger.info(`Fetched ${problem.platform}:${problem.slug}`);

  void vscode.window.showInformationMessage(
    UI_TEXT.fetchSuccess
      .replace("{{title}}", problem.title)
      .replace("{{difficulty}}", problem.difficulty)
  );
}

async function runSubmitCommand(
  context: vscode.ExtensionContext,
  platformFactory: PlatformFactory,
  logger: PlatformLogger
): Promise<void> {
  const currentProblemContext = getCurrentProblemContext(context);

  if (!currentProblemContext) {
    throw new Error(UI_TEXT.submitRequiresContext);
  }

  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    throw new Error(UI_TEXT.submitRequiresEditor);
  }

  if (!activeEditor.document.getText().trim()) {
    throw new Error(UI_TEXT.submitRequiresCode);
  }

  logger.info(
    `Starting submit flow for ${currentProblemContext.platform}:${currentProblemContext.slug}`
  );

  const config = getLeetBridgeConfig();
  const adapter = platformFactory.resolveAdapter(currentProblemContext.url);

  if (adapter.platform === PLATFORMS.LEETCODE) {
    const missingFields = getMissingAuthFields(config);

    if (missingFields.length > 0) {
      await promptToOpenSettings(missingFields);
      return;
    }
  }

  const code = activeEditor.document.getText();

  if (!code.trim()) {
    throw new Error(UI_TEXT.submitRequiresCode);
  }

  const submitLanguage = resolveSubmissionLanguage(
    activeEditor.document.languageId,
    currentProblemContext.language,
    logger
  );

  const submissionResult = await adapter.submitCode({
    problemUrl: currentProblemContext.url,
    slug: currentProblemContext.slug,
    problemId: currentProblemContext.problemId,
    language: submitLanguage,
    code,
    config,
    logger
  });

  await setCurrentProblemContext(context, {
    ...currentProblemContext,
    lastSubmissionId: submissionResult.submissionId,
    lastSubmissionVerdict: submissionResult.verdict,
    lastSubmissionCheckedAt: submissionResult.checkedAt
  });

  logger.info(
    `Submission completed for ${currentProblemContext.slug}: ${submissionResult.verdict}`
  );

  void vscode.window.showInformationMessage(
    formatSubmissionResultMessage(submissionResult)
  );
}

async function runRunCommand(logger: PlatformLogger): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    throw new Error(UI_TEXT.runRequiresEditor);
  }

  if (!activeEditor.document.getText().trim()) {
    throw new Error(UI_TEXT.runRequiresCode);
  }

  logger.info("Starting run flow for active editor");

  const didSave = await activeEditor.document.save();

  if (!didSave) {
    logger.info("Run cancelled because active editor save did not complete");
    void vscode.window.showInformationMessage(UI_TEXT.runCancelledSaveIncomplete);
    return;
  }

  await vscode.commands.executeCommand(VSCODE_COMMANDS.runActiveFile);

  logger.info("Run command launched in active terminal");
  void vscode.window.showInformationMessage(UI_TEXT.runStarted);
}

function resolveSubmissionLanguage(
  editorLanguageId: string,
  fallbackLanguage: LeetBridgeLanguage,
  logger: PlatformLogger
): LeetBridgeLanguage {
  const mappedLanguage = mapEditorLanguageIdToSubmitLanguage(editorLanguageId);

  if (mappedLanguage) {
    logger.debug(
      `Resolved submit language from active editor languageId "${editorLanguageId}": ${mappedLanguage}`
    );
    return mappedLanguage;
  }

  logger.info(
    `Active editor languageId "${editorLanguageId}" is unsupported for submit. Falling back to context language "${fallbackLanguage}".`
  );
  return fallbackLanguage;
}

function mapEditorLanguageIdToSubmitLanguage(
  editorLanguageId: string
): LeetBridgeLanguage | undefined {
  const normalizedLanguageId = editorLanguageId.trim().toLowerCase();

  if (normalizedLanguageId === "python") {
    return "python";
  }

  if (normalizedLanguageId === "javascript") {
    return "javascript";
  }

  if (normalizedLanguageId === "java") {
    return "java";
  }

  if (normalizedLanguageId === "cpp" || normalizedLanguageId === "c++") {
    return "cpp";
  }

  return undefined;
}

async function promptForProblemUrl(): Promise<string | undefined> {
  const result = await vscode.window.showInputBox({
    title: UI_TEXT.fetchInputTitle,
    prompt: UI_TEXT.fetchInputPrompt,
    placeHolder: UI_TEXT.fetchInputPlaceholder,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value.trim()) {
        return UI_TEXT.problemUrlRequired;
      }

      try {
        const parsed = new URL(value.trim());

        if (!isSupportedProblemUrlProtocol(parsed.protocol)) {
          return UI_TEXT.invalidProblemUrlProtocol;
        }
      } catch {
        return UI_TEXT.invalidProblemUrl;
      }

      return undefined;
    }
  });

  return result?.trim();
}

function getMissingAuthFields(config: LeetBridgeConfig): string[] {
  const missingFields: string[] = [];

  if (!config.leetcodeSessionToken) {
    missingFields.push(LEETBRIDGE_CONFIG.keys.leetcodeSessionToken);
  }

  if (!config.csrfToken) {
    missingFields.push(LEETBRIDGE_CONFIG.keys.csrfToken);
  }

  return missingFields;
}

async function promptToOpenSettings(missingFields: string[]): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    UI_TEXT.setupAuthMissing.replace("{{fields}}", missingFields.join(" and ")),
    USER_ACTIONS.openSettings
  );

  if (choice === USER_ACTIONS.openSettings) {
    await vscode.commands.executeCommand(
      VSCODE_COMMANDS.openSettings,
      SETTINGS_SEARCH_QUERY
    );
  }
}

function withCommandErrorHandling(
  commandName: string,
  outputChannel: vscode.OutputChannel,
  handler: AsyncCommandHandler
): () => Promise<void> {
  return async () => {
    outputChannel.appendLine(
      `[${new Date().toISOString()}] Command started: ${commandName}`
    );

    try {
      await handler();

      outputChannel.appendLine(
        `[${new Date().toISOString()}] Command completed: ${commandName}`
      );
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

  return UI_TEXT.unknownError;
}

function formatSubmissionResultMessage(result: SubmissionResult): string {
  const parts: string[] = [`${result.verdict}`];

  if (result.metrics.runtime) {
    parts.push(
      formatMetricPart(
        `Runtime ${result.metrics.runtime}`,
        result.metrics.runtimePercentile
      )
    );
  }

  if (result.metrics.memory) {
    parts.push(
      formatMetricPart(
        `Memory ${result.metrics.memory}`,
        result.metrics.memoryPercentile
      )
    );
  }

  if (
    result.passedTestCount !== undefined &&
    result.totalTestCount !== undefined
  ) {
    parts.push(`${result.passedTestCount}/${result.totalTestCount} tests`);
  }

  return parts.join(" | ");
}

function formatMetricPart(label: string, percentile: number | undefined): string {
  if (percentile === undefined) {
    return label;
  }

  return `${label} (${percentile.toFixed(2)}%)`;
}

function createOutputChannelLogger(
  outputChannel: vscode.OutputChannel
): PlatformLogger {
  const append = (level: "DEBUG" | "INFO" | "WARN" | "ERROR", message: string) => {
    outputChannel.appendLine(`[${new Date().toISOString()}] [${level}] ${message}`);
  };

  return {
    debug: (message: string) => {
      append("DEBUG", message);
    },
    info: (message: string) => {
      append("INFO", message);
    },
    warn: (message: string) => {
      append("WARN", message);
    },
    error: (message: string) => {
      append("ERROR", message);
    }
  };
}
