/**
 * @file server.js
 * @description Agent 服务 HTTP 入口。
 *
 * 对外暴露两个接口：
 *   GET  /internal/health           - 健康检查，供网关和监控探活
 *   POST /internal/agent/stream     - SSE 流式调用，逐 token 推送，适合前端实时渲染
 *   POST /internal/agent/run        - 同步调用，等待完整答案后一次性返回
 *
 * 请求体（JSON）公共字段：
 *   task         {string}  - 用户问题（必填）
 *   context      {Array}   - 历史对话上下文，格式 [{role, content}, ...]（可选）
 *   model        {object}  - 动态模型配置，格式 {provider, model, endpoint}（可选）
 *   thinkingMode {string}  - 深度思考模式："auto" | "enabled" | "disabled"（可选）
 *
 * SSE 事件类型（/stream 接口）：
 *   token   - 每个生成 token，data: { token: string }
 *   final   - 生成完成汇总，data: { answer, durationMs, firstTokenMs }
 *   done    - 流结束信号，data: {}
 *   error   - 执行错误，data: { error: string }
 */

import express from "express";
import { loadAgentConfig } from "./config/env.js";
import { createAgentRuntime } from "./runtime/create-runtime.js";

// 启动时加载配置并初始化默认运行时（使用 .env 中的模型配置）
const config = loadAgentConfig();
const runtime = await createAgentRuntime(config);

const app = express();
app.use(express.json());

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 从请求中提取 task 字段。
 * 支持 JSON body 和 query string 两种方式，结果去除首尾空格。
 *
 * @param {express.Request} request
 * @returns {string}
 */
const taskFrom = (request) =>
  String(request.body?.task ?? request.query?.task ?? "").trim();

/**
 * 从请求中提取历史对话上下文。
 * context 可以是 JSON 字符串（query string）或对象数组（body）。
 * 解析失败时静默返回空数组，不影响主流程。
 *
 * @param {express.Request} request
 * @returns {Array<{role: string, content: string}>}
 */
function contextFrom(request) {
  const value = request.body?.context ?? request.query?.context;
  if (!value) {
    return [];
  }

  try {
    const context = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(context) ? context : [];
  } catch {
    return [];
  }
}

/**
 * 从请求中提取会话 ID。
 * conversationId 用于绑定 LangGraph checkpointer 的 thread_id，
 * 让同一个会话的多次调用共享状态快照，实现多轮上下文记忆。
 *
 * @param {express.Request} request
 * @returns {string | null}
 */
const conversationIdFrom = (request) =>
  String(request.body?.conversationId || "").trim() || null;

/**
 * 将历史上下文与当前问题合并为完整任务文本。
 *
 * 合并格式：
 *   以下是当前会话的历史上下文：
 *   用户：...
 *   AI：...
 *
 *   当前问题：
 *   <task>
 *
 * 无上下文时直接返回原始 task 文本。
 *
 * 注意：当请求携带 conversationId 时，历史上下文由 checkpointer 自动恢复，
 * 此函数的 context 拼接逻辑将被跳过，避免重复注入历史。
 *
 * @param {express.Request} request
 * @returns {string} 包含历史上下文的完整任务文本
 */
function taskWithContext(request) {
  const task = taskFrom(request);

  // 有 conversationId 时由 checkpointer 管理历史，不再手动拼接 context
  const conversationId = conversationIdFrom(request);
  if (conversationId) {
    return task;
  }

  const context = contextFrom(request);

  if (!context.length) {
    return task;
  }

  // 将历史消息格式化为"角色：内容"格式，过滤掉缺少 role 或 content 的条目
  const history = context
    .filter((message) => message?.role && message?.content)
    .map((message) => `${message.role === "assistant" ? "AI" : "用户"}：${message.content}`)
    .join("\n");

  return `以下是当前会话的历史上下文：\n${history}\n\n当前问题：\n${task}`;
}

/**
 * 根据请求中的 model 字段决定使用哪个运行时。
 *
 * - 未传 model：复用启动时初始化的默认运行时（零额外开销）
 * - 传入 model：基于当前配置动态创建新运行时（支持运行时切换模型）
 *
 * thinkingMode 优先取请求体中的值；若请求体未传，则沿用 model 对象自带的值。
 *
 * @param {express.Request} request
 * @returns {Promise<typeof runtime>}
 */
async function runtimeFrom(request) {
  const model = request.body?.model || null;

  // 未指定动态模型，直接复用默认运行时
  if (!model) {
    return runtime;
  }

  // 校验 thinkingMode 取值范围，非法值回退到 model 对象的 thinkingMode
  const thinkingMode = ["enabled", "disabled", "auto"].includes(request.body?.thinkingMode)
    ? request.body.thinkingMode
    : model.thinkingMode;

  return createAgentRuntime({
    ...config,
    provider:     model.provider,
    model:        model.model,
    apiKey:       config.apiKey,   // API 密钥始终从服务端配置读取，禁止由请求方传入
    baseUrl:      model.endpoint,
    thinkingMode
  });
}

