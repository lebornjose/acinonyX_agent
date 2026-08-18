import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export function createWriterAgent(model, domainSkill = "", qualitySkill = "") {
  return {
    name: "writer",

    async invoke({ task, research = "" }) {
      const researchBrief = research || "（无额外研究，直接回答）";
      const messages = [
        new SystemMessage(`你是加灰狗，专注于粉煤灰行业的智能助手。根据任务和研究简报，产出准确、简洁、可直接交付的中文答案。研究简报为空时直接回答任务；对不确定信息加以标注。\n\n${domainSkill}\n\n${qualitySkill}`),
        new HumanMessage(
          `任务：\n${task}\n\n研究简报：\n${researchBrief}\n\n请输出最终答案。`
        )
      ];

      const response = await model.invoke(messages);
      return response.content;
    }
  };
}
