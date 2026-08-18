import { createModel } from "../config/model.js";
import { createResearcherAgent } from "../agents/researcher.agent.js";
import { createWriterAgent } from "../agents/writer.agent.js";
import { createDefaultGraph } from "../graphs/default.graph.js";
import { loadSkills, skillText } from "../skills/load-skills.js";

export async function createAgentRuntime(config) {
  const model = createModel(config);
  const skills = await loadSkills();
  const domainSkill = skillText(skills, ["fly-ash-domain"]);
  const qualitySkill = skillText(skills, ["answer-quality"]);
  const researcher = createResearcherAgent(model, domainSkill);
  const writer = createWriterAgent(model, domainSkill, qualitySkill);

  return {
    graph: createDefaultGraph({ researcher, writer }),
    agents: { researcher, writer },
    skills
  };
}