/**
 * 向 SSE 响应流写入一条事件。
 *
 * SSE 格式：
 *   event: <event>\n
 *   data: <JSON>\n\n
 *
 * @param {express.Response} response - Express 响应对象
 * @param {string}           event    - 事件名称（token / final / done / error）
 * @param {object}           data     - 事件数据（会被 JSON 序列化）
 */
const sendEvent = (response, event, data) =>
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

// ─── 路由 ────────────────────────────────────────────────────────────────────

/**
 * GET /internal/health
 * 健康检查接口。供 API 网关、负载均衡器和监控系统探活使用。
 */
app.get("/internal/health", (_req, res) => {
  res.json({ ok: true, service: "agent-service", framework: "langgraph" });
});

/**
 * POST /internal/agent/stream
 * SSE 流式调用接口。
 *
 * 使用 LangGraph streamEvents (v2) 监听 on_chat_model_stream 事件，
 * 逐 token 推送给客户端，适合前端实时渲染打字机效果。
 *
 * 响应头：Content-Type: text/event-stream
 */
app.post("/internal/agent/stream", async (req, res) => {
  const rawTask = taskFrom(req);

  // task 为空时直接返回 400，不进入 Agent 流程
  if (!rawTask) {
    return res.status(400).json({ error: "task 不能为空" });
  }

  // conversationId 存在时由 checkpointer 管理历史，task 直接用原始输入；
  // 不存在时退化为旧的字符串拼接模式（向后兼容无会话 ID 的调用方）
  const conversationId = conversationIdFrom(req);
  const task = taskWithContext(req);

  // 设置 SSE 响应头并立即刷新，让客户端进入流接收状态
  res.status(200).set({
    "Content-Type":  "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection":    "keep-alive"
  });
  res.flushHeaders();

  const startedAt = Date.now();
  console.log(
    `[agent] stream started: model=${req.body?.model?.model || "default"};` +
    ` taskCharacters=${task.length}; conversationId=${conversationId || "none"}`
  );

  // firstTokenAt：记录首个 token 到达的时间戳（用于计算 TTFT）
  let firstTokenAt;
  // answer：累积所有 token，用于 final 事件汇总
  let answer = "";

  // 局部 sendEvent，绑定当前响应对象
  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    // 获取（或创建）运行时，然后启动流式事件循环
    const activeRuntime = await runtimeFrom(req);

    // streamConfig：传给 streamEvents 的运行时配置
    // 有 conversationId 时绑定 thread_id，checkpointer 自动恢复该会话的历史状态；
    // 无 conversationId 时不传 configurable，图作为无状态单次执行
    const streamConfig = conversationId
      ? { version: "v2", configurable: { thread_id: conversationId } }
      : { version: "v2" };

    for await (const event of activeRuntime.graph.streamEvents(
      { task, rawTask },
      streamConfig
    )) {
      // 只处理 LLM 输出的流式 token 事件
      if (event.event === "on_chat_model_stream") {
        const content = event.data?.chunk?.content;

        // content 可能是字符串（普通模型）或数组（部分支持思考模式的模型）
        const token = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map((part) => part?.text || "").join("")
            : "";

        if (token) {
          // 记录首个 token 时间（仅记录一次）
          firstTokenAt ??= Date.now();
          answer += token;
          send("token", { token });
        }
      }
    }

    // 所有 token 推送完毕，发送汇总事件
    send("final", {
      answer,
      durationMs:   Date.now() - startedAt,
      firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null
    });

    console.log(
      `[agent] stream completed: durationMs=${Date.now() - startedAt};` +
      ` firstTokenMs=${firstTokenAt ? firstTokenAt - startedAt : "unknown"};` +
      ` answerCharacters=${answer.length}`
    );

    // 发送流结束信号，然后关闭连接
    send("done", {});
    res.end();
  } catch (error) {
    // 执行错误通过 error 事件通知客户端
    send("error", { error: error.message || "Agent 执行失败" });
    res.end();
  }
});

/**
 * POST /internal/agent/run
 * 同步调用接口。
 *
 * 等待 Agent 完整执行后一次性返回 JSON 结果，
 * 适合不需要流式渲染的场景（如服务间调用、批量处理）。
 */
app.post("/internal/agent/run", async (req, res) => {
  const rawTask = taskFrom(req);

  // task 为空时直接返回 400
  if (!rawTask) {
    return res.status(400).json({ error: "task 不能为空" });
  }

  // 同步接口不拼接历史上下文（历史上下文只用于流式接口的多轮对话场景）
  const task = rawTask;
  const startedAt = Date.now();

  try {
    const activeRuntime = await runtimeFrom(req);
    const result = await activeRuntime.graph.invoke({ task, rawTask });

    res.json({
      answer:        result.answer,
      research:      result.research,
      needsResearch: result.needsResearch,
      durationMs:    Date.now() - startedAt
    });
  } catch (error) {
    console.error(`[agent] failed after ${Date.now() - startedAt}ms: ${error.message}`);
    res.status(500).json({
      error: "Agent 执行失败",
      code:  "AGENT_EXECUTION_ERROR"
    });
  }
});

// ─── 启动 ────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`Agent 服务：http://localhost:${config.port}`);
});
