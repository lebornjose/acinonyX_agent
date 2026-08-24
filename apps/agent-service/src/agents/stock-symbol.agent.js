/**
 * @file stock-symbol.agent.js
 * @description 从自然语言股票问题中提取当前 A 股数据源可查询的唯一标的。
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const MAX_SYMBOL_QUERY_LENGTH = 64;
const SYMBOL_QUERY_PATTERN = /^[\u4e00-\u9fffA-Za-z0-9.]{2,64}$/u;

function responseText(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => part?.text || "").join("");
  }

  return "";
}

function jsonText(content) {
  return responseText(content)
    .trim()
    .replace(/^```json\s*/iu, "")
    .replace(/^```\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

/**
 * 解析标的提取 Agent 的 JSON 输出。
 *
 * @param {string|Array<object>} content - 模型原始响应内容
 * @returns {string|null} 经格式校验的标的名称或代码；无法确认时为 null
 */
export function parseStockSymbolQuery(content) {
  try {
    const payload = JSON.parse(jsonText(content));
    const symbolQuery = String(payload.symbolQuery || "").trim();

    if (!symbolQuery || symbolQuery.length > MAX_SYMBOL_QUERY_LENGTH) {
      return null;
    }

    return SYMBOL_QUERY_PATTERN.test(symbolQuery) ? symbolQuery : null;
  } catch {
    return null;
  }
}

/**
 * 创建 A 股标的解析 Agent。
 *
 * 该 Agent 只做语义抽取，不决定交易结论，也不直接调用外部数据；
 * 解析结果仍必须由同花顺客户端进行确定性检索与消歧。
 *
 * @param {import("@langchain/openai").ChatOpenAI} model - LangChain 模型实例
 * @returns {{ name: string, invoke: Function }} 标的解析 Agent
 */
export function createStockSymbolAgent(model) {
  return {
    name: "stock_symbol",

    async invoke({ task }) {
      const messages = [
        new SystemMessage(
          "你是 A 股标的解析器。只返回 JSON，不要使用 Markdown 或解释。" +
          "输出格式必须是 {\"symbolQuery\":\"股票名称或代码\"}，无法确认时输出 {\"symbolQuery\":null}。" +
          "只提取用户当前问题中唯一、明确的 A 股标的；中文名称须保留股票全称，例如复星医药。" +
          "用户提供 6 位 A 股代码或 SH/SZ/BJ 前缀代码时，返回该代码。" +
          "港股、美股、基金、指数、多个候选标的、仅有概念问题或不确定标的均返回 null。" +
          "不得猜测、补全或编造股票名称和代码。"
        ),
        new HumanMessage(`用户问题：\n${task}`)
      ];
      const response = await model.invoke(messages);

      return parseStockSymbolQuery(response.content);
    }
  };
}
