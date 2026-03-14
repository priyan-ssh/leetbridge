import * as vscode from "vscode";
import type { CurrentProblemContext } from "./platforms/types";

const CURRENT_PROBLEM_CONTEXT_KEY = "leetbridge.currentProblemContext";

export function getCurrentProblemContext(
  context: vscode.ExtensionContext
): CurrentProblemContext | undefined {
  return context.workspaceState.get<CurrentProblemContext>(CURRENT_PROBLEM_CONTEXT_KEY);
}

export async function setCurrentProblemContext(
  context: vscode.ExtensionContext,
  problemContext: CurrentProblemContext
): Promise<void> {
  await context.workspaceState.update(CURRENT_PROBLEM_CONTEXT_KEY, problemContext);
}
