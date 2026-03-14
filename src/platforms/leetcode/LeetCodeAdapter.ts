import type { FetchProblemInput, IPlatformAdapter } from "../IPlatformAdapter";
import type { ProblemData, ProblemDifficulty } from "../types";

const LEETCODE_GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1_000;

const LEETCODE_QUESTION_QUERY = `
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
`;

interface LeetCodeGraphQlQuestion {
  title: string;
  titleSlug: string;
  content: string;
  difficulty: string;
  codeSnippets?: Array<{
    lang: string;
    langSlug: string;
    code: string;
  }> | null;
}

interface LeetCodeGraphQlResponse {
  data?: {
    question?: LeetCodeGraphQlQuestion | null;
  };
  errors?: Array<{
    message: string;
  }>;
}

export class LeetCodeAdapter implements IPlatformAdapter {
  readonly platform = "leetcode" as const;

  canHandle(url: URL): boolean {
    return /(^|\.)leetcode\.com$/i.test(url.hostname);
  }

  async fetchProblem(input: FetchProblemInput): Promise<ProblemData> {
    const parsedUrl = this.parseProblemUrl(input.problemUrl);
    const slug = this.extractSlug(parsedUrl);

    this.assertAuthTokens(input);

    const response = await this.fetchWithBackoff(() =>
      fetch(LEETCODE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: this.buildHeaders(input, parsedUrl),
        body: JSON.stringify({
          operationName: "questionData",
          variables: {
            titleSlug: slug
          },
          query: LEETCODE_QUESTION_QUERY
        })
      })
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("LeetCode is rate-limiting us. Give it 10 seconds and retry.");
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "LeetCode authentication failed. Refresh your cookie values in LeetBridge settings."
        );
      }

      throw new Error(`LeetCode request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as LeetCodeGraphQlResponse;

    if (payload.errors && payload.errors.length > 0) {
      throw new Error(`LeetCode API error: ${payload.errors[0].message}`);
    }

    const question = payload.data?.question;

    if (!question) {
      throw new Error(`Could not find a LeetCode problem for slug "${slug}".`);
    }

    return {
      platform: this.platform,
      url: parsedUrl.toString(),
      slug: question.titleSlug || slug,
      title: question.title,
      content: question.content ?? "",
      difficulty: toProblemDifficulty(question.difficulty),
      codeSnippets: (question.codeSnippets ?? []).map((snippet) => ({
        language: snippet.lang,
        languageSlug: snippet.langSlug,
        code: snippet.code
      }))
    };
  }

  private parseProblemUrl(problemUrl: string): URL {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(problemUrl);
    } catch {
      throw new Error("Please provide a valid LeetCode problem URL.");
    }

    if (!this.canHandle(parsedUrl)) {
      throw new Error("LeetCode adapter received a non-LeetCode URL.");
    }

    return parsedUrl;
  }

  private extractSlug(url: URL): string {
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const problemsIndex = pathSegments.findIndex((segment) => segment === "problems");

    if (problemsIndex === -1 || !pathSegments[problemsIndex + 1]) {
      throw new Error(
        "Could not parse problem slug from URL. Expected format: https://leetcode.com/problems/<slug>/"
      );
    }

    return pathSegments[problemsIndex + 1];
  }

  private assertAuthTokens(input: FetchProblemInput): void {
    if (!input.config.leetcodeSessionToken || !input.config.csrfToken) {
      throw new Error(
        "LeetCode authentication is incomplete. Run 'LeetBridge: Setup Authentication' first."
      );
    }
  }

  private buildHeaders(input: FetchProblemInput, parsedUrl: URL): Record<string, string> {
    return {
      "content-type": "application/json",
      origin: "https://leetcode.com",
      referer: parsedUrl.toString(),
      "x-csrftoken": input.config.csrfToken,
      cookie: `LEETCODE_SESSION=${input.config.leetcodeSessionToken}; csrftoken=${input.config.csrfToken}`
    };
  }

  private async fetchWithBackoff(requestFactory: () => Promise<Response>): Promise<Response> {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const response = await requestFactory();

        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === MAX_RETRIES) {
          return response;
        }
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`Failed to reach LeetCode after retries: ${toErrorMessage(error)}`);
        }
      }

      await sleep(getRetryDelay(attempt));
      attempt += 1;
    }

    throw new Error("Unexpected retry loop termination while contacting LeetCode.");
  }
}

function toProblemDifficulty(rawDifficulty: string | undefined): ProblemDifficulty {
  if (rawDifficulty === "Easy" || rawDifficulty === "Medium" || rawDifficulty === "Hard") {
    return rawDifficulty;
  }

  return "Unknown";
}

function getRetryDelay(attempt: number): number {
  const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 300);
  return exponentialDelay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
