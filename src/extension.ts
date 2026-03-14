import * as vscode from "vscode";
import { getLeetBridgeConfig } from "./config";

const SETUP_AUTH_COMMAND = "leetbridge.setupAuth";

export function activate(context: vscode.ExtensionContext): void {
  const setupAuthDisposable = vscode.commands.registerCommand(
    SETUP_AUTH_COMMAND,
    async () => {
      const { leetcodeSessionToken, csrfToken } = getLeetBridgeConfig();
      const missing: string[] = [];

      if (!leetcodeSessionToken) {
        missing.push("leetcodeSessionToken");
      }

      if (!csrfToken) {
        missing.push("csrfToken");
      }

      if (missing.length === 0) {
        void vscode.window.showInformationMessage(
          "LeetBridge authentication is configured."
        );
        return;
      }

      const openSettingsAction = "Open Settings";
      const choice = await vscode.window.showWarningMessage(
        `LeetBridge authentication is incomplete. Missing ${missing.join(
          " and "
        )}. Open settings and paste your LeetCode browser cookies.`,
        openSettingsAction
      );

      if (choice === openSettingsAction) {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "LeetBridge"
        );
      }
    }
  );

  context.subscriptions.push(setupAuthDisposable);
}

export function deactivate(): void {}
