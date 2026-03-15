import { describe, expect, it } from "vitest";
import { PROBLEM_DIFFICULTIES } from "../../../src/platforms/types";
import { mapLeetCodeQuestionToProblemData } from "../../../src/platforms/leetcode/mapper";
import type { LeetCodeQuestionDto } from "../../../src/platforms/leetcode/types";

const TEST_PROBLEM_URL = "https://leetcode.com/problems/two-sum/";

function createQuestion(content: string): LeetCodeQuestionDto {
  return {
    questionId: "1",
    title: "Two Sum",
    titleSlug: "two-sum",
    content,
    difficulty: PROBLEM_DIFFICULTIES.EASY,
    codeSnippets: []
  };
}

describe("mapLeetCodeQuestionToProblemData", () => {
  it("normalizes relative and protocol-relative URL attributes", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<img src="images/chart.png"><a href="/assets/readme.pdf">doc</a><script src="//cdn.example.com/app.js"></script>'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe(
      '<img src="https://leetcode.com/problems/two-sum/images/chart.png"><a href="https://leetcode.com/assets/readme.pdf">doc</a><script src="https://cdn.example.com/app.js"></script>'
    );
  });

  it("keeps absolute http(s), mailto/tel schemes, and fragments unchanged", () => {
    const originalContent =
      '<a href="https://example.com/path">absolute</a><a href="mailto:test@example.com">mail</a><a href="tel:+1234567890">phone</a><a href="#constraints">fragment</a>';

    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(originalContent),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe(originalContent);
  });

  it("sanitizes dangerous script-like schemes to an inert URL", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<a href="javascript:void(0)">js</a><a href="vbscript:msgbox(1)">vbs</a>'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe('<a href="#">js</a><a href="#">vbs</a>');
  });

  it("sanitizes non-allowlisted explicit schemes such as data to an inert URL", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<img src="data:image/png;base64,abc123"><a href="ftp://example.com">ftp</a>'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe('<img src="#"><a href="#">ftp</a>');
  });

  it("normalizes unquoted URL-bearing attributes and preserves safe unquoted values", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        "<img src=images/chart.png><a href=/assets/readme.pdf>doc</a><form action=submit>ok</form><a href=#keep>fragment</a>"
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe(
      "<img src=https://leetcode.com/problems/two-sum/images/chart.png><a href=https://leetcode.com/assets/readme.pdf>doc</a><form action=https://leetcode.com/problems/two-sum/submit>ok</form><a href=#keep>fragment</a>"
    );
  });

  it("sanitizes mixed-case dangerous explicit schemes in quoted and unquoted attributes", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<a href="JaVaScRiPt:alert(1)">quoted</a><img src=VBScript:msgbox(1)><a href=DaTa:text/html,boom>data</a>'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe('<a href="#">quoted</a><img src=#><a href=#>data</a>');
  });

  it("sanitizes obfuscated javascript schemes with whitespace or control chars", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<a href="java\tscript:alert(1)">tab</a><a href="\u0001javascript:alert(2)">control</a>'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe('<a href="#">tab</a><a href="#">control</a>');
  });

  it("sanitizes html-entity obfuscated javascript schemes", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<a href="jav&#x61;script:alert(1)">hex</a><a href="jav&#97;script:alert(2)">decimal</a><a href="java&#x09;script:alert(3)">tab</a>'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe('<a href="#">hex</a><a href="#">decimal</a><a href="#">tab</a>');
  });

  it("normalizes and sanitizes each srcset candidate while preserving descriptors", () => {
    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(
        '<img srcset="images/a.png 1x, /assets/b.png 2x, javascript:alert(1) 3x, java\tscript:alert(2) 640w, https://cdn.example.com/c.png 4x">'
      ),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe(
      '<img srcset="https://leetcode.com/problems/two-sum/images/a.png 1x, https://leetcode.com/assets/b.png 2x, # 3x, # 640w, https://cdn.example.com/c.png 4x">'
    );
  });

  it("sanitizes malformed URLs to an inert URL", () => {
    const malformedContent = '<a href="http://[::1">broken</a>';

    const problem = mapLeetCodeQuestionToProblemData({
      question: createQuestion(malformedContent),
      fallbackSlug: "fallback",
      problemUrl: TEST_PROBLEM_URL
    });

    expect(problem.content).toBe('<a href="#">broken</a>');
  });
});
