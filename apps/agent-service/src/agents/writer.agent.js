/**
 * @file writer.agent.js
 * @description 写作 Agent。
 *
 * 职责：综合用户任务、研究简报和股票行情数据，产出准确、清晰、
 * 可直接交付给用户的中文回答。
 *
 * 涉及具体股票时，必须按以下结构回答：
 *   1. 当前价格与市盈率
 *   2. 近 3 个月走势和盈利率区间
 *   3. 当前价格在近 6 个月区间的位置及 PE 区域
 *   4. 近 1 个月波动数据和有证据支持的原因
 *   5. 综合估值判断
 *
 * 规范：
 *   - 数据缺失时明确写"暂无数据"，不得猜测或编造（尤其是 PE）
 *   - 行情数据必须标注数据日期和来源
 *   - 不承诺收益，不替用户做无依据的买卖决定
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * 创建写作 Agent 实例。
 *
 * @param {import("@langchain/openai").ChatOpenAI} model      - LangChain 模型实例
 * @param {string} [domainSkill=""]   - 领域知识文本（来自 skills/fly-ash-domain/SKILL.md）
 * @param {string} [qualitySkill=""]  - 回答质量规范文本（来自 skills/answer-quality/SKILL.md）
 * @returns {{ name: string, invoke: Function }} 写作 Agent 对象
 */
export function createWriterAgent(model, domainSkill = "", qualitySkill = "") {
  return {
    name: "writer",

    /**
     * 根据任务、研究简报和股票行情数据生成最终回答。
     *
     * @param {object}      params               - 调用参数
     * @param {string}      params.task          - 用户的原始问题
     * @param {string}      [params.research=""] - 研究 Agent 产出的研究简报；
     *                                             为空时直接回答任务
     * @param {object|null} [params.stockAnalysis=null] - stock_analysis 工具返回的
     *                                                    结构化行情数据；无行情需求时为 null
     * @returns {Promise<string>} 最终中文回答文本
     */
    async invoke({ task, research = "", stockAnalysis = null }) {
      // 研究简报为空时使用占位符，告知模型直接回答
      const researchBrief = research || "（无额外研究，直接回答）";

      // 有股票行情数据时，将 JSON 序列化后附加到提示中
      // 明确告知模型：这是程序计算的数据，必须优先依据，不得补造缺失字段
      const stockBrief = stockAnalysis
        ? `\n\n股票行情数据（由程序获取和计算，优先依据这些数据，不得补造缺失字段）：\n${JSON.stringify(stockAnalysis, null, 2)}`
        : "";

      const messages = [
        // 系统提示：设定写作 Agent 的角色、回答结构和数据使用规范
        new SystemMessage(
          `你是一个专注于股票知识解答的中文智能助手。` +
          `根据任务、研究简报和行情数据，产出准确、清晰、易懂、可直接交付的中文答案。` +
          `涉及具体股票时，必须按以下结构回答：` +
          `1. 当前价格与市盈率；` +
          `2. 近 3 个月走势和盈利率区间；` +
          `3. 当前价格在近 6 个月区间的位置及 PE 区域；` +
          `4. 近 1 个月波动数据和有证据支持的原因；` +
          `5. 综合估值判断。` +
          `数据缺失时明确写"暂无数据"，不得猜测或编造，尤其不得编造 PE。` +
          `行情数据必须标注数据日期和来源；仅凭价格数据不能确定波动原因。` +
          `不要承诺收益，也不要替用户做无依据的买卖决定。` +
          `研究简报为空时直接回答任务；对不确定信息加以标注。` +
          `\n\n${domainSkill}\n\n${qualitySkill}`
        ),
        // 用户消息：将任务、研究简报、行情数据一起传入，请求输出最终答案
        new HumanMessage(
          `任务：\n${task}\n\n研究简报：\n${researchBrief}${stockBrief}\n\n请输出最终答案。`
        )
      ];

      const response = await model.invoke(messages);

      // response.content 是模型返回的文本内容
      return response.content;
    }
  };
}
