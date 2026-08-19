/**
 * @file researcher.agent.js
 * @description 研究 Agent。
 *
 * 职责：接收用户问题，提炼关键事实、列出不确定点，
 * 输出一份"研究简报"供写作 Agent 使用。
 *
 * 特点：
 *   - 不调用任何外部工具，只做纯文本推理
 *   - 没有工具时会明确说明限制，不编造来源
 *   - 可通过注入 domainSkill 文本增强领域知识（如粉煤灰领域）
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * 创建研究 Agent 实例。
 *
 * @param {import("@langchain/openai").ChatOpenAI} model - LangChain 模型实例
 * @param {string} [domainSkill=""] - 领域知识文本（来自 skills/fly-ash-domain/SKILL.md），
 *                                    追加到系统提示末尾，可为空字符串
 * @returns {{ name: string, invoke: Function }} 研究 Agent 对象
 */
export function createResearcherAgent(model, domainSkill = "") {
  return {
    name: "researcher",

    /**
     * 执行研究任务，返回供写作 Agent 使用的研究简报文本。
     *
     * @param {object} params      - 调用参数
     * @param {string} params.task - 用户问题或需要研究的任务描述
     * @returns {Promise<string>}  研究简报（中文，结构化文本）
     */
    async invoke({ task }) {
      const messages = [
        // 系统提示：设定研究 Agent 的角色和行为规范
        new SystemMessage(
          `你是研究 Agent。提炼问题、列出关键事实与不确定点。` +
          `不要编造来源；没有工具时明确说明限制。用中文输出，结构清晰。` +
          `\n\n${domainSkill}`
        ),
        // 用户消息：传入具体任务，要求输出可供写作 Agent 使用的研究简报
        new HumanMessage(
          `请研究下面的任务，并给出可供写作 Agent 使用的研究简报：\n\n${task}`
        )
      ];

      const response = await model.invoke(messages);

      // response.content 是模型返回的文本内容
      return response.content;
    }
  };
}
