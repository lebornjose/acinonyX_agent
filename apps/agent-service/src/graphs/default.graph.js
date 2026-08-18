import {
  Annotation,
  END,
  START,
  StateGraph
} from "@langchain/langgraph";

const AgentState = Annotation.Root({
  task: Annotation(),
  needsResearch: Annotation({
    default: () => false
  }),
  needsStockAnalysis: Annotation({
    default: () => false
  }),
  research: Annotation({
    reducer: (_, next) => next,
    default: () => ""
  }),
  stockAnalysis: Annotation({
    reducer: (_, next) => next,
    default: () => null
  }),
  answer: Annotation({
    reducer: (_, next) => next,
    default: () => ""
  })
});

const researchKeywords = /研究|分析|比较|对比|总结|风险|财报|估值|数据|原因|方案|步骤|最新|历史|多角度/u;

function needsResearch(task) {
  const text = String(task || "").trim();

  return text.length > 180 || researchKeywords.test(text);
}

async function prepareNode(state, stockTool) {
  return {
    needsResearch: needsResearch(state.task),
    needsStockAnalysis: stockTool.isStockAnalysisTask(state.task)
  };
}

async function stockAnalysisNode(state, stockTool) {
  return {
    stockAnalysis: await stockTool.invoke({ task: state.task })
  };
}

async function researcherNode(state, researcher) {
  return {
    research: await researcher.invoke({
      task: state.task
    })
  };
}

async function writerNode(state, writer) {
  return {
    answer: await writer.invoke({
      task: state.task,
      research: state.research,
      stockAnalysis: state.stockAnalysis
    })
  };
}

function routeAfterPrepare(state) {
  if (state.needsStockAnalysis) {
    return "stockData";
  }

  return state.needsResearch ? "researcher" : "writer";
}

export function createDefaultGraph({ researcher, writer, stockTool }) {
  return new StateGraph(AgentState)
    .addNode("prepare", (state) => prepareNode(state, stockTool))
    .addNode("stockData", (state) => stockAnalysisNode(state, stockTool))
    .addNode("researcher", (state) => researcherNode(state, researcher))
    .addNode("writer", (state) => writerNode(state, writer))
    .addEdge(START, "prepare")
    .addConditionalEdges("prepare", routeAfterPrepare, {
      stockData: "stockData",
      researcher: "researcher",
      writer: "writer"
    })
    .addEdge("stockData", "writer")
    .addEdge("researcher", "writer")
    .addEdge("writer", END)
    .compile();
}
