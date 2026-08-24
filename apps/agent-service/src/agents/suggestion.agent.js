/**
 * @file suggestion.agent.js
 * @description 根据本轮问答生成可点击的后续问题。
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const MAX_SUGGESTIONS = 3;
const MAX_QUESTION_LENGTH = 64;
const PROHIBITED_PATTERN = /买入|卖出|建仓|清仓|目标价|荐股|保证收益/u;

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

function isValidQuestion(question) {
  return question.length >= 8
    && question.length <= MAX_QUESTION_LENGTH
    && !PROHIBITED_PATTERN.test(question)
    && /[？?]$/u.test(question);
}

export function parseSuggestedQuestions(content) {
  try {
    const payload = JSON.parse(jsonText(content));
    const questions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    const uniqueQuestions = new Set();

    for (const item of questions) {
      const question = String(item || "").trim();
      if (isValidQuestion(question)) {
        uniqueQuestions.add(question);
      }
    }

    return [...uniqueQuestions].slice(0, MAX_SUGGESTIONS);
  } catch {
    return [];
  }
}

export function createSuggestionAgent(model) {
  return {
    name: "suggestion",

    async invoke({ task, answer }) {
      const messages = [
        new SystemMessage(
          "你是股票知识问答的后续问题推荐器。只返回 JSON，不要使用 Markdown 或解释。" +
          "输出格式必须是 {\"suggestions\":[\"问题一？\",\"问题二？\",\"问题三？\"]}。" +
          "问题应与本轮问答强相关且不重复已回答内容，覆盖不同角度，例如基本面、估值、风险、行业或数据核验。" +
          "每条是可直接发送的完整中文问题，长度 8 至 64 个字符。" +
          "不得生成买入、卖出、目标价、荐股、保证收益等交易指令，也不得编造事实。"
        ),
        new HumanMessage(`用户问题：\n${task}\n\n本轮回答：\n${answer}`)
      ];
      const response = await model.invoke(messages);

      return parseSuggestedQuestions(response.content);
    }
  };
}
