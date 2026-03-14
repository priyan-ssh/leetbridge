import type { IPlatformAdapter } from "./IPlatformAdapter";
import { LeetCodeAdapter } from "./leetcode/LeetCodeAdapter";

const DEFAULT_ADAPTERS: IPlatformAdapter[] = [new LeetCodeAdapter()];

export class PlatformFactory {
  constructor(private readonly adapters: IPlatformAdapter[] = DEFAULT_ADAPTERS) {}

  resolveAdapter(problemUrl: string): IPlatformAdapter {
    const parsedUrl = this.parseProblemUrl(problemUrl);
    const adapter = this.adapters.find((candidate) => candidate.canHandle(parsedUrl));

    if (!adapter) {
      throw new Error(
        `Unsupported platform for URL "${problemUrl}". Add an adapter for this host before fetching.`
      );
    }

    return adapter;
  }

  private parseProblemUrl(problemUrl: string): URL {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(problemUrl);
    } catch {
      throw new Error("Please provide a valid absolute problem URL.");
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Problem URL must use HTTP or HTTPS.");
    }

    return parsedUrl;
  }
}
