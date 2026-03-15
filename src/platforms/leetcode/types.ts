import { LEETCODE_GRAPHQL_OPERATIONS } from "./constants";

export interface LeetCodeCodeSnippetDto {
  lang: string;
  langSlug: string;
  code: string;
}

export interface LeetCodeQuestionDto {
  title: string;
  titleSlug: string;
  content: string;
  difficulty: string;
  codeSnippets?: LeetCodeCodeSnippetDto[] | null;
}

export interface LeetCodeQuestionDataResult {
  question?: LeetCodeQuestionDto | null;
}

export interface LeetCodeGraphQlError {
  message: string;
}

export interface LeetCodeGraphQlResponse<TData> {
  data?: TData;
  errors?: LeetCodeGraphQlError[];
}

export type LeetCodeQuestionDataResponse = LeetCodeGraphQlResponse<LeetCodeQuestionDataResult>;

export interface LeetCodeQuestionDataVariables {
  titleSlug: string;
}

export interface LeetCodeQuestionDataRequestBody {
  operationName: (typeof LEETCODE_GRAPHQL_OPERATIONS)["questionData"];
  variables: LeetCodeQuestionDataVariables;
  query: string;
}
