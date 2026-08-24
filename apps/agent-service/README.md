# 股票知识 Agent Service

基于 LangChain.js 和 LangGraph 的可配置股票知识 Agent 编排服务。它通过研究 Agent、行情工具和写作 Agent 协作，解答股票基础概念、财务指标、公司与行业分析、估值、技术分析、交易规则和投资风险等问题。行情工具使用同花顺金融数据 API 获取 A 股报价、前复权日 K 和估值数据，模型通过 `ChatOpenAI` 的 OpenAI-compatible 接口接入，因此可以使用 OpenAI、DeepSeek、通义千问、Moonshot、智谱或其他兼容服务。

服务会对复杂问题先生成研究简报；识别到具体股票时，会先由标的解析 Agent 从中文自然语言中抽取唯一 A 股名称或代码，再通过同花顺接口做确定性检索和消歧，随后计算近 1 个月、3 个月和 6 个月的价格指标。若问题不包含唯一 A 股标的或标的属于港股、美股等覆盖范围外市场，服务会在答案中明确说明而不会将数据接口错误直接返回。涉及行情、财报和政策等时效性信息时，回答会标注信息时点和不确定性。该服务用于知识学习与分析辅助，不提供收益保证或无依据的确定性买卖建议。

## 结构

`config` 管理配置和模型，`skills` 管理股票领域与答案质量规范，`agents` 定义研究和写作 Agent，`tools` 管理外部行情工具和确定性指标计算，`graphs` 定义 LangGraph 工作流，`runtime` 负责组装，`server.js` 提供内部 HTTP 接口。自定义 Agent 应从 `agents/*.agent.js` 开始，并通过 Graph 接入运行时。

工具的输入输出约束、错误码和数据限制见 [`src/tools/README.md`](src/tools/README.md)。股票行情工具使用同花顺的价格、K 线与估值快照；财报、新闻和公告功能需要按场景增加对应工具，不能由模型补全。

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

### 同花顺金融数据 API Key

后续启用同花顺金融数据工具时，使用以下环境变量配置凭据。请在 [API Key 管理页](https://fuyao.aicubes.cn/admin/) 登录并创建有效 Key；真实值只能写入本地 `.env` 或受管密钥服务，不能提交到仓库。

```env
HITHINK_FINANCE_API_KEY=your-hithink-finance-api-key
HITHINK_FINANCE_BASE_URL=https://fuyao.aicubes.cn
HITHINK_FINANCE_TIMEOUT_MS=10000
```
