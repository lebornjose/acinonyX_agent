import test from "node:test";
import assert from "node:assert/strict";
import { parseSuggestedQuestions } from "./suggestion.agent.js";

test("parseSuggestedQuestions filters duplicate and prohibited questions", () => {
  const content = JSON.stringify({
    suggestions: [
      "复星医药的研发投入趋势如何？",
      "复星医药的研发投入趋势如何？",
      "复星医药现在值得买入吗？",
      "复星医药有哪些主要经营风险？"
    ]
  });

  assert.deepEqual(parseSuggestedQuestions(content), [
    "复星医药的研发投入趋势如何？",
    "复星医药有哪些主要经营风险？"
  ]);
});
