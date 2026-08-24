/**
 * @file default.graph.js
 * @description LangGraph 默认工作流图。
 *
 * 整体流程：
 *
 *   START
 *     │
 *     ▼
 *   prepare（分析任务，决定走哪条路）
 *     │
 *     ├─ needsStockAnalysis ──► stockData（断任务是否需要股票行情获取实时行情）──► writer
 *     ├─ needsResearch      ──► researcher（研究简报）    ──► writer
 *     └─ 其他               ──────────────────────────────► writer
 *                                                              │
 *                                                              ▼
 *                                                       suggestions（生成追问）
 *                                                              │
 *                                                            END
 *
 * 节点说明：
 *   - prepare:     判或深度研究
 *   - stockData:   调用 stock_analysis 工具获取结构化行情数据
 *   - researcher:  调用研究 Agent 生成研究简报
 *   - writer:      综合所有输入生成最终回答
 *
 * 路由优先级：股票行情 > 深度研究 > 直接回答
 * （有股票代码时不再额外调用研究 Agent，避免重复等待）
 */

import {
  Annotation,
  END,
  START,
  StateGraph
} from "@langchain/langgraph";

/**
 * LangGraph 状态定义。
 * 每个字段对应工作流在不同节点间传递的数据。
 *
 * - task:              经过上下文拼接处理后的完整任务文本（含对话历史）
 * - rawTask:           用户本轮输入的原始问题（用于股票代码识别，避免被历史干扰）
 * - needsResearch:     prepare 节点判断是否需要调用研究 Agent
 * - needsStockAnalysis:prepare 节点判断是否需要调用行情工具
 * - research:          研究 Agent 输出的简报文本
 * - stockAnalysis:     stock_analysis 工具输出的结构化行情对象
 * - stockDataNotice:   无法查询行情时传给写作 Agent 的数据覆盖范围说明
 * - answer:            写作 Agent 产出的最终回答文本
 * - suggestedQuestions: 根据本轮问答生成的可点击后续问题
 */
const AgentState = Annotation.Root({
  task: Annotation(),
  rawTask: Annotation({
    default: () => ""
  }),
  needsResearch: Annotation({
    default: () => false
  }),
  needsStockAnalysis: Annotation({
    default: () => false
  }),
  research: Annotation({
    // reducer：每次更新都直接替换旧值
    reducer: (_, next) => next,
    default: () => ""
  }),
  stockAnalysis: Annotation({
    // reducer：每次更新都直接替换旧值
    reducer: (_, next) => next,
    default: () => null
  }),
  stockDataNotice: Annotation({
    reducer: (_, next) => next,
    default: () => ""
  }),
  answer: Annotation({
    // reducer：每次更新都直接替换旧值
    reducer: (_, next) => next,
    default: () => ""
  }),
  suggestedQuestions: Annotation({
    reducer: (_, next) => next,
    default: () => []
  })
});

/**
 * 判断任务是否需要深度研究的关键词正则。
 * 满足以下任一条件时触发研究 Agent：
 *   - 任务长度超过 180 个字符（说明问题较为复杂）
 *   - 任务包含研究/分析/比较等深度分析相关词汇
 */
const researchKeywords = /研究|分析|比较|对比|总结|风险|财报|估值|数据|原因|方案|步骤|最新|历史|多角度/u;

/**
 * 根据任务内容判断是否需要深度研究。
 *
 * @param {string} task - 任务文本
 * @returns {boolean} true 表示需要调用研究 Agent
 */
function needsResearch(task) {
  const text = String(task || "").trim();
  return text.length > 180 || researchKeywords.test(text);
}

/**
 * prepare 节点：分析任务，设置路由标志。
 *
 * 注意：股票代码识别使用 rawTask（用户本轮原始输入），
 * 避免历史对话中的代码干扰本轮路由决策。
 *
 * @param {object} state     - 当前图状态
 * @param {object} stockTool - stock_analysis 工具（需挂载 isStockAnalysisTask 方法）
 * @returns {{ needsResearch: boolean, needsStockAnalysis: boolean }}
 */
async function prepareNode(state, stockTool) {
  const rawTask = state.rawTask || state.task;
  return {
    needsResearch: needsResearch(state.task),
    needsStockAnalysis: stockTool.isStockAnalysisTask(rawTask)
  };
}

/**
 * stockData 节点：获取实时行情和估值数据。
 *
 * 使用 rawTask 而非 task，理由同 prepareNode：
 * 避免历史上下文中的其他股票代码干扰本轮行情查询。
 *
 * @param {object} state     - 当前图状态
 * @param {object} stockTool        - stock_analysis 工具实例
 * @param {object} stockSymbolAgent - A 股标的解析 Agent
 * @returns {{ stockAnalysis: object|null, stockDataNotice: string }} 行情分析结果
 */
