import type { LeetBridgeLanguage } from "../config";

export type Platform = "leetcode";

export type ProblemDifficulty = "Easy" | "Medium" | "Hard" | "Unknown";

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
