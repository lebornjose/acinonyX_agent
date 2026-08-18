import { createModel } from "../config/model.js";
import { createResearcherAgent } from "../agents/researcher.agent.js";
import { createWriterAgent } from "../agents/writer.agent.js";
import { createDefaultGraph } from "../graphs/default.graph.js";
import { loadSkills, skillText } from "../skills/load-skills.js";
import { createStockAnalysisTool, isStockAnalysisTask } from "../tools/stock-analysis.tool.js";
import { createFinancialDataTool } from "../tools/financial-data.tool.js";

export async function createAgentRuntime(config) {
  const model = createModel(config);
  const skills = await loadSkills();
  const domainSkill = skillText(skills, ["fly-ash-domain"]);
  const qualitySkill = skillText(skills, ["answer-quality"]);
  const researcher = createResearcherAgent(model, domainSkill);
  const writer = createWriterAgent(model, domainSkill, qualitySkill);
  const financialDataTool = createFinancialDataTool(config);
  const stockTool = createStockAnalysisTool({ financialDataTool });
  stockTool.isStockAnalysisTask = isStockAnalysisTask;

  return {
    graph: createDefaultGraph({ researcher, writer, stockTool }),
    agents: { researcher, writer, stockTool, financialDataTool },
    skills
  };
}
