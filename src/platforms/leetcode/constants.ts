import { PLATFORMS } from "../types";

export const LEETCODE_PLATFORM = PLATFORMS.LEETCODE;
export const LEETCODE_BASE_URL = "https://leetcode.com";
export const LEETCODE_GRAPHQL_ENDPOINT = `${LEETCODE_BASE_URL}/graphql`;
export const LEETCODE_HOSTNAME_PATTERN = /(^|\.)leetcode\.com$/i;
export const LEETCODE_PROBLEM_PATH_SEGMENT = "problems";

export const HTTP_METHODS = {
  post: "POST"
} as const;

export const HTTP_STATUS_CODES = {
  unauthorized: 401,
  forbidden: 403,
  tooManyRequests: 429,
  internalServerError: 500,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504
} as const;

export const LEETCODE_RETRYABLE_STATUS_CODES = new Set<number>([
  HTTP_STATUS_CODES.tooManyRequests,
  HTTP_STATUS_CODES.internalServerError,
  HTTP_STATUS_CODES.badGateway,
  HTTP_STATUS_CODES.serviceUnavailable,
  HTTP_STATUS_CODES.gatewayTimeout
]);

export const LEETCODE_AUTH_FAILURE_STATUS_CODES = new Set<number>([
  HTTP_STATUS_CODES.unauthorized,
  HTTP_STATUS_CODES.forbidden
]);

export const LEETCODE_RATE_LIMIT_WAIT_SECONDS = 10;

export const LEETCODE_RETRY_POLICY = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxJitterMs: 300
} as const;

export const LEETCODE_HEADERS = {
  contentType: "content-type",
  origin: "origin",
  referer: "referer",
  csrfToken: "x-csrftoken",
  cookie: "cookie"
} as const;

export const LEETCODE_HEADER_VALUES = {
  jsonContentType: "application/json"
} as const;

export const LEETCODE_COOKIE_KEYS = {
  session: "LEETCODE_SESSION",
  csrf: "csrftoken"
} as const;

export const LEETCODE_GRAPHQL_OPERATIONS = {
  questionData: "questionData"
} as const;

export const LEETCODE_ERRORS = {
  invalidUrl: "Please provide a valid LeetCode problem URL.",
  nonLeetCodeUrl: "LeetCode adapter received a non-LeetCode URL.",
  invalidSlug:
    "Could not parse problem slug from URL. Expected format: https://leetcode.com/problems/<slug>/",
  missingAuth:
    "LeetCode authentication is incomplete. Run 'LeetBridge: Setup Authentication' first.",
  authenticationFailed:
    "LeetCode authentication failed. Refresh your cookie values in LeetBridge settings.",
  rateLimited: `LeetCode is rate-limiting us. Give it ${LEETCODE_RATE_LIMIT_WAIT_SECONDS} seconds and retry.`,
  retryLoopTerminated: "Unexpected retry loop termination while contacting LeetCode.",
  requestFailed: "LeetCode request failed with status {{status}}.",
  apiError: "LeetCode API error: {{message}}",
  questionNotFound: "Could not find a LeetCode problem for slug \"{{slug}}\".",
  fetchFailedAfterRetries: "Failed to reach LeetCode after retries: {{message}}"
} as const;
