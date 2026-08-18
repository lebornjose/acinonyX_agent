import "dotenv/config";
import express from "express";
import { createModel } from "./config.js";
import { createAgentGraph } from "./graph.js";

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/chat", async (req, res) => {
  const task = String(req.body?.message || "").trim();
  if (!task) return res.status(400).json({ error: "message 不能为空" });
  try {
    const result = await createAgentGraph(createModel()).invoke({ task });
    res.json({ answer: result.answer, research: result.research });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Agent 执行失败" });
  }
});

app.listen(port, () => console.log(`Agent 服务已启动：http://localhost:${port}`));
