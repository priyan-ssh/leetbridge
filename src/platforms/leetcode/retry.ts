import {
  LEETCODE_ERRORS,
  LEETCODE_RETRY_POLICY,
  LEETCODE_RETRYABLE_STATUS_CODES
} from "./constants";
import { noopPlatformLogger, type PlatformLogger } from "../logger";

interface FetchWithRetryOptions {
  logger?: PlatformLogger;
  requestName?: string;
}

export async function fetchWithRetry(
  requestFactory: () => Promise<Response>,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const logger = options.logger ?? noopPlatformLogger;
  const requestName = options.requestName ?? "LeetCode request";

  let attempt = 0;

  while (attempt <= LEETCODE_RETRY_POLICY.maxRetries) {
    const attemptNumber = attempt + 1;

    logger.debug(
      `Attempt ${attemptNumber} of ${LEETCODE_RETRY_POLICY.maxRetries + 1} for ${requestName}`
    );

    try {
      const response = await requestFactory();

      if (
        !LEETCODE_RETRYABLE_STATUS_CODES.has(response.status) ||
        attempt === LEETCODE_RETRY_POLICY.maxRetries
      ) {
        if (LEETCODE_RETRYABLE_STATUS_CODES.has(response.status)) {
          logger.warn(
            `${requestName} returned retryable status ${response.status} on final attempt`
          );
        }

        return response;
      }

      logger.warn(
        `${requestName} returned retryable status ${response.status}; scheduling retry`
      );
    } catch (error) {
      if (attempt === LEETCODE_RETRY_POLICY.maxRetries) {
        logger.error(
          `${requestName} failed after retries: ${toErrorMessage(error)}`
        );

        throw new Error(
          LEETCODE_ERRORS.fetchFailedAfterRetries.replace(
            "{{message}}",
            toErrorMessage(error)
          )
        );
      }

      logger.warn(
        `${requestName} failed on attempt ${attemptNumber}; scheduling retry: ${toErrorMessage(error)}`
      );
    }

    const retryDelay = getRetryDelay(attempt);
    logger.debug(`Waiting ${retryDelay}ms before retrying ${requestName}`);

    await sleep(retryDelay);
    attempt += 1;
  }

  throw new Error(LEETCODE_ERRORS.retryLoopTerminated);
}

function getRetryDelay(attempt: number): number {
  const exponentialDelay =
    LEETCODE_RETRY_POLICY.baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(
    Math.random() * LEETCODE_RETRY_POLICY.maxJitterMs
  );
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
