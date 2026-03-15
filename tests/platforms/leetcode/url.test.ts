import { describe, expect, it } from "vitest";
import { LEETCODE_ERRORS } from "../../../src/platforms/leetcode/constants";
import { parseLeetCodeProblemUrl } from "../../../src/platforms/leetcode/url";

describe("parseLeetCodeProblemUrl", () => {
  it("rejects non-http and non-https protocols", () => {
    for (const problemUrl of [
      "ftp://leetcode.com/problems/two-sum/",
      "file:///tmp/two-sum",
      "javascript:alert(1)"
    ]) {
      expect(() => parseLeetCodeProblemUrl(problemUrl)).toThrowError(
        LEETCODE_ERRORS.invalidUrl
      );
    }
  });
});
