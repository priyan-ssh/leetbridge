import type { LeetBridgeLanguage } from "../config";

export const PLATFORMS = {
  LEETCODE: "leetcode"
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

export const PROBLEM_DIFFICULTIES = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  UNKNOWN: "Unknown"
} as const;

export type ProblemDifficulty =
  (typeof PROBLEM_DIFFICULTIES)[keyof typeof PROBLEM_DIFFICULTIES];

export const SUBMISSION_VERDICTS = {
  accepted: "Accepted",
  wrongAnswer: "Wrong Answer",
  timeLimitExceeded: "Time Limit Exceeded",
  memoryLimitExceeded: "Memory Limit Exceeded",
  runtimeError: "Runtime Error",
  compileError: "Compile Error",
  outputLimitExceeded: "Output Limit Exceeded",
  unknown: "Unknown"
} as const;

export type SubmissionVerdict =
  (typeof SUBMISSION_VERDICTS)[keyof typeof SUBMISSION_VERDICTS];

export interface SubmissionMetrics {
  runtime?: string;
  memory?: string;
  runtimePercentile?: number;
  memoryPercentile?: number;
}

export interface SubmissionResult {
  verdict: SubmissionVerdict;
  message: string;
  submissionId: string;
  checkedAt: string;
  metrics: SubmissionMetrics;
  passedTestCount?: number;
  totalTestCount?: number;
}

export interface ProblemCodeSnippet {
  language: string;
  languageSlug: string;
  code: string;
}

export interface ProblemData {
  platform: Platform;
  url: string;
  slug: string;
  problemId?: string;
  title: string;
  content: string;
  difficulty: ProblemDifficulty;
  codeSnippets: ProblemCodeSnippet[];
}

export interface CurrentProblemContext {
  platform: Platform;
  url: string;
  slug: string;
  problemId?: string;
  language: LeetBridgeLanguage;
  fetchedAt: string;
  lastSubmissionId?: string;
  lastSubmissionVerdict?: SubmissionVerdict;
  lastSubmissionCheckedAt?: string;
}
