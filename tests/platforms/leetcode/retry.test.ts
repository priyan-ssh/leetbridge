import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEETCODE_ERRORS,
  LEETCODE_RETRY_POLICY
} from "../../../src/platforms/leetcode/constants";
import { fetchWithRetry } from "../../../src/platforms/leetcode/retry";
import type { PlatformLogger } from "../../../src/platforms/logger";

function createLogger(): PlatformLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
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

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries retryable statuses and eventually returns success", async () => {
    mockImmediateSleep();

    const requestFactory = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const logger = createLogger();
    const response = await fetchWithRetry(requestFactory, {
      logger,
      requestName: "questionData:two-sum"
    });

    expect(response.status).toBe(200);
    expect(requestFactory).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "questionData:two-sum returned retryable status 500; scheduling retry"
    );
  });

  it("throws after max retries when request keeps failing", async () => {
    mockImmediateSleep();

    const requestFactory = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValue(new Error("network down"));

    const logger = createLogger();

    await expect(
      fetchWithRetry(requestFactory, {
        logger,
        requestName: "questionData:two-sum"
      })
    ).rejects.toThrowError(
      LEETCODE_ERRORS.fetchFailedAfterRetries.replace("{{message}}", "network down")
    );

    expect(requestFactory).toHaveBeenCalledTimes(LEETCODE_RETRY_POLICY.maxRetries + 1);
    expect(logger.error).toHaveBeenCalledWith(
      "questionData:two-sum failed after retries: network down"
    );
  });
});
