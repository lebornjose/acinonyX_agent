import { performance } from "node:perf_hooks";
import { listByUser, createConversation, findById, listMessages, addMessages, deleteConversation } from "../repositories/conversation.repository.js";
import { runAgent } from "../services/agent-client.js";
import { httpError } from "../utils/http-error.js";
import { generateId } from "../utils/id.js";
import { findActiveModel } from "../repositories/model.repository.js";
export const list = (req, res, next) => listByUser(req.user.id).then(res.json.bind(res)).catch(next);
export const create = (req, res, next) => createConversation(generateId(), req.user.id, req.body?.title || "新对话").then((item) => res.status(201).json(item)).catch(next);
export async function detail(req, res, next) { try { const item = await findById(req.params.id, req.user.id); if (!item) throw httpError(404, "会话不存在"); item.messages = await listMessages(item.id); res.json(item); } catch (error) { next(error); } }
export async function remove(req, res, next) { try { const deleted = await deleteConversation(req.params.id, req.user.id); if (!deleted) throw httpError(404, "会话不存在"); res.status(204).end(); } catch (error) { next(error); } }
export async function sendMessage(req, res, next) { const startedAt = performance.now(); try { const content = String(req.body?.content || "").trim(); if (!content) throw httpError(400, "content 不能为空"); const item = await findById(req.params.id, req.user.id); if (!item) throw httpError(404, "会话不存在"); const result = await runAgent(content, item.id); const message = { id: generateId(), content: result.answer }; const userMessage = { id: generateId(), content }; const durationMs = performance.now() - startedAt; console.log(`[api] message completed in ${durationMs}ms; agent=${result.durationMs ?? "unknown"}ms`); res.json({ message: { ...message, role: "assistant" }, steps: result.steps, durationMs, agentDurationMs: result.durationMs }); const persistenceStartedAt = performance.now(); addMessages(item.id, userMessage, message).then(() => console.log(`[api] message persisted in ${performance.now() - persistenceStartedAt}ms`)).catch((error) => console.error(`[api] message persistence failed after ${performance.now() - persistenceStartedAt}ms: ${error.message}`)); } catch (error) { console.error(`[api] message failed after ${performance.now() - startedAt}ms: ${error.message}`); next(error); } }
export async function streamMessage(req, res, next) {
  const content = String(req.body?.content || "").trim();
  if (!content) return next(httpError(400, "content 不能为空"));
  const startedAt = performance.now();
  try {
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" }); res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected" })}\n\n`);
    console.log(`[api] stream connected in ${performance.now() - startedAt}ms; agent and session validation started in parallel`);
    const model = req.body?.modelId ? await findActiveModel(req.body.modelId) : null;
    if (req.body?.modelId && !model) throw httpError(404, "模型不存在或已禁用");
    const context = Array.isArray(req.body?.context) ? req.body.context : [];
    const thinkingMode = ["enabled", "disabled", "auto"].includes(req.body?.thinkingMode)
      ? req.body.thinkingMode
      : "disabled";
    const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS || 90000);
    const agentController = new AbortController();
    const timeout = setTimeout(() => agentController.abort(), timeoutMs);
    console.log(`[api] agent request: model=${model?.model || "default"}; contextMessages=${context.length}; contextCharacters=${JSON.stringify(context).length}`);
    const [item, upstream] = await Promise.all([
      findById(req.params.id, req.user.id),
      fetch(`${process.env.AGENT_SERVICE_URL || "http://localhost:4002"}/internal/agent/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: content, conversationId: req.params.id, context, model, thinkingMode }),
        signal: agentController.signal
      })
    ]);
    if (!item) throw httpError(404, "会话不存在");
    if (!upstream.ok || !upstream.body) throw new Error("Agent 流式服务不可用");
    const reader = upstream.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let answer = ""; const userMessage = { id: generateId(), content }; let closed = false;
    req.on("close", () => { closed = true; reader.cancel().catch(() => {}); });
    while (!closed) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const blocks = buffer.split("\n\n"); buffer = blocks.pop(); for (const block of blocks) { if (!block.trim() || block.startsWith("event: done")) continue; res.write(`${block}\n\n`); const dataLine = block.split("\n").find((line) => line.startsWith("data: ")); if (!dataLine) continue; try { const data = JSON.parse(dataLine.slice(6)); if (block.startsWith("event: final")) answer = data.answer || ""; } catch {} } }
    clearTimeout(timeout);
    if (!closed && answer) {
      const assistantMessage = { id: generateId(), content: answer };
      res.write(`event: message\ndata: ${JSON.stringify({ message: { ...assistantMessage, role: "assistant" } })}\n\n`);
      res.write("event: done\ndata: {}\n\n"); res.end();
      console.log(`[api] stream response completed in ${performance.now() - startedAt}ms`);
      addMessages(req.params.id, userMessage, assistantMessage)
        .then(() => console.log(`[api] messages persisted for ${req.params.id}`))
        .catch((error) => console.error(`[api] deferred persistence failed: ${error.message}`));
    }
  } catch (error) {
    if (error.name === "AbortError") {
      error.message = "Agent 响应超时，请缩短问题或稍后重试";
    }
    if (!res.headersSent) return next(error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}
