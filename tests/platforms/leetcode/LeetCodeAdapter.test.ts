import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeetBridgeConfig } from "../../../src/config";
import {
  LEETCODE_ERRORS,
  LEETCODE_GRAPHQL_ENDPOINT,
  LEETCODE_HEADERS,
  LEETCODE_HEADER_VALUES
} from "../../../src/platforms/leetcode/constants";
import { LeetCodeAdapter } from "../../../src/platforms/leetcode/LeetCodeAdapter";
import type { PlatformLogger } from "../../../src/platforms/logger";
import { PROBLEM_DIFFICULTIES } from "../../../src/platforms/types";

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

describe("LeetCodeAdapter", () => {
  const adapter = new LeetCodeAdapter();
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and maps question payload data", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            question: {
              title: "Two Sum",
              titleSlug: "two-sum",
              content: "<p>Example content</p>",
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

  it("fails fast when auth tokens are missing", async () => {
    const logger = createLogger();

    await expect(
      adapter.fetchProblem({
        problemUrl: TEST_URL,
        config: createConfig({ leetcodeSessionToken: "", csrfToken: "" }),
        logger
      })
    ).rejects.toThrowError(LEETCODE_ERRORS.missingAuth);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Missing LeetCode authentication tokens in extension settings"
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
