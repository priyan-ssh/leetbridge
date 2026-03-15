import {
  PROBLEM_DIFFICULTIES,
  type ProblemData,
  type ProblemDifficulty
} from "../types";
import { LEETCODE_PLATFORM } from "./constants";
import type { LeetCodeQuestionDto } from "./types";

interface MapLeetCodeQuestionInput {
  question: LeetCodeQuestionDto;
  fallbackSlug: string;
  problemUrl: string;
}

export function mapLeetCodeQuestionToProblemData(
  input: MapLeetCodeQuestionInput
): ProblemData {
  return {
    platform: LEETCODE_PLATFORM,
    url: input.problemUrl,
    slug: input.question.titleSlug || input.fallbackSlug,
    title: input.question.title,
    content: input.question.content ?? "",
    difficulty: toProblemDifficulty(input.question.difficulty),
    codeSnippets: (input.question.codeSnippets ?? []).map((snippet) => ({
      language: snippet.lang,
      languageSlug: snippet.langSlug,
      code: snippet.code
    }))
  };
}

function toProblemDifficulty(rawDifficulty: string | undefined): ProblemDifficulty {
  if (rawDifficulty && isProblemDifficulty(rawDifficulty)) {
    return rawDifficulty;
  }

  return PROBLEM_DIFFICULTIES.UNKNOWN;
}

function isProblemDifficulty(value: string): value is ProblemDifficulty {
  return (
    value === PROBLEM_DIFFICULTIES.EASY ||
    value === PROBLEM_DIFFICULTIES.MEDIUM ||
    value === PROBLEM_DIFFICULTIES.HARD ||
    value === PROBLEM_DIFFICULTIES.UNKNOWN
  );
}
