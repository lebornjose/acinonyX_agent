import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function runResearcher(model, task) {
  const response = await model.invoke([
    new SystemMessage("你是研究 Agent。提炼问题、列出关键事实与不确定点。不要编造来源；没有工具时明确说明限制。用中文输出，结构清晰。"),
    new HumanMessage(`请研究下面的任务，并给出可供写作 Agent 使用的研究简报：\n\n${task}`)
  ]);
  return response.content;
}

export async function runWriter(model, task, research) {
  const response = await model.invoke([
    new SystemMessage("你是写作 Agent。根据任务和研究简报，产出准确、简洁、可直接交付的中文答案。研究简报为空时直接回答任务；对不确定信息加以标注。"),
    new HumanMessage(`任务：\n${task}\n\n研究简报：\n${research || "（无额外研究，直接回答）"}\n\n请输出最终答案。`)
  ]);
  return response.content;
}
