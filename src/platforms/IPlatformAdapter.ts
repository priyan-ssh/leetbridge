import type { LeetBridgeConfig } from "../config";
import type { Platform, ProblemData } from "./types";

export interface FetchProblemInput {
  problemUrl: string;
  config: LeetBridgeConfig;
}

export interface IPlatformAdapter {
  readonly platform: Platform;
  canHandle(url: URL): boolean;
  fetchProblem(input: FetchProblemInput): Promise<ProblemData>;
}