async function stockAnalysisNode(state, stockTool, stockSymbolAgent) {
  const rawTask = state.rawTask || state.task;

  let symbolQuery;
  try {
    symbolQuery = await stockSymbolAgent.invoke({ task: rawTask });
  } catch {
    return {
      stockAnalysis: null,
      stockDataNotice: "暂时无法从当前问题中解析 A 股标的，请提供股票名称或 6 位 A 股代码。"
    };
  }

  if (!symbolQuery) {
    return {
      stockAnalysis: null,
      stockDataNotice: "当前行情数据仅覆盖 A 股，未识别到唯一可查询的 A 股标的；请提供股票名称或 6 位 A 股代码。"
    };
  }

  try {
    return {
      stockAnalysis: await stockTool.invoke({ task: rawTask, symbolQuery }),
      stockDataNotice: ""
    };
  } catch (error) {
    if (String(error.code || "").startsWith("HITHINK_SYMBOL_")) {
      return {
        stockAnalysis: null,
        stockDataNotice: "当前行情数据仅覆盖 A 股，未能将该问题解析为唯一可查询的 A 股标的；请提供股票名称或 6 位 A 股代码。"
      };
    }

    throw error;
  }
}

/**
 * researcher 节点：调用研究 Agent 生成研究简报。
 *
 * @param {object} state      - 当前图状态
 * @param {object} researcher - 研究 Agent 实例
 * @returns {{ research: string }} 研究简报文本
 */
async function researcherNode(state, researcher) {
  return {
    research: await researcher.invoke({
      task: state.task
    })
  };
}

/**
 * writer 节点：综合所有输入，生成最终回答。
 *
 * @param {object} state  - 当前图状态（包含 task、research、stockAnalysis）
 * @param {object} writer - 写作 Agent 实例
 * @returns {{ answer: string }} 最终回答文本
 */
async function writerNode(state, writer) {
  return {
    answer: await writer.invoke({
      task: state.task,
      research: state.research,
      stockAnalysis: state.stockAnalysis,
      stockDataNotice: state.stockDataNotice
    })
  };
}

async function suggestionsNode(state, suggestionAgent) {
  try {
    return {
      suggestedQuestions: await suggestionAgent.invoke({
        task: state.rawTask || state.task,
        answer: state.answer
      })
    };
  } catch {
    return {
      suggestedQuestions: []
    };
  }
}

/**
 * prepare 节点后的路由函数。
 *
 * 路由优先级：
 *   1. 需要股票行情 → "stockData"
 *   2. 需要深度研究 → "researcher"
 *   3. 其他          → "writer"（直接回答）
 *
 * @param {object} state - 当前图状态
 * @returns {string} 下一个节点名称
 */
function routeAfterPrepare(state) {
  if (state.needsStockAnalysis) {
    return "stockData";
  }

  return state.needsResearch ? "researcher" : "writer";
}

/**
 * 创建并编译默认 LangGraph 工作流图。
 *
 * @param {object} options               - 依赖注入参数
 * @param {object} options.researcher    - 研究 Agent 实例
 * @param {object} options.writer        - 写作 Agent 实例
 * @param {object} options.suggestionAgent - 后续问题推荐 Agent 实例
 * @param {object} options.stockTool     - stock_analysis 工具实例（需挂载 isStockAnalysisTask 方法）
 * @param {object} options.stockSymbolAgent - A 股标的解析 Agent
 * @param {object} [options.checkpointer] - LangGraph checkpointer 实例（可选）
 *                                         传入后图将在每次 invoke/stream 结束时自动保存状态快照，
 *                                         下次以相同 thread_id 调用时自动恢复，实现会话内多轮记忆。
 *                                         不传则退化为无状态执行（每次独立，不保留历史）。
 * @returns {import("@langchain/langgraph").CompiledStateGraph} 编译后的图实例
 */
export function createDefaultGraph({
  researcher,
  writer,
  suggestionAgent,
  stockTool,
  stockSymbolAgent,
  checkpointer
}) {
  const graph = new StateGraph(AgentState)
    // 注册所有节点（通过闭包将外部依赖注入节点函数）
    .addNode("prepare",    (state) => prepareNode(state, stockTool))
    .addNode("stockData",  (state) => stockAnalysisNode(state, stockTool, stockSymbolAgent))
    .addNode("researcher", (state) => researcherNode(state, researcher))
    .addNode("writer",     (state) => writerNode(state, writer))
    .addNode("suggestions", (state) => suggestionsNode(state, suggestionAgent))

    // 固定边：START → prepare（每次执行都从 prepare 开始）
    .addEdge(START, "prepare")

    // 条件边：prepare 结束后根据路由函数决定下一步
    .addConditionalEdges("prepare", routeAfterPrepare, {
      stockData:  "stockData",
      researcher: "researcher",
      writer:     "writer"
    })

    // 固定边：行情获取或研究完成后，都流向 writer 生成最终回答
    .addEdge("stockData",  "writer")
    .addEdge("researcher", "writer")

    .addEdge("writer", "suggestions")
    .addEdge("suggestions", END);

  // 有 checkpointer 时传入，启用会话状态持久化；无则编译为无状态图
  return checkpointer
    ? graph.compile({ checkpointer })
    : graph.compile();
}
