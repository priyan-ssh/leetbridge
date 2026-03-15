import type { FetchProblemInput, IPlatformAdapter } from "../IPlatformAdapter";
import { noopPlatformLogger, type PlatformLogger } from "../logger";
import type { ProblemData } from "../types";
import {
  LEETCODE_BASE_URL,
  HTTP_METHODS,
  HTTP_STATUS_CODES,
  LEETCODE_AUTH_FAILURE_STATUS_CODES,
  LEETCODE_COOKIE_KEYS,
  LEETCODE_ERRORS,
  LEETCODE_GRAPHQL_ENDPOINT,
  LEETCODE_GRAPHQL_OPERATIONS,
  LEETCODE_HEADERS,
  LEETCODE_HEADER_VALUES,
  LEETCODE_PLATFORM
} from "./constants";
import { mapLeetCodeQuestionToProblemData } from "./mapper";
import { LEETCODE_GRAPHQL_QUERIES } from "./queries";
import { fetchWithRetry } from "./retry";
import type {
  LeetCodeQuestionDataRequestBody,
  LeetCodeQuestionDataResponse
} from "./types";
import { extractLeetCodeSlug, isLeetCodeHost, parseLeetCodeProblemUrl } from "./url";

export class LeetCodeAdapter implements IPlatformAdapter {
  readonly platform = LEETCODE_PLATFORM;

  canHandle(url: URL): boolean {
    return isLeetCodeHost(url);
  }

  async fetchProblem(input: FetchProblemInput): Promise<ProblemData> {
    const logger = input.logger ?? noopPlatformLogger;

    logger.info(`Fetching LeetCode problem for URL: ${input.problemUrl}`);

    const parsedUrl = parseLeetCodeProblemUrl(input.problemUrl);
    const slug = extractLeetCodeSlug(parsedUrl);

    logger.debug(`Parsed LeetCode slug: ${slug}`);

    this.assertAuthTokens(input, logger);

    const response = await fetchWithRetry(
      () =>
        fetch(LEETCODE_GRAPHQL_ENDPOINT, {
          method: HTTP_METHODS.post,
          headers: this.buildHeaders(input, parsedUrl),
          body: JSON.stringify(this.createQuestionDataRequestBody(slug))
        }),
      {
        logger,
        requestName: `questionData:${slug}`
      }
    );

    logger.debug(`Received LeetCode response status: ${response.status}`);

    this.assertSuccessfulResponse(response, logger);

    const payload = (await response.json()) as LeetCodeQuestionDataResponse;
    this.assertNoGraphQlErrors(payload, logger);

    const question = payload.data?.question;

    if (!question) {
      logger.warn(`LeetCode question not found for slug: ${slug}`);
      throw new Error(LEETCODE_ERRORS.questionNotFound.replace("{{slug}}", slug));
    }

    const problem = mapLeetCodeQuestionToProblemData({
      question,
      fallbackSlug: slug,
      problemUrl: parsedUrl.toString()
    });

    logger.info(`Fetched LeetCode problem: ${problem.slug}`);

    return problem;
  }

  private assertAuthTokens(input: FetchProblemInput, logger: PlatformLogger): void {
    if (!input.config.leetcodeSessionToken || !input.config.csrfToken) {
      logger.warn("Missing LeetCode authentication tokens in extension settings");
      throw new Error(LEETCODE_ERRORS.missingAuth);
    }
  }

  private buildHeaders(
    input: FetchProblemInput,
    parsedUrl: URL
  ): Record<string, string> {
    return {
      [LEETCODE_HEADERS.contentType]: LEETCODE_HEADER_VALUES.jsonContentType,
      [LEETCODE_HEADERS.origin]: LEETCODE_BASE_URL,
      [LEETCODE_HEADERS.referer]: parsedUrl.toString(),
      [LEETCODE_HEADERS.csrfToken]: input.config.csrfToken,
      [LEETCODE_HEADERS.cookie]: this.buildCookieHeaderValue(input)
    };
  }

  private buildCookieHeaderValue(input: FetchProblemInput): string {
    return `${LEETCODE_COOKIE_KEYS.session}=${input.config.leetcodeSessionToken}; ${LEETCODE_COOKIE_KEYS.csrf}=${input.config.csrfToken}`;
  }

  private createQuestionDataRequestBody(
    slug: string
  ): LeetCodeQuestionDataRequestBody {
    return {
      operationName: LEETCODE_GRAPHQL_OPERATIONS.questionData,
      variables: {
        titleSlug: slug
      },
      query: LEETCODE_GRAPHQL_QUERIES[LEETCODE_GRAPHQL_OPERATIONS.questionData]
    };
  }

  private assertSuccessfulResponse(
    response: Response,
    logger: PlatformLogger
  ): void {
    if (response.ok) {
      return;
    }

    if (response.status === HTTP_STATUS_CODES.tooManyRequests) {
      logger.warn("LeetCode request hit a rate-limit response");
      throw new Error(LEETCODE_ERRORS.rateLimited);
    }

    if (LEETCODE_AUTH_FAILURE_STATUS_CODES.has(response.status)) {
      logger.warn("LeetCode request failed due to authentication status");
      throw new Error(LEETCODE_ERRORS.authenticationFailed);
    }

    logger.error(`LeetCode request failed with status ${response.status}`);

    throw new Error(
      LEETCODE_ERRORS.requestFailed.replace("{{status}}", String(response.status))
    );
  }

  private assertNoGraphQlErrors(
    payload: LeetCodeQuestionDataResponse,
    logger: PlatformLogger
  ): void {
    if (!payload.errors || payload.errors.length === 0) {
      return;
    }

    logger.warn(`LeetCode GraphQL returned an error: ${payload.errors[0].message}`);

    throw new Error(
      LEETCODE_ERRORS.apiError.replace("{{message}}", payload.errors[0].message)
    );
  }
}
