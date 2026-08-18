import express from "express";
import { loadAgentConfig } from "./config/env.js";
import { createAgentRuntime } from "./runtime/create-runtime.js";
const config = loadAgentConfig();
const runtime = await createAgentRuntime(config);
const app = express();
app.use(express.json());
const taskFrom = (request) => String(request.body?.task ?? request.query?.task ?? "").trim();

function contextFrom(request) {
  const value = request.body?.context ?? request.query?.context;
  if (!value) return [];

  try {
    const context = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(context) ? context : [];
  } catch {
    return [];
  }
}

function taskWithContext(request) {
  const task = taskFrom(request);
  const context = contextFrom(request);
  if (!context.length) return task;

  const history = context
    .filter((message) => message?.role && message?.content)
    .map((message) => `${message.role === "assistant" ? "AI" : "用户"}：${message.content}`)
    .join("\n");

  return `以下是当前会话的历史上下文：\n${history}\n\n当前问题：\n${task}`;
}
async function runtimeFrom(request) {
  const model = request.body?.model || null;
  if (!model) return runtime;
  const thinkingMode = ["enabled", "disabled", "auto"].includes(request.body?.thinkingMode)
    ? request.body.thinkingMode
    : model.thinkingMode;
  return createAgentRuntime({
    ...config,
    provider: model.provider,
    model: model.model,
    apiKey: config.apiKey,
    baseUrl: model.endpoint,
    thinkingMode
  });
}
const sendEvent = (response, event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
app.get("/internal/health", (_req, res) => res.json({ ok: true, service: "agent-service", framework: "langgraph" }));
app.post("/internal/agent/stream", async (req, res) => {
  const task = taskWithContext(req);
  if (!task) return res.status(400).json({ error: "task 不能为空" });
  res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const startedAt = Date.now();
  console.log(`[agent] stream started: model=${req.body?.model?.model || "default"}; taskCharacters=${task.length}`);
  let firstTokenAt;
  let answer = "";
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    for await (const event of (await runtimeFrom(req)).graph.streamEvents({ task }, { version: "v2" })) {
      if (event.event === "on_chat_model_stream") {
        const content = event.data?.chunk?.content;
        const token = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part?.text || "").join("") : "";
        if (token) {
          firstTokenAt ??= Date.now();
          answer += token;
          send("token", { token });
        }
      }
    }
    send("final", { answer, durationMs: Date.now() - startedAt, firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null });
    console.log(`[agent] stream completed: durationMs=${Date.now() - startedAt}; firstTokenMs=${firstTokenAt ? firstTokenAt - startedAt : "unknown"}; answerCharacters=${answer.length}`);
    send("done", {}); res.end();
  } catch (error) { send("error", { error: error.message || "Agent 执行失败" }); res.end(); }
});
app.post("/internal/agent/run", async (req, res) => {
  const task = taskFrom(req);
  if (!task) return res.status(400).json({ error: "task 不能为空" });
  const startedAt = Date.now();
  try {
    const result = await (await runtimeFrom(req)).graph.invoke({ task });
    res.json({ answer: result.answer, research: result.research, needsResearch: result.needsResearch, durationMs: Date.now() - startedAt });
  } catch (error) {
    console.error(`[agent] failed after ${Date.now() - startedAt}ms: ${error.message}`);
    res.status(500).json({ error: "Agent 执行失败", code: "AGENT_EXECUTION_ERROR" });
  }
});
app.listen(config.port, () => console.log(`Agent 服务：http://localhost:${config.port}`));
