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

export interface ProblemCodeSnippet {
  language: string;
  languageSlug: string;
  code: string;
}

export interface ProblemData {
  platform: Platform;
  url: string;
  slug: string;
  title: string;
  content: string;
  difficulty: ProblemDifficulty;
  codeSnippets: ProblemCodeSnippet[];
}

export interface CurrentProblemContext {
  platform: Platform;
  url: string;
  slug: string;
  language: LeetBridgeLanguage;
  fetchedAt: string;
}
