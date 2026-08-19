/**
 * @file create-runtime.js
 * @description Agent 运行时工厂函数。
 *
 * 职责：将所有独立模块（模型、技能、Agent、工具、图）组装成一个
 * 可直接调用的运行时对象。
 *
 * 运行时包含：
 *   - graph：编译后的 LangGraph 工作流图（主要调用入口）
 *   - agents：各 Agent 和工具实例（供调试或单独调用）
 *   - skills：已加载的技能 Map（供查阅）
 *
 * 组装顺序（有依赖关系，顺序不可随意调换）：
 *   1. createModel         → LLM 实例
 *   2. loadSkills          → 技能 Map
 *   3. skillText           → 各模块所需的技能文本片段
 *   4. createResearcherAgent / createWriterAgent → Agent 实例（依赖 model 和 skillText）
 *   5. createFinancialDataTool                  → 估值工具（依赖 config）
 *   6. createStockAnalysisTool                  → 行情工具（依赖 financialDataTool）
 *   7. createDefaultGraph                       → 工作流图（依赖所有 Agent 和工具）
 *
 * checkpointer（JsonFileSaver）作为模块级单例在文件顶部初始化，
 * 所有 createAgentRuntime 调用共享同一实例，避免切换模型时会话历史丢失。
 */

import { createModel } from "../config/model.js";
import { createResearcherAgent } from "../agents/researcher.agent.js";
import { createWriterAgent } from "../agents/writer.agent.js";
import { createDefaultGraph } from "../graphs/default.graph.js";
import { loadSkills, skillText } from "../skills/load-skills.js";
import { createStockAnalysisTool, isStockAnalysisTask } from "../tools/stock-analysis.tool.js";
import { createFinancialDataTool } from "../tools/financial-data.tool.js";
import { JsonFileSaver } from "../checkpointer/json-file-saver.js";

/**
 * 模块级单例 Checkpointer。
 *
 * 进程级别共享，确保所有运行时实例（包括动态模型切换时创建的临时 runtime）
 * 都使用同一个 checkpointer，避免切换模型后会话历史丢失。
 *
 * 快照存储在 data/checkpoints.json，进程重启后自动从磁盘恢复。
 */
const checkpointer = new JsonFileSaver("./data/checkpoints.json");

/**
 * 异步创建并返回完整的 Agent 运行时对象。
 *
 * 每次调用都会创建全新的实例（支持多模型并发请求，见 server.js runtimeFrom）。
 *
 * @param {object} config - 来自 loadAgentConfig() 的配置对象
 * @returns {Promise<{
 *   graph: import("@langchain/langgraph").CompiledStateGraph,
 *   agents: {
 *     researcher: object,
 *     writer: object,
 *     stockTool: object,
 *     financialDataTool: object
 *   },
 *   skills: Map<string, string>
 * }>}
 */
export async function createAgentRuntime(config) {
  // 步骤一：创建 LLM 模型实例（apiKey 缺失时会立即抛出）
  const model = createModel(config);

  // 步骤二：从磁盘加载所有技能文件（并行 I/O，通常很快）
  const skills = await loadSkills();

  // 步骤三：提取各 Agent 所需的技能文本片段
  // fly-ash-domain：粉煤灰领域知识，注入研究 Agent 和写作 Agent
  const domainSkill = skillText(skills, ["fly-ash-domain"]);
  // answer-quality：回答质量规范，仅注入写作 Agent
  const qualitySkill = skillText(skills, ["answer-quality"]);

  // 步骤四：创建研究 Agent（负责提炼事实和不确定点）
  const researcher = createResearcherAgent(model, domainSkill);

  // 步骤五：创建写作 Agent（负责生成最终中文回答）
  const writer = createWriterAgent(model, domainSkill, qualitySkill);

  // 步骤六：创建腾讯财经估值工具（获取 PE/PB/市值）
  const financialDataTool = createFinancialDataTool(config);

  // 步骤七：创建股票行情分析工具（依赖 financialDataTool 补充估值数据）
  const stockTool = createStockAnalysisTool({ financialDataTool });

  // 步骤八：将 isStockAnalysisTask 挂载到工具实例上，
  // 方便 default.graph.js 中的 prepare 节点直接调用，无需单独传参
  stockTool.isStockAnalysisTask = isStockAnalysisTask;

  // 步骤九：注入模块级单例 checkpointer（JsonFileSaver，持久化到磁盘 JSON 文件）
  // 使用模块级单例而非每次新建，确保切换模型时不会丢失会话历史。

  // 步骤十：组装并编译 LangGraph 工作流图（传入 checkpointer 启用记忆）
  const graph = createDefaultGraph({ researcher, writer, stockTool, checkpointer });

  return {
    // 主要调用入口：graph.invoke() 或 graph.streamEvents()
    graph,
    // 各组件实例（供调试、单测或后续扩展使用）
    agents: { researcher, writer, stockTool, financialDataTool },
    // 原始技能 Map（供健康检查或管理接口查阅）
    skills
  };
}
