import { LEETCODE_GRAPHQL_OPERATIONS } from "./constants";

export const LEETCODE_GRAPHQL_QUERIES = {
  [LEETCODE_GRAPHQL_OPERATIONS.questionData]: `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        titleSlug
        content
        difficulty
        codeSnippets {
          lang
          langSlug
          code
        }
      }
    }
  `
} as const;
