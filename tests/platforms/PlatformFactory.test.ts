import { describe, expect, it, vi } from "vitest";
import type { IPlatformAdapter } from "../../src/platforms/IPlatformAdapter";
import type { PlatformLogger } from "../../src/platforms/logger";
import { PlatformFactory } from "../../src/platforms/PlatformFactory";
import { PLATFORMS } from "../../src/platforms/types";

function createLogger(): PlatformLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createAdapter(canHandle: boolean): IPlatformAdapter {
  return {
    platform: PLATFORMS.LEETCODE,
    canHandle: vi.fn(() => canHandle),
    fetchProblem: vi.fn(),
    submitCode: vi.fn()
  };
}

describe("PlatformFactory", () => {
  it("resolves the matching adapter for a supported URL", () => {
    const logger = createLogger();
    const adapter = createAdapter(true);
    const factory = new PlatformFactory({
      adapters: [adapter],
      logger
    });

    const resolved = factory.resolveAdapter("https://leetcode.com/problems/two-sum/");

    expect(resolved).toBe(adapter);
    expect(logger.info).toHaveBeenCalledWith(
      "Resolved leetcode adapter for host: leetcode.com"
    );
  });

  it("throws a clear error for invalid absolute URLs", () => {
    const logger = createLogger();
    const factory = new PlatformFactory({
      adapters: [createAdapter(true)],
      logger
    });

    expect(() => factory.resolveAdapter("not-a-url")).toThrowError(
      "Please provide a valid absolute problem URL."
    );
    expect(logger.warn).toHaveBeenCalledWith("Invalid absolute URL received: not-a-url");
  });

  it("throws when URL protocol is unsupported", () => {
    const logger = createLogger();
    const factory = new PlatformFactory({
      adapters: [createAdapter(true)],
      logger
    });

    expect(() =>
      factory.resolveAdapter("ftp://leetcode.com/problems/two-sum/")
    ).toThrowError("Problem URL must use HTTP or HTTPS.");

    expect(logger.warn).toHaveBeenCalledWith(
      "Unsupported URL protocol received: ftp:"
    );
  });

  it("throws when no adapter can handle the parsed URL", () => {
    const logger = createLogger();
    const factory = new PlatformFactory({
      adapters: [createAdapter(false)],
      logger
    });

    expect(() =>
      factory.resolveAdapter("https://leetcode.com/problems/two-sum/")
    ).toThrowError(
      "Unsupported platform for URL \"https://leetcode.com/problems/two-sum/\". Add an adapter for this host before fetching."
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "No adapter found for host: leetcode.com"
    );
  });
});
