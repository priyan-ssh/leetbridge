import {
  PROBLEM_DIFFICULTIES,
  type ProblemData,
  type ProblemDifficulty
} from "../types";
import { LEETCODE_PLATFORM } from "./constants";
import type { LeetCodeQuestionDto } from "./types";

interface MapLeetCodeQuestionInput {
  question: LeetCodeQuestionDto;
  fallbackSlug: string;
  problemUrl: string;
}

const URL_BEARING_ATTRIBUTES = [
  "action",
  "cite",
  "data",
  "formaction",
  "href",
  "poster",
  "src",
  "srcset"
] as const;

const URL_ATTRIBUTE_PATTERN = new RegExp(
  `\\b(${URL_BEARING_ATTRIBUTES.join("|")})(\\s*=\\s*)(?:"([^"]*)"|'([^']*)'|([^\\s"'\`=<>]+))`,
  "gi"
);

const ALLOWED_PASSTHROUGH_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

export function mapLeetCodeQuestionToProblemData(
  input: MapLeetCodeQuestionInput
): ProblemData {
  const normalizedContent = normalizeQuestionContentUrls(
    input.question.content,
    input.problemUrl
  );

  return {
    platform: LEETCODE_PLATFORM,
    url: input.problemUrl,
    slug: input.question.titleSlug || input.fallbackSlug,
    problemId: input.question.questionId,
    title: input.question.title,
    content: normalizedContent,
    difficulty: toProblemDifficulty(input.question.difficulty),
    codeSnippets: (input.question.codeSnippets ?? []).map((snippet) => ({
      language: snippet.lang,
      languageSlug: snippet.langSlug,
      code: snippet.code
    }))
  };
}

function normalizeQuestionContentUrls(content: string, problemUrl: string): string {
  if (!content) {
    return "";
  }

  let problemBaseUrl: URL;

  try {
    problemBaseUrl = new URL(problemUrl);
  } catch {
    return content;
  }

  return content.replace(
    URL_ATTRIBUTE_PATTERN,
    (
      fullMatch,
      attributeName: string,
      equalsSegment: string,
      doubleQuotedValue: string | undefined,
      singleQuotedValue: string | undefined,
      unquotedValue: string | undefined
    ) => {
      const quote =
        doubleQuotedValue !== undefined ? '"' : singleQuotedValue !== undefined ? "'" : "";
      const rawValue = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? "";
      const normalizedValue =
        attributeName.toLowerCase() === "srcset"
          ? normalizeSrcsetAttributeValue(rawValue, problemBaseUrl)
          : normalizeHtmlUrlAttributeValue(rawValue, problemBaseUrl);

      if (normalizedValue === rawValue) {
        return fullMatch;
      }

      if (!quote) {
        if (requiresQuotedHtmlAttributeValue(normalizedValue)) {
          return `${attributeName}${equalsSegment}"${normalizedValue}"`;
        }

        return `${attributeName}${equalsSegment}${normalizedValue}`;
      }

      return `${attributeName}${equalsSegment}${quote}${normalizedValue}${quote}`;
    }
  );
}

function normalizeHtmlUrlAttributeValue(value: string, baseUrl: URL): string {
  if (!value || value.startsWith("#")) {
    return value;
  }

  const obfuscatedExplicitScheme = getExplicitSchemeFromObfuscatedValue(value);

  if (
    obfuscatedExplicitScheme &&
    !ALLOWED_PASSTHROUGH_SCHEMES.has(obfuscatedExplicitScheme)
  ) {
    return "#";
  }

  const leadingTrimmedValue = value.replace(/^[\u0000-\u0020]+/, "");
  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:/i.test(leadingTrimmedValue);

  try {
    const parsedUrl = new URL(value, baseUrl);
    const scheme = parsedUrl.protocol.slice(0, -1).toLowerCase();

    if (!ALLOWED_PASSTHROUGH_SCHEMES.has(scheme)) {
      return "#";
    }

    if (hasExplicitScheme) {
      return value;
    }

    return parsedUrl.toString();
  } catch {
    return "#";
  }
}

function getExplicitSchemeFromObfuscatedValue(value: string): string | null {
  const decodedValue = decodeRelevantHtmlEntities(value);
  const normalizedValue = decodedValue
    .replace(/^[\u0000-\u0020]+/, "")
    .replace(/[\u0000-\u0020]+/g, "");
  const explicitSchemeMatch = normalizedValue.match(/^([a-z][a-z\d+.-]*):/i);

  return explicitSchemeMatch?.[1]?.toLowerCase() ?? null;
}

function decodeRelevantHtmlEntities(value: string): string {
  return value.replace(/&(?:#(x[\da-f]+|\d+)|tab|newline);?/gi, (entity) => {
    const normalizedEntity = entity.toLowerCase();

    if (normalizedEntity.startsWith("&#")) {
      const isHex = normalizedEntity[2] === "x";
      const numericSlice = normalizedEntity.slice(isHex ? 3 : 2).replace(/;$/, "");
      const numericCodePoint = Number.parseInt(numericSlice, isHex ? 16 : 10);

      if (
        !Number.isFinite(numericCodePoint) ||
        numericCodePoint < 0 ||
        numericCodePoint > 0x10ffff
      ) {
        return entity;
      }

      return String.fromCodePoint(numericCodePoint);
    }

    if (normalizedEntity.startsWith("&tab")) {
      return "\t";
    }

    return "\n";
  });
}

function normalizeSrcsetAttributeValue(value: string, baseUrl: URL): string {
  if (!value) {
    return value;
  }

  const normalizedCandidates = value
    .split(",")
    .map((candidate) => normalizeSrcsetCandidate(candidate, baseUrl));

  return normalizedCandidates.join(", ");
}

function normalizeSrcsetCandidate(candidate: string, baseUrl: URL): string {
  const trimmedCandidate = candidate.trim();

  if (!trimmedCandidate) {
    return "";
  }

  const candidateTokens = trimmedCandidate.split(/\s+/);
  const trailingToken = candidateTokens[candidateTokens.length - 1] ?? "";
  const descriptor = isSrcsetDescriptor(trailingToken) ? trailingToken : "";
  const rawUrl = descriptor
    ? trimmedCandidate.slice(0, trimmedCandidate.length - descriptor.length).trimEnd()
    : trimmedCandidate;
  const normalizedUrl = normalizeHtmlUrlAttributeValue(rawUrl, baseUrl);

  if (!descriptor) {
    return normalizedUrl;
  }

  return `${normalizedUrl} ${descriptor}`;
}

function isSrcsetDescriptor(token: string): boolean {
  return /^\d+(?:\.\d+)?x$/i.test(token) || /^\d+[wh]$/i.test(token);
}

function requiresQuotedHtmlAttributeValue(value: string): boolean {
  return /[\s"'`=<>]/.test(value);
}

function toProblemDifficulty(rawDifficulty: string | undefined): ProblemDifficulty {
  if (rawDifficulty && isProblemDifficulty(rawDifficulty)) {
    return rawDifficulty;
  }

  return PROBLEM_DIFFICULTIES.UNKNOWN;
}

function isProblemDifficulty(value: string): value is ProblemDifficulty {
  return (
    value === PROBLEM_DIFFICULTIES.EASY ||
    value === PROBLEM_DIFFICULTIES.MEDIUM ||
    value === PROBLEM_DIFFICULTIES.HARD ||
    value === PROBLEM_DIFFICULTIES.UNKNOWN
  );
}
