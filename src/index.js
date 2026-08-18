import { createModel } from "./config.js";
import { createAgentGraph } from "./graph.js";

const task = process.argv.slice(2).join(" ").trim();

if (!task) {
  console.error("用法：npm start -- \"请介绍 LangChain JS 的核心概念\"");
  process.exit(1);
}

try {
  const graph = createAgentGraph(createModel());
  const result = await graph.invoke({ task });
  console.log("\n=== 最终答案 ===\n");
  console.log(result.answer);
} catch (error) {
  console.error(`运行失败：${error.message}`);
  process.exit(1);
}
