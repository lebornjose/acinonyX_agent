import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export function createWriterAgent(model, domainSkill = "", qualitySkill = "") {
  return {
    name: "writer",

    async invoke({ task, research = "", stockAnalysis = null }) {
      const researchBrief = research || "（无额外研究，直接回答）";
      const stockBrief = stockAnalysis
        ? `\n\n股票行情数据（由程序获取和计算，优先依据这些数据，不得补造缺失字段）：\n${JSON.stringify(stockAnalysis, null, 2)}`
        : "";
      const messages = [
        new SystemMessage(`你是一个专注于股票知识解答的中文智能助手。根据任务、研究简报和行情数据，产出准确、清晰、易懂、可直接交付的中文答案。涉及具体股票时，必须按以下结构回答：1. 当前价格与市盈率；2. 近 3 个月走势和盈利率区间；3. 当前价格在近 6 个月区间的位置及 PE 区域；4. 近 1 个月波动数据和有证据支持的原因；5. 综合估值判断。数据缺失时明确写“暂无数据”，不得猜测或编造，尤其不得编造 PE。行情数据必须标注数据日期和来源；仅凭价格数据不能确定波动原因。不要承诺收益，也不要替用户做无依据的买卖决定。研究简报为空时直接回答任务；对不确定信息加以标注。\n\n${domainSkill}\n\n${qualitySkill}`),
        new HumanMessage(
          `任务：\n${task}\n\n研究简报：\n${researchBrief}${stockBrief}\n\n请输出最终答案。`
        )
      ];

      const response = await model.invoke(messages);
      return response.content;
    }
  };
}
