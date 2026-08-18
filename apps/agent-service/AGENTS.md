# Agent Service Rules

- 固定使用 LangChain.js + LangGraph；模型通过可配置的 OpenAI-compatible 适配层接入，不绑定具体厂商。
- 只处理 Agent 编排、模型调用、工具调用和执行状态。
- 不实现用户登录、权限、会话持久化和 Admin 业务。
- 每个 Agent 必须有清晰职责、输入和输出。
- 模型配置从环境变量读取，不能硬编码 API Key。
- Agent 不得假设具体模型厂商；提供商、模型、Base URL 和运行参数必须来自 `LLM_*` 配置。
- 模型失败必须返回可识别错误，不得伪造成功答案。
- 修改后执行 JavaScript 语法检查并验证 `/internal/health`。

## 目录与开发规范

- `src/config`：环境变量和模型工厂；不得在 Agent 或图中直接读取 `process.env`。
- `src/agents`：单一职责 Agent。每个 Agent 导出工厂，明确 `name` 和 `invoke` 的输入输出。
- `src/graphs`：LangGraph 状态、节点、边和路由；图只编排，不拼接提示词、不访问数据库。
- `src/runtime`：组装模型、Agent 和 Graph，是 HTTP 层唯一依赖的运行时入口。
- `src/server.js`：仅负责 HTTP 输入校验、SSE/JSON 响应和错误映射。

新增 Agent 时：先定义状态字段与输入输出，再实现 Agent 工厂，最后在 Graph 中注册节点和边；工具调用必须封装在 Agent 或独立工具模块，不得写进路由。跨请求状态默认不持久化，用户、权限、会话和数据库逻辑必须由 `apps/api` 负责。

错误约定：配置错误使用 `AGENT_CONFIG_ERROR`，执行错误使用 `AGENT_EXECUTION_ERROR`；对外不得返回 API Key、完整上游错误或内部堆栈。模型未配置或调用失败时必须失败返回。
