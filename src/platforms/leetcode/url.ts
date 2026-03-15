import {
  LEETCODE_BASE_URL,
  LEETCODE_CHECK_PATH_SEGMENT,
  LEETCODE_ERRORS,
  LEETCODE_HOSTNAME_PATTERN,
  LEETCODE_PROBLEM_PATH_SEGMENT,
  LEETCODE_SUBMISSIONS_PATH_SEGMENT,
  LEETCODE_SUBMIT_PATH_SEGMENT
} from "./constants";
import { isSupportedProblemUrlProtocol } from "../urlValidation";

export function isLeetCodeHost(url: URL): boolean {
  return LEETCODE_HOSTNAME_PATTERN.test(url.hostname);
}

export function parseLeetCodeProblemUrl(problemUrl: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(problemUrl);
  } catch {
    throw new Error(LEETCODE_ERRORS.invalidUrl);
  }

  if (!isSupportedProblemUrlProtocol(parsedUrl.protocol)) {
    throw new Error(LEETCODE_ERRORS.invalidUrl);
  }

  if (!isLeetCodeHost(parsedUrl)) {
    throw new Error(LEETCODE_ERRORS.nonLeetCodeUrl);
  }

  return parsedUrl;
}

export function extractLeetCodeSlug(url: URL): string {
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const problemsIndex = pathSegments.findIndex(
    (segment) => segment === LEETCODE_PROBLEM_PATH_SEGMENT
  );

  if (problemsIndex === -1 || !pathSegments[problemsIndex + 1]) {
    throw new Error(LEETCODE_ERRORS.invalidSlug);
  }

  return pathSegments[problemsIndex + 1];
}

export function buildLeetCodeSubmitUrl(slug: string): string {
  const normalizedSlug = slug.trim();
  return `${LEETCODE_BASE_URL}/${LEETCODE_PROBLEM_PATH_SEGMENT}/${normalizedSlug}/${LEETCODE_SUBMIT_PATH_SEGMENT}/`;
}

export function buildLeetCodeCheckSubmissionUrl(submissionId: string): string {
  return `${LEETCODE_BASE_URL}/${LEETCODE_SUBMISSIONS_PATH_SEGMENT}/detail/${submissionId}/${LEETCODE_CHECK_PATH_SEGMENT}/`;
}
