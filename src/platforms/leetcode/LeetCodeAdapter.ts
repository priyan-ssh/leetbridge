import type { LeetBridgeConfig } from "../../config";
import type {
  FetchProblemInput,
  IPlatformAdapter,
  SubmitCodeInput
} from "../IPlatformAdapter";
import { noopPlatformLogger, type PlatformLogger } from "../logger";
import {
  SUBMISSION_VERDICTS,
  type ProblemData,
  type SubmissionMetrics,
  type SubmissionResult,
  type SubmissionVerdict
} from "../types";
import {
  LEETCODE_BASE_URL,
  LEETCODE_ERRORS,
  LEETCODE_AUTH_FAILURE_STATUS_CODES,
  LEETCODE_COOKIE_KEYS,
  LEETCODE_GRAPHQL_ENDPOINT,
  LEETCODE_GRAPHQL_OPERATIONS,
  LEETCODE_HEADERS,
  LEETCODE_HEADER_VALUES,
  LEETCODE_PLATFORM,
  LEETCODE_SUBMISSION_POLL_POLICY,
  HTTP_METHODS,
  HTTP_STATUS_CODES
} from "./constants";
import { mapLeetCodeQuestionToProblemData } from "./mapper";
import { LEETCODE_GRAPHQL_QUERIES } from "./queries";
import { fetchWithRetry } from "./retry";
import type {
  LeetCodeCheckSubmissionResponse,
  LeetCodeQuestionDataRequestBody,
  LeetCodeQuestionDataResponse,
  LeetCodeQuestionDto,
  LeetCodeSubmitCodeRequestBody,
  LeetCodeSubmitCodeResponse
} from "./types";
import {
  buildLeetCodeCheckSubmissionUrl,
  buildLeetCodeSubmitUrl,
  extractLeetCodeSlug,
  isLeetCodeHost,
  parseLeetCodeProblemUrl
} from "./url";

