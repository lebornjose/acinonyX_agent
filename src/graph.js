import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { runResearcher, runWriter } from "./agents.js";

const State = Annotation.Root({
  task: Annotation(),
  needsResearch: Annotation({ default: () => false }),
  research: Annotation({ reducer: (_, next) => next, default: () => "" }),
  answer: Annotation({ reducer: (_, next) => next, default: () => "" })
});

function needsResearch(task) {
  const text = String(task || "").trim();
  if (text.length > 180) return true;
  return /(研究|分析|比较|对比|总结|风险|财报|估值|数据|原因|方案|步骤|最新|历史|多角度)/u.test(text);
}

export function createAgentGraph(model) {
  return new StateGraph(State)
    .addNode("prepare", (state) => ({ needsResearch: needsResearch(state.task) }))
    .addNode("researcher", async (state) => ({ research: await runResearcher(model, state.task) }))
    .addNode("writer", async (state) => ({ answer: await runWriter(model, state.task, state.research) }))
    .addEdge(START, "prepare")
    .addConditionalEdges("prepare", (state) => state.needsResearch ? "researcher" : "writer", { researcher: "researcher", writer: "writer" })
    .addEdge("researcher", "writer")
    .addEdge("writer", END)
    .compile();
}
