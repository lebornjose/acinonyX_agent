import test from "node:test";
import assert from "node:assert/strict";
import { parseStockSymbolQuery } from "./stock-symbol.agent.js";

test("解析中文 A 股名称", () => {
  assert.equal(
    parseStockSymbolQuery('{"symbolQuery":"复星医药"}'),
    "复星医药"
  );
});

test("解析明确返回的 A 股代码", () => {
  assert.equal(
    parseStockSymbolQuery('```json\n{"symbolQuery":"600196"}\n```'),
    "600196"
  );
});

test("无法确认标的时返回 null", () => {
  assert.equal(parseStockSymbolQuery('{"symbolQuery":null}'), null);
  assert.equal(parseStockSymbolQuery("不是 JSON"), null);
});
