import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export function createResearcherAgent(model, domainSkill = "") {
  return {
    name: "researcher",

    async invoke({ task }) {
      const messages = [
        new SystemMessage(`你是研究 Agent。提炼问题、列出关键事实与不确定点。不要编造来源；没有工具时明确说明限制。用中文输出，结构清晰。\n\n${domainSkill}`),
        new HumanMessage(
          `请研究下面的任务，并给出可供写作 Agent 使用的研究简报：\n\n${task}`
        )
      ];

      const response = await model.invoke(messages);
      return response.content;
    }
  };
}
