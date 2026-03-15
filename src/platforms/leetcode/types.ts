import { LEETCODE_GRAPHQL_OPERATIONS } from "./constants";

export interface LeetCodeCodeSnippetDto {
  lang: string;
  langSlug: string;
  code: string;
}

export interface LeetCodeQuestionDto {
  questionId?: string;
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

export interface LeetCodeSubmitCodeRequestBody {
  lang: string;
  question_id: string;
  typed_code: string;
}

export interface LeetCodeSubmitCodeResponse {
  submission_id?: number | string;
}

export interface LeetCodeCheckSubmissionResponse {
  state?: string;
  status_msg?: string;
  status_code?: number;
  runtime?: string;
  memory?: string;
  runtime_percentile?: number | string;
  memory_percentile?: number | string;
  total_correct?: number;
  total_testcases?: number;
}