interface AuthenticatedRequestInput {
  config: LeetBridgeConfig;
}

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

    const question = await this.fetchQuestionBySlug({
      slug,
      input,
      refererUrl: parsedUrl,
      logger
    });

    const problem = mapLeetCodeQuestionToProblemData({
      question,
      fallbackSlug: slug,
      problemUrl: parsedUrl.toString()
    });

    logger.info(`Fetched LeetCode problem: ${problem.slug}`);

    return problem;
  }

  async submitCode(input: SubmitCodeInput): Promise<SubmissionResult> {
    const logger = input.logger ?? noopPlatformLogger;
    const parsedUrl = parseLeetCodeProblemUrl(input.problemUrl);
    const slug = input.slug.trim() || extractLeetCodeSlug(parsedUrl);

    logger.info(`Submitting LeetCode solution for slug: ${slug}`);

    this.assertAuthTokens(input, logger);

    const questionId = await this.resolveQuestionId({
      slug,
      input,
      refererUrl: parsedUrl,
      logger
    });
    const submitUrl = buildLeetCodeSubmitUrl(slug);

    const submitResponse = await fetchWithRetry(
      () =>
        fetch(submitUrl, {
          method: HTTP_METHODS.post,
          headers: this.buildHeaders(input, parsedUrl),
          body: JSON.stringify(this.createSubmitCodeRequestBody(input, questionId))
        }),
      {
        logger,
        requestName: `submit:${slug}`
      }
    );

    this.assertSuccessfulResponse(submitResponse, logger);

    const submitPayload =
      (await submitResponse.json()) as LeetCodeSubmitCodeResponse;
    const submissionId = this.extractSubmissionId(submitPayload, logger);

    logger.info(`Created LeetCode submission ${submissionId} for slug: ${slug}`);

    const checkPayload = await this.pollSubmissionUntilTerminal({
      submissionId,
      input,
      refererUrl: parsedUrl,
      logger
    });

    const submissionResult = this.mapSubmissionResult({
      submissionId,
      checkPayload,
      checkedAt: new Date().toISOString()
    });

    logger.info(
      `LeetCode submission ${submissionId} finished with verdict: ${submissionResult.verdict}`
    );

    return submissionResult;
  }

  private async fetchQuestionBySlug(input: {
    slug: string;
    input: AuthenticatedRequestInput;
    refererUrl: URL;
    logger: PlatformLogger;
  }): Promise<LeetCodeQuestionDto> {
    const response = await fetchWithRetry(
      () =>
        fetch(LEETCODE_GRAPHQL_ENDPOINT, {
          method: HTTP_METHODS.post,
          headers: this.buildHeaders(input.input, input.refererUrl),
          body: JSON.stringify(this.createQuestionDataRequestBody(input.slug))
        }),
      {
        logger: input.logger,
        requestName: `questionData:${input.slug}`
      }
    );

    input.logger.debug(`Received LeetCode response status: ${response.status}`);

    this.assertSuccessfulResponse(response, input.logger);

    const payload = (await response.json()) as LeetCodeQuestionDataResponse;
    this.assertNoGraphQlErrors(payload, input.logger);

    const question = payload.data?.question;

    if (!question) {
      input.logger.warn(`LeetCode question not found for slug: ${input.slug}`);
      throw new Error(LEETCODE_ERRORS.questionNotFound.replace("{{slug}}", input.slug));
    }

    return question;
  }

  private async resolveQuestionId(input: {
    slug: string;
    input: SubmitCodeInput;
    refererUrl: URL;
    logger: PlatformLogger;
  }): Promise<string> {
    const candidateQuestionId = input.input.problemId?.trim();

    if (candidateQuestionId) {
      return candidateQuestionId;
    }

    input.logger.debug(
      `Question ID missing for ${input.slug}; resolving via question metadata`
    );

    const question = await this.fetchQuestionBySlug({
      slug: input.slug,
      input: input.input,
      refererUrl: input.refererUrl,
      logger: input.logger
    });

    const questionId = question.questionId?.trim();

    if (!questionId) {
      throw new Error(LEETCODE_ERRORS.questionIdNotFound.replace("{{slug}}", input.slug));
    }

    return questionId;
  }

  private extractSubmissionId(
    payload: LeetCodeSubmitCodeResponse,
    logger: PlatformLogger
  ): string {
    if (payload.submission_id === undefined || payload.submission_id === null) {
      logger.error("LeetCode submit payload did not include submission_id");
      throw new Error(LEETCODE_ERRORS.missingSubmissionId);
    }

    const submissionId = String(payload.submission_id).trim();

    if (!submissionId) {
      logger.error("LeetCode submit payload included an empty submission_id");
      throw new Error(LEETCODE_ERRORS.missingSubmissionId);
    }

    return submissionId;
  }

  private async pollSubmissionUntilTerminal(input: {
    submissionId: string;
    input: SubmitCodeInput;
    refererUrl: URL;
    logger: PlatformLogger;
  }): Promise<LeetCodeCheckSubmissionResponse> {
    const startedAt = Date.now();
    const checkUrl = buildLeetCodeCheckSubmissionUrl(input.submissionId);

    while (Date.now() - startedAt < LEETCODE_SUBMISSION_POLL_POLICY.timeoutMs) {
      const checkResponse = await fetchWithRetry(
        () =>
          fetch(checkUrl, {
            headers: this.buildHeaders(input.input, input.refererUrl)
          }),
        {
          logger: input.logger,
          requestName: `checkSubmission:${input.submissionId}`
        }
      );

      this.assertSuccessfulResponse(checkResponse, input.logger);

      const checkPayload =
        (await checkResponse.json()) as LeetCodeCheckSubmissionResponse;

      if (this.isTerminalSubmissionState(checkPayload)) {
        return checkPayload;
      }

      input.logger.debug(
        `Submission ${input.submissionId} still running (state=${checkPayload.state ?? "unknown"}, status=${checkPayload.status_msg ?? "unknown"})`
      );

      await sleep(LEETCODE_SUBMISSION_POLL_POLICY.intervalMs);
    }

    throw new Error(
      LEETCODE_ERRORS.pollingTimedOut
        .replace("{{submissionId}}", input.submissionId)
        .replace(
          "{{timeoutMs}}",
          String(LEETCODE_SUBMISSION_POLL_POLICY.timeoutMs)
        )
    );
  }

  private isTerminalSubmissionState(payload: LeetCodeCheckSubmissionResponse): boolean {
    if (payload.status_msg && this.toSubmissionVerdict(payload.status_msg)) {
      return true;
    }

    const normalizedState = payload.state?.trim().toUpperCase();
    return normalizedState === "SUCCESS";
  }

  private mapSubmissionResult(input: {
    submissionId: string;
    checkPayload: LeetCodeCheckSubmissionResponse;
    checkedAt: string;
  }): SubmissionResult {
    const message = input.checkPayload.status_msg?.trim() || SUBMISSION_VERDICTS.unknown;
    const metrics: SubmissionMetrics = {
      runtime: input.checkPayload.runtime,
      memory: input.checkPayload.memory,
      runtimePercentile: toOptionalNumber(input.checkPayload.runtime_percentile),
      memoryPercentile: toOptionalNumber(input.checkPayload.memory_percentile)
    };

    return {
      verdict: this.toSubmissionVerdict(message) ?? SUBMISSION_VERDICTS.unknown,
      message,
      submissionId: input.submissionId,
      checkedAt: input.checkedAt,
      metrics,
      passedTestCount: input.checkPayload.total_correct,
      totalTestCount: input.checkPayload.total_testcases
    };
  }

  private toSubmissionVerdict(statusMessage: string): SubmissionVerdict | undefined {
    const normalizedMessage = statusMessage.trim().toLowerCase();

    if (!normalizedMessage) {
      return undefined;
    }

    if (normalizedMessage === "accepted") {
      return SUBMISSION_VERDICTS.accepted;
    }

    if (normalizedMessage === "wrong answer") {
      return SUBMISSION_VERDICTS.wrongAnswer;
    }

    if (normalizedMessage === "time limit exceeded") {
      return SUBMISSION_VERDICTS.timeLimitExceeded;
    }

    if (normalizedMessage === "memory limit exceeded") {
      return SUBMISSION_VERDICTS.memoryLimitExceeded;
    }

    if (normalizedMessage === "runtime error") {
      return SUBMISSION_VERDICTS.runtimeError;
    }

    if (normalizedMessage === "compile error") {
      return SUBMISSION_VERDICTS.compileError;
    }

    if (normalizedMessage === "output limit exceeded") {
      return SUBMISSION_VERDICTS.outputLimitExceeded;
    }

    return undefined;
  }

  private assertAuthTokens(
    input: AuthenticatedRequestInput,
    logger: PlatformLogger
  ): void {
    const authTokens = this.getAuthTokens(input.config);

    if (!authTokens) {
      logger.warn("Missing LeetCode authentication tokens in extension settings");
      throw new Error(LEETCODE_ERRORS.missingAuth);
    }
  }

  private buildHeaders(
    input: AuthenticatedRequestInput,
    refererUrl: URL
  ): Record<string, string> {
    const authTokens = this.getAuthTokens(input.config);

    if (!authTokens) {
      throw new Error(LEETCODE_ERRORS.missingAuth);
    }

    return {
      [LEETCODE_HEADERS.contentType]: LEETCODE_HEADER_VALUES.jsonContentType,
      [LEETCODE_HEADERS.origin]: LEETCODE_BASE_URL,
      [LEETCODE_HEADERS.referer]: refererUrl.toString(),
      [LEETCODE_HEADERS.csrfToken]: authTokens.csrfToken,
      [LEETCODE_HEADERS.cookie]: this.buildCookieHeaderValue(authTokens)
    };
  }

  private buildCookieHeaderValue(authTokens: {
    leetcodeSessionToken: string;
    csrfToken: string;
  }): string {
    return `${LEETCODE_COOKIE_KEYS.session}=${authTokens.leetcodeSessionToken}; ${LEETCODE_COOKIE_KEYS.csrf}=${authTokens.csrfToken}`;
  }

  private getAuthTokens(config: LeetBridgeConfig):
    | { leetcodeSessionToken: string; csrfToken: string }
    | undefined {
    const leetcodeSessionToken = config.leetcodeSessionToken.trim();
    const csrfToken = config.csrfToken.trim();

    if (!leetcodeSessionToken || !csrfToken) {
      return undefined;
    }

    return {
      leetcodeSessionToken,
      csrfToken
    };
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

  private createSubmitCodeRequestBody(
    input: SubmitCodeInput,
    questionId: string
  ): LeetCodeSubmitCodeRequestBody {
    return {
      lang: toLeetCodeLanguageSlug(input.language),
      question_id: questionId,
      typed_code: input.code
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

function toLeetCodeLanguageSlug(language: string): string {
  const normalized = language.trim().toLowerCase();

  if (normalized === "python") {
    return "python3";
  }

  if (normalized === "javascript") {
    return "javascript";
  }

  if (normalized === "java") {
    return "java";
  }

  if (normalized === "cpp") {
    return "cpp";
  }

  return normalized;
}

function toOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
