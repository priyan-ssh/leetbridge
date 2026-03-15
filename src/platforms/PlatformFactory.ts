import type { IPlatformAdapter } from "./IPlatformAdapter";
import { noopPlatformLogger, type PlatformLogger } from "./logger";
import { LeetCodeAdapter } from "./leetcode/LeetCodeAdapter";
import { isSupportedProblemUrlProtocol } from "./urlValidation";

const DEFAULT_ADAPTERS: IPlatformAdapter[] = [new LeetCodeAdapter()];
const ERROR_MESSAGES = {
  invalidAbsoluteUrl: "Please provide a valid absolute problem URL.",
  unsupportedProtocol: "Problem URL must use HTTP or HTTPS.",
  unsupportedPlatform:
    "Unsupported platform for URL \"{{url}}\". Add an adapter for this host before fetching."
} as const;

interface PlatformFactoryOptions {
  adapters?: IPlatformAdapter[];
  logger?: PlatformLogger;
}

export class PlatformFactory {
  private readonly adapters: IPlatformAdapter[];
  private readonly logger: PlatformLogger;

  constructor(options: PlatformFactoryOptions = {}) {
    this.adapters = options.adapters ?? DEFAULT_ADAPTERS;
    this.logger = options.logger ?? noopPlatformLogger;
  }

  resolveAdapter(problemUrl: string): IPlatformAdapter {
    this.logger.debug(`Resolving adapter for URL: ${problemUrl}`);

    const parsedUrl = this.parseProblemUrl(problemUrl);
    const adapter = this.adapters.find((candidate) => candidate.canHandle(parsedUrl));

    if (!adapter) {
      this.logger.warn(`No adapter found for host: ${parsedUrl.hostname}`);

      throw new Error(
        ERROR_MESSAGES.unsupportedPlatform.replace("{{url}}", problemUrl)
      );
    }

    this.logger.info(
      `Resolved ${adapter.platform} adapter for host: ${parsedUrl.hostname}`
    );

    return adapter;
  }

  private parseProblemUrl(problemUrl: string): URL {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(problemUrl);
    } catch {
      this.logger.warn(`Invalid absolute URL received: ${problemUrl}`);
      throw new Error(ERROR_MESSAGES.invalidAbsoluteUrl);
    }

    if (!isSupportedProblemUrlProtocol(parsedUrl.protocol)) {
      this.logger.warn(`Unsupported URL protocol received: ${parsedUrl.protocol}`);
      throw new Error(ERROR_MESSAGES.unsupportedProtocol);
    }

    return parsedUrl;
  }
}
