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
  research: Annotation({
    reducer: (_, next) => next,
    default: () => ""
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

async function prepareNode(state) {
  return {
    needsResearch: needsResearch(state.task)
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
      research: state.research
    })
  };
}

function routeAfterPrepare(state) {
  return state.needsResearch ? "researcher" : "writer";
}

export function createDefaultGraph({ researcher, writer }) {
  return new StateGraph(AgentState)
    .addNode("prepare", prepareNode)
    .addNode("researcher", (state) => researcherNode(state, researcher))
    .addNode("writer", (state) => writerNode(state, writer))
    .addEdge(START, "prepare")
    .addConditionalEdges("prepare", routeAfterPrepare, {
      researcher: "researcher",
      writer: "writer"
    })
    .addEdge("researcher", "writer")
    .addEdge("writer", END)
    .compile();
}
