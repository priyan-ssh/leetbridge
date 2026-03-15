export const SUPPORTED_PROBLEM_URL_PROTOCOLS = new Set(["https:", "http:"]);

export function isSupportedProblemUrlProtocol(protocol: string): boolean {
  return SUPPORTED_PROBLEM_URL_PROTOCOLS.has(protocol);
}
