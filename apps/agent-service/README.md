# agent-service

基于 LangChain.js 和 LangGraph 的可配置 Agent 编排服务。模型通过 `ChatOpenAI` 的 OpenAI-compatible 接口接入，因此可以使用 OpenAI、DeepSeek、通义千问、Moonshot、智谱或其他兼容服务。服务内置可复用 Skill，用于约束粉煤灰领域知识和答案质量。

## 结构

`config` 管理配置和模型，`skills` 管理业务 Skill，`agents` 定义可复用 Agent，`graphs` 定义 LangGraph 工作流，`runtime` 负责组装，`server.js` 提供内部 HTTP 接口。自定义 Agent 应从 `agents/*.agent.js` 开始，并通过 Graph 接入运行时。

## 接口

- `GET /internal/health`：服务和框架健康检查。
- `POST /internal/agent/run`：请求体 `{ "task": "..." }`，返回最终答案和研究状态。
- `GET /internal/agent/stream?task=...`：以 SSE 返回 token、final、done 或 error 事件。

## 本地验证

```bash
pnpm --filter agent-service start
curl http://localhost:4002/internal/health
```

模型配置优先使用通用的 `LLM_*` 环境变量：

- `LLM_API_KEY`：模型服务 API Key。
- `LLM_BASE_URL`：OpenAI-compatible API 地址；使用 OpenAI 官方接口时可留空。
- `LLM_MODEL`：模型名称，默认 `gpt-4o-mini`。
- `LLM_PROVIDER`：提供商标识，仅用于配置和观测，默认 `openai-compatible`。
- `LLM_TEMPERATURE`、`LLM_TIMEOUT_MS`、`LLM_MAX_RETRIES`：运行参数。

例如接入 DeepSeek 时设置 `LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-chat`；接入其他服务时只需替换地址、模型和 Key，不需要修改 Agent 或 Graph 代码。
