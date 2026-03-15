import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeetBridgeConfig } from "../../../src/config";
import {
  LEETCODE_ERRORS,
  LEETCODE_GRAPHQL_ENDPOINT,
  LEETCODE_HEADERS,
  LEETCODE_HEADER_VALUES,
  LEETCODE_SUBMISSION_POLL_POLICY
} from "../../../src/platforms/leetcode/constants";
import { LeetCodeAdapter } from "../../../src/platforms/leetcode/LeetCodeAdapter";
import { buildLeetCodeCheckSubmissionUrl, buildLeetCodeSubmitUrl } from "../../../src/platforms/leetcode/url";
import type { PlatformLogger } from "../../../src/platforms/logger";
import { PROBLEM_DIFFICULTIES, SUBMISSION_VERDICTS } from "../../../src/platforms/types";

const TEST_URL = "https://leetcode.com/problems/two-sum/";

function createLogger(): PlatformLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createConfig(overrides: Partial<LeetBridgeConfig> = {}): LeetBridgeConfig {
  return {
    leetcodeSessionToken: "session-token",
    csrfToken: "csrf-token",
    defaultLanguage: "python",
    ...overrides
  };
}

function mockImmediateSleep(): void {
  vi.spyOn(globalThis, "setTimeout").mockImplementation(
    ((callback: (...args: unknown[]) => void) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout
  );
}

describe("LeetCodeAdapter", () => {
  const adapter = new LeetCodeAdapter();
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches and maps question payload data", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
              question: {
                questionId: "1",
                title: "Two Sum",
                titleSlug: "two-sum",
                content:
                  '<p><img src="images/example.png"><a href="//cdn.example.com/help">Help</a></p>',
                difficulty: PROBLEM_DIFFICULTIES.EASY,
                codeSnippets: [
                {
                  lang: "Python",
                  langSlug: "python3",
                  code: "class Solution:\n    pass"
                }
              ]
            }
          }
        }),
        {
          status: 200,
          headers: {
            [LEETCODE_HEADERS.contentType]: LEETCODE_HEADER_VALUES.jsonContentType
          }
        }
      )
    );

    const logger = createLogger();
    const problem = await adapter.fetchProblem({
      problemUrl: TEST_URL,
      config: createConfig(),
      logger
    });

    expect(problem.title).toBe("Two Sum");
    expect(problem.slug).toBe("two-sum");
    expect(problem.problemId).toBe("1");
    expect(problem.content).toBe(
      '<p><img src="https://leetcode.com/problems/two-sum/images/example.png"><a href="https://cdn.example.com/help">Help</a></p>'
    );
    expect(problem.codeSnippets).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      LEETCODE_GRAPHQL_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          [LEETCODE_HEADERS.csrfToken]: "csrf-token"
        })
      })
    );
    expect(logger.info).toHaveBeenCalledWith("Fetched LeetCode problem: two-sum");
  });

  it("submits code, polls, and maps terminal metrics", async () => {
    mockImmediateSleep();

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              question: {
                questionId: "1",
                title: "Two Sum",
                titleSlug: "two-sum",
                content: "",
                difficulty: PROBLEM_DIFFICULTIES.EASY,
                codeSnippets: []
              }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            submission_id: 12345
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: "PENDING",
            status_msg: "Pending"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: "SUCCESS",
            status_msg: "Accepted",
            runtime: "48 ms",
            memory: "17.1 MB",
            runtime_percentile: 88.12,
            memory_percentile: "76.5",
            total_correct: 63,
            total_testcases: 63
          }),
          { status: 200 }
        )
      );

    const result = await adapter.submitCode({
      problemUrl: TEST_URL,
      slug: "two-sum",
      language: "python",
      code: "class Solution:\n    pass",
      config: createConfig(),
      logger: createLogger()
    });

    expect(result.verdict).toBe(SUBMISSION_VERDICTS.accepted);
    expect(result.message).toBe("Accepted");
    expect(result.submissionId).toBe("12345");
    expect(result.metrics.runtime).toBe("48 ms");
    expect(result.metrics.memory).toBe("17.1 MB");
    expect(result.metrics.runtimePercentile).toBe(88.12);
    expect(result.metrics.memoryPercentile).toBe(76.5);
    expect(result.passedTestCount).toBe(63);
    expect(result.totalTestCount).toBe(63);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      LEETCODE_GRAPHQL_ENDPOINT,
      expect.objectContaining({ method: "POST" })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      buildLeetCodeSubmitUrl("two-sum"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          lang: "python3",
          question_id: "1",
          typed_code: "class Solution:\n    pass"
        })
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      buildLeetCodeCheckSubmissionUrl("12345"),
      expect.anything()
    );
  });

  it("fails fast when auth tokens are missing", async () => {
    const logger = createLogger();

    await expect(
      adapter.submitCode({
        problemUrl: TEST_URL,
        slug: "two-sum",
        language: "python",
        code: "print('hi')",
        config: createConfig({ leetcodeSessionToken: "", csrfToken: "" }),
        logger
      })
    ).rejects.toThrowError(LEETCODE_ERRORS.missingAuth);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Missing LeetCode authentication tokens in extension settings"
    );
  });

  it("fails fast when auth tokens are whitespace-only", async () => {
    const logger = createLogger();

    await expect(
      adapter.fetchProblem({
        problemUrl: TEST_URL,
        config: createConfig({
          leetcodeSessionToken: "   \n\t  ",
          csrfToken: "   "
        }),
        logger
      })
    ).rejects.toThrowError(LEETCODE_ERRORS.missingAuth);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Missing LeetCode authentication tokens in extension settings"
    );
  });

  it("trims auth tokens before adding request headers", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            question: {
              questionId: "1",
              title: "Two Sum",
              titleSlug: "two-sum",
              content: "<p>Example content</p>",
              difficulty: PROBLEM_DIFFICULTIES.EASY,
              codeSnippets: []
            }
          }
        }),
        { status: 200 }
      )
    );

    await adapter.fetchProblem({
      problemUrl: TEST_URL,
      config: createConfig({
        leetcodeSessionToken: "  session-token  ",
        csrfToken: "\tcsrf-token\n"
      }),
      logger: createLogger()
    });

    expect(fetchMock).toHaveBeenCalledWith(
      LEETCODE_GRAPHQL_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({
          [LEETCODE_HEADERS.csrfToken]: "csrf-token",
          [LEETCODE_HEADERS.cookie]: "LEETCODE_SESSION=session-token; csrftoken=csrf-token"
        })
      })
    );
  });

  it("throws when submit payload has no submission id", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: null
        }),
        { status: 200 }
      )
    );

    await expect(
      adapter.submitCode({
        problemUrl: TEST_URL,
        slug: "two-sum",
        problemId: "1",
        language: "python",
        code: "print('hi')",
        config: createConfig(),
        logger: createLogger()
      })
    ).rejects.toThrowError(LEETCODE_ERRORS.missingSubmissionId);
  });

  it("preserves typed_code whitespace in submit payload", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            submission_id: 22222
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: "SUCCESS",
            status_msg: "Accepted"
          }),
          { status: 200 }
        )
      );

    const rawCode = "  class Solution:\n    pass\n\n";

    await adapter.submitCode({
      problemUrl: TEST_URL,
      slug: "two-sum",
      problemId: "1",
      language: "python",
      code: rawCode,
      config: createConfig(),
      logger: createLogger()
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      buildLeetCodeSubmitUrl("two-sum"),
      expect.objectContaining({
        body: JSON.stringify({
          lang: "python3",
          question_id: "1",
          typed_code: rawCode
        })
      })
    );
  });

  it("maps non-accepted submission verdicts", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            submission_id: 67890
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: "SUCCESS",
            status_msg: "Wrong Answer",
            total_correct: 45,
            total_testcases: 63
          }),
          { status: 200 }
        )
      );

    const result = await adapter.submitCode({
      problemUrl: TEST_URL,
      slug: "two-sum",
      problemId: "1",
      language: "python",
      code: "print('hi')",
      config: createConfig(),
      logger: createLogger()
    });

    expect(result.verdict).toBe(SUBMISSION_VERDICTS.wrongAnswer);
    expect(result.message).toBe("Wrong Answer");
    expect(result.passedTestCount).toBe(45);
    expect(result.totalTestCount).toBe(63);
  });

  it("throws when polling never reaches a terminal submission state", async () => {
    mockImmediateSleep();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(LEETCODE_SUBMISSION_POLL_POLICY.timeoutMs + 1);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            submission_id: 11111
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: "PENDING",
            status_msg: "Pending"
          }),
          { status: 200 }
        )
      );

    await expect(
      adapter.submitCode({
        problemUrl: TEST_URL,
        slug: "two-sum",
        problemId: "1",
        language: "python",
        code: "print('hi')",
        config: createConfig(),
        logger: createLogger()
      })
    ).rejects.toThrowError(
      LEETCODE_ERRORS.pollingTimedOut
        .replace("{{submissionId}}", "11111")
        .replace("{{timeoutMs}}", String(LEETCODE_SUBMISSION_POLL_POLICY.timeoutMs))
    );
  });

  it("throws authentication error on 401/403 responses", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    const logger = createLogger();

    await expect(
      adapter.fetchProblem({
        problemUrl: TEST_URL,
        config: createConfig(),
        logger
      })
    ).rejects.toThrowError(LEETCODE_ERRORS.authenticationFailed);

    expect(logger.warn).toHaveBeenCalledWith(
      "LeetCode request failed due to authentication status"
    );
  });

  it("throws API error when GraphQL payload contains errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ message: "graphql exploded" }]
        }),
        { status: 200 }
      )
    );

    await expect(
      adapter.fetchProblem({
        problemUrl: TEST_URL,
        config: createConfig(),
        logger: createLogger()
      })
    ).rejects.toThrowError("LeetCode API error: graphql exploded");
  });

  it("throws when question payload is empty", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            question: null
          }
        }),
        { status: 200 }
      )
    );

    await expect(
      adapter.fetchProblem({
        problemUrl: TEST_URL,
        config: createConfig(),
        logger: createLogger()
      })
    ).rejects.toThrowError(
      LEETCODE_ERRORS.questionNotFound.replace("{{slug}}", "two-sum")
    );
  });
});
