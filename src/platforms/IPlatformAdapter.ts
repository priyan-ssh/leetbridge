import type { LeetBridgeConfig } from "../config";
import type { PlatformLogger } from "./logger";
import type { Platform, ProblemData, SubmissionResult } from "./types";

export interface FetchProblemInput {
  problemUrl: string;
  config: LeetBridgeConfig;
  logger?: PlatformLogger;
}

export interface SubmitCodeInput {
  problemUrl: string;
  slug: string;
  problemId?: string;
  language: string;
  code: string;
  config: LeetBridgeConfig;
  logger?: PlatformLogger;
}

export interface IPlatformAdapter {
  readonly platform: Platform;
  canHandle(url: URL): boolean;
  fetchProblem(input: FetchProblemInput): Promise<ProblemData>;
  submitCode(input: SubmitCodeInput): Promise<SubmissionResult>;
}
